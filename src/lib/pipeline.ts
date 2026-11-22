/**
 * The sourcing pipeline (Samuel, 16 November 2026). Every request, project and application lands here and in the
 * inbox, and the sender gets an acknowledgment with a private link to see it again (/inquiry/<token>). Nothing is
 * charged and nobody is introduced automatically: a person confirms the agreement, the state license and the
 * insurance before any engagement, and presents a technician only after verification and with consent.
 *
 * People (technician, partner), Samuel's statuses: Application Received -> Qualification Pending -> Verification In
 * Progress -> Verified -> Available for Matching (or Declined). Answering questions never makes anyone verified:
 * "Verified" and "Available for Matching" need the checks ticked by a person.
 * Commercial projects, the sales pipeline: New Lead -> Contacted -> Qualified -> Proposal -> Provider Matching ->
 * Agreement -> In Progress -> Completed -> Repeat Customer (or Lost). Agreement and every later stage need the signed
 * agreement and the partner's license and insurance ticked.
 * Employers (talent_request), since 22 Nov 2026 the steps a placement really takes: New Lead -> Contacted -> Qualified
 * Vacancy -> Terms Discussion -> Signed Agreement -> Authorized Candidate Introduction -> Interview -> Hire -> Invoice
 * (or Lost). Each gate needs its check ticked by a person (EMPLOYER_GATES); no candidate identity is released before
 * a signed agreement and the candidate's own yes.
 */
import "server-only";
import { fill, getDictionary } from "@/content";
import type { Attribution } from "./attribution";
import { countryName } from "./countries";
import { newId, newToken, query } from "./db";
import { trySendMail } from "./mail";
import { SITE_URL, pathFor, type Locale } from "./site";

export const KINDS = ["talent_request", "project", "technician", "partner"] as const;
export type Kind = (typeof KINDS)[number];
export const isKind = (v: string): v is Kind => (KINDS as readonly string[]).includes(v);
export const isClient = (kind: Kind) => kind === "talent_request" || kind === "project";

const PEOPLE_STAGES = ["received", "qualified", "verifying", "verified", "available", "declined"] as const;
const CLIENT_STAGES = ["received", "contacted", "qualifying", "proposal", "matching", "agreement", "in_progress", "completed", "repeat", "lost"] as const;
/**
 * Employers (22 Nov 2026). Every key of the earlier list stays valid, so no saved row changes and every earlier move
 * still works: "matching", "in_progress" and "completed" stay as earlier stages (RETIRED_STAGES, shown in the stage
 * menu only on a row already there), with the same gates as before.
 */
const EMPLOYER_STAGES = ["received", "contacted", "qualifying", "proposal", "matching", "agreement", "introduced", "interview", "hired", "invoiced", "in_progress", "completed", "repeat", "lost"] as const;
export const STAGES: Record<Kind, readonly string[]> = {
  technician: PEOPLE_STAGES,
  partner: PEOPLE_STAGES,
  talent_request: EMPLOYER_STAGES,
  project: CLIENT_STAGES,
};
export const RETIRED_STAGES: Partial<Record<Kind, readonly string[]>> = { talent_request: ["matching", "in_progress", "completed"] };

const PEOPLE_LABEL: Record<string, string> = {
  received: "Application Received",
  qualified: "Qualification Pending",
  verifying: "Verification In Progress",
  verified: "Verified",
  available: "Available for Matching",
  declined: "Declined",
};
const CLIENT_LABEL: Record<string, string> = {
  received: "New Lead",
  contacted: "Contacted",
  qualifying: "Qualified",
  proposal: "Proposal",
  matching: "Provider Matching",
  agreement: "Agreement",
  in_progress: "In Progress",
  completed: "Completed",
  repeat: "Repeat Customer",
  lost: "Lost / closed",
  // Rows saved before the sales pipeline (16 Nov 2026, morning release) keep a readable name.
  review: "Contacted (earlier stage)",
  engaged: "Agreement (earlier stage)",
  closed: "Closed (earlier stage)",
};
/** Employers (22 Nov 2026): Samuel's conversion steps, word for word. */
const EMPLOYER_LABEL: Record<string, string> = {
  ...CLIENT_LABEL,
  qualifying: "Qualified Vacancy",
  proposal: "Terms Discussion",
  agreement: "Signed Agreement",
  introduced: "Authorized Candidate Introduction",
  interview: "Interview",
  hired: "Hire",
  invoiced: "Invoice",
  matching: "Provider Matching (earlier stage)",
  in_progress: "In Progress (earlier stage)",
  completed: "Completed (earlier stage)",
};
/** The admin's name for a stage of this kind. */
export const labelFor = (kind: Kind, stage: string) => (kind === "talent_request" ? EMPLOYER_LABEL : isClient(kind) ? CLIENT_LABEL : PEOPLE_LABEL)[stage] ?? stage;

export const KIND_LABEL: Record<Kind, string> = {
  talent_request: "Technician requests (employers)",
  project: "Commercial projects (owners, GCs)",
  technician: "Technician applications",
  partner: "Trade partner applications",
};

/** What a person must confirm, per kind. The admin form shows one box per check. */
export const CHECKS: Record<Kind, { key: string; label: string }[]> = {
  technician: [
    { key: "license", label: "License or certification number checked on the issuing authority's public lookup (TDLR, DBPR, EPA 608 card...)" },
    { key: "identity", label: "Identity checked (name matches the license and an ID)" },
    { key: "history", label: "Work history checked (a past employer or client confirmed)" },
  ],
  partner: [
    { key: "license", label: "State contractor license checked on the state's public lookup, active, right trade" },
    { key: "insurance", label: "Certificates of liability and workers' comp insurance seen, in date" },
  ],
  talent_request: [
    { key: "agreement", label: "Written placement agreement signed (fee, guarantee, payment terms)" },
    {
      key: "candidate_ok",
      label: "Each candidate introduced is Verified in the pipeline and said yes to this employer by name before their identity was shared (candidate IDs in the note)",
    },
    { key: "hire_confirmed", label: "Hire confirmed in writing by the employer: start date and first-year base pay (both in the note)" },
  ],
  project: [
    { key: "agreement", label: "Written referral agreement signed with the licensed contractor" },
    { key: "license", label: "The contractor's state license checked for this trade and place" },
    { key: "insurance", label: "The contractor's liability and workers' comp certificates seen" },
  ],
};
/**
 * Employers: the checks each stage needs (22 Nov 2026). Signed Agreement and every stage after it need the signed
 * agreement, as before; a candidate is introduced only with their yes; a hire is invoiced only once confirmed in
 * writing. The earlier stages keep the gate they had (the agreement only).
 */
const EMPLOYER_GATES: Record<string, string[]> = {
  agreement: ["agreement"],
  introduced: ["agreement", "candidate_ok"],
  interview: ["agreement", "candidate_ok"],
  hired: ["agreement", "candidate_ok", "hire_confirmed"],
  invoiced: ["agreement", "candidate_ok", "hire_confirmed"],
  in_progress: ["agreement"],
  completed: ["agreement"],
  repeat: ["agreement"],
};
/** The checks a stage needs: Verified and later for people, Agreement and later for clients (Lost needs none). */
export function gateFor(kind: Kind, stage: string): { key: string; label: string }[] {
  if (kind === "talent_request") return CHECKS[kind].filter((c) => (EMPLOYER_GATES[stage] ?? []).includes(c.key));
  if (isClient(kind)) {
    const order = CLIENT_STAGES as readonly string[];
    return stage !== "lost" && order.indexOf(stage) >= order.indexOf("agreement") ? CHECKS[kind] : [];
  }
  return stage === "verified" || stage === "available" ? CHECKS[kind] : [];
}

export type Inquiry = {
  id: string;
  created_at: Date;
  kind: Kind;
  source: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  country: string;
  place: string;
  trades: string[];
  data: Record<string, string>;
  consent_at: Date | null;
  consent_text: string;
  stage: string;
  stage_at: Date;
  checks: Record<string, string>;
  notes: string;
  lang: string;
  token: string | null;
  /** Which outreach link brought it (lib/attribution.ts); {} for rows saved before 22 Nov 2026. */
  attribution: Attribution;
  files?: { id: string; name: string; size: number }[];
};

export type NewInquiry = Pick<Inquiry, "kind" | "name" | "email" | "phone" | "company" | "country" | "place" | "trades" | "data" | "lang"> & {
  source?: string;
  attribution?: Attribution;
  consentText?: string;
  consentAt?: Date;
  stage?: string;
  /** False for Indeed candidates typed in by Samuel: they get no email from the site. */
  acknowledge?: boolean;
  /** False for a buyer Samuel types in himself (an outbound lead): no inbox email either. */
  notify?: boolean;
};

export type Upload = { name: string; type: string; bytes: Buffer };

const SUBJECT: Record<Kind, string> = {
  talent_request: "TECHNICIAN REQUEST",
  project: "COMMERCIAL PROJECT",
  technician: "TECHNICIAN APPLICATION",
  partner: "TRADE PARTNER",
};

const NEXT_STEP: Record<Kind, string> = {
  talent_request: "Next: contact them, agree the role and the fee in writing. No technician is introduced before a signed agreement.",
  project: "Next: confirm scope and size, then match a licensed partner. Agreement, license and insurance checks before any introduction.",
  technician: "Next: review the answers (Qualification Pending), then verify license, identity and work history before presenting the profile.",
  partner: "Next: check the state license and the insurance certificates before sending any project.",
};

/** The private page where the sender sees their request or application again. */
export const inquiryLink = (lang: string, token: string) => `${SITE_URL}${pathFor(lang === "ja" ? "ja" : "en", `/inquiry/${token}`)}`;

/** Stores a submission (and its files), tells the inbox and acknowledges the sender. Returns the new id. */
export async function createInquiry(input: NewInquiry, files: Upload[] = []): Promise<string> {
  const id = newId();
  const token = newToken();
  const consentAt = input.consentText ? (input.consentAt ?? new Date()) : null;
  const attribution = input.attribution ?? {};
  await query(
    `INSERT INTO inquiries (id, kind, source, name, email, phone, company, country, place, trades, data, consent_at, consent_text, stage, lang, token, attribution)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
    [id, input.kind, input.source ?? "site", input.name, input.email, input.phone, input.company, input.country, input.place, input.trades, JSON.stringify(input.data), consentAt, input.consentText ?? "", input.stage ?? "received", input.lang, token, JSON.stringify(attribution)],
  );
  for (const file of files) {
    await query(`INSERT INTO inquiry_files (id, inquiry_id, name, type, size, data) VALUES ($1, $2, $3, $4, $5, $6)`, [newId(), id, file.name.slice(0, 120), file.type, file.bytes.length, file.bytes]);
  }
  const who = input.company ? `${input.company} (${input.name})` : input.name;
  const where = [input.place, countryName(input.country)].filter(Boolean).join(", ");
  if (input.notify !== false) await trySendMail({
    subject: `${SUBJECT[input.kind]}: ${who}, ${input.trades.join("/")}, ${where}`.slice(0, 180),
    replyTo: input.email,
    lines: [
      ...[
        `${SUBJECT[input.kind]} (${input.source ?? "site"}, ${input.lang}), reference ${id.toUpperCase()}`,
        `Name: ${input.name}`,
        input.company ? `Company: ${input.company}` : "",
        `Email: ${input.email}`,
        `Phone: ${input.phone || "not given"}`,
        `Place: ${where}`,
        `Trades: ${input.trades.join(", ")}`,
        ...Object.entries(input.data).map(([k, v]) => `${k}: ${v || "not given"}`),
        ...files.map((file) => `File: ${file.name} (${Math.round(file.bytes.length / 1024)} KB), on the admin page`),
        input.consentText ? `Consent: "${input.consentText}" (${(consentAt ?? new Date()).toISOString()})` : "",
        attribution.campaign || attribution.source ? `Campaign: ${attribution.campaign ?? "none"} (${[attribution.source, attribution.medium].filter(Boolean).join(", ") || "no source"})` : "",
        attribution.referrer ? `Came from: ${attribution.referrer}` : "",
      ].filter(Boolean),
      "",
      NEXT_STEP[input.kind],
      "Reply to this email to answer them directly.",
    ],
  });
  // The sender's acknowledgment (Samuel, 16 Nov 2026): what we received and a private link to see it again.
  if (input.acknowledge !== false) {
    const lang: Locale = input.lang === "ja" ? "ja" : "en";
    const a = getDictionary(lang).mail.inquiryAck;
    await trySendMail({
      to: input.email,
      subject: fill(a.subject[input.kind], { reference: id.toUpperCase() }),
      lines: a.lines.map((line) => fill(line, { name: input.name, reference: id.toUpperCase(), link: inquiryLink(lang, token) })),
    });
  }
  return id;
}

export async function getInquiryByToken(token: string): Promise<Inquiry | null> {
  const [row] = await query<Inquiry>(
    `SELECT i.*, COALESCE((SELECT json_agg(json_build_object('id', f.id, 'name', f.name, 'size', f.size)) FROM inquiry_files f WHERE f.inquiry_id = i.id), '[]') AS files
     FROM inquiries i WHERE i.token = $1`,
    [token],
  );
  return row && isKind(row.kind) ? row : null;
}

export async function listInquiries(): Promise<Record<Kind, Inquiry[]>> {
  const rows = await query<Inquiry>(
    `SELECT i.*, COALESCE((SELECT json_agg(json_build_object('id', f.id, 'name', f.name, 'size', f.size)) FROM inquiry_files f WHERE f.inquiry_id = i.id), '[]') AS files
     FROM inquiries i ORDER BY i.created_at DESC LIMIT 400`,
  );
  const out = Object.fromEntries(KINDS.map((k) => [k, [] as Inquiry[]])) as Record<Kind, Inquiry[]>;
  for (const r of rows) if (isKind(r.kind)) out[r.kind].push(r);
  return out;
}

/**
 * Moves an inquiry to a stage. Refuses a stage the kind does not have, and a stage whose checks are not all ticked.
 * Every check keeps the day and the note it was confirmed with. Returns an error message, or null when done.
 */
export async function setStage(id: string, stage: string, ticked: string[], note: string): Promise<string | null> {
  const [row] = await query<Inquiry>(`SELECT * FROM inquiries WHERE id = $1`, [id]);
  if (!row || !isKind(row.kind)) return "Not found.";
  if (!STAGES[row.kind].includes(stage)) return `A ${row.kind} has no stage "${stage}".`;
  if (row.kind === "technician" && stage !== "received" && stage !== "declined" && !row.consent_at) return "No consent on record: ask the qualification and consent questions first.";
  const needed = gateFor(row.kind, stage);
  const checks = { ...row.checks };
  const day = new Date().toISOString().slice(0, 10);
  for (const c of needed) if (ticked.includes(c.key) && !checks[c.key]) checks[c.key] = `${day}${note ? `: ${note}` : ""}`;
  const missing = needed.filter((c) => !checks[c.key]);
  if (missing.length) return `Tick every check first: ${missing.map((c) => c.key).join(", ")}.`;
  await query(`UPDATE inquiries SET stage = $2, stage_at = now(), checks = $3 WHERE id = $1`, [id, stage, JSON.stringify(checks)]);
  await addEvent(id, { kind: "stage", text: `${labelFor(row.kind, row.stage)} -> ${labelFor(row.kind, stage)}${note ? `: ${note}` : ""}` });
  return null;
}

// ------------------------------------------------------------------ activity: contacts, follow-ups, proposals

export const EVENT_KINDS = ["call", "email", "meeting", "note", "followup", "proposal"] as const;
export type EventKind = (typeof EVENT_KINDS)[number] | "stage";
export type InquiryEvent = {
  id: string;
  inquiry_id: string;
  at: Date;
  kind: EventKind;
  text: string;
  due: string | null;
  owner: string;
  amount: string | null;
  done: boolean;
};

export async function addEvent(
  inquiryId: string,
  e: { kind: EventKind; text: string; due?: string | null; owner?: string; amount?: number | null },
): Promise<void> {
  await query(`INSERT INTO inquiry_events (id, inquiry_id, kind, text, due, owner, amount) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
    newId(),
    inquiryId,
    e.kind,
    e.text.slice(0, 2000),
    e.due || null,
    (e.owner ?? "").slice(0, 60),
    e.amount ?? null,
  ]);
}

export async function eventsFor(ids: string[]): Promise<Record<string, InquiryEvent[]>> {
  if (!ids.length) return {};
  const rows = await query<InquiryEvent>(
    `SELECT id, inquiry_id, at, kind, text, to_char(due, 'YYYY-MM-DD') AS due, owner, amount::text AS amount, done FROM inquiry_events WHERE inquiry_id = ANY($1) ORDER BY at DESC`,
    [ids],
  );
  const out: Record<string, InquiryEvent[]> = {};
  for (const r of rows) (out[r.inquiry_id] ??= []).push(r);
  return out;
}

/** Open follow-ups, soonest first, with the company or person they are about. */
export async function openFollowups(): Promise<(InquiryEvent & { who: string; kind_of: Kind })[]> {
  return query(
    `SELECT e.id, e.inquiry_id, e.at, e.kind, e.text, to_char(e.due, 'YYYY-MM-DD') AS due, e.owner, e.amount::text AS amount, e.done,
            COALESCE(NULLIF(i.company, ''), i.name) AS who, i.kind AS kind_of
     FROM inquiry_events e JOIN inquiries i ON i.id = e.inquiry_id
     WHERE e.kind = 'followup' AND NOT e.done ORDER BY e.due NULLS LAST, e.at LIMIT 100`,
  );
}

export async function completeEvent(id: string): Promise<void> {
  await query(`UPDATE inquiry_events SET done = true WHERE id = $1`, [id]);
}

// ------------------------------------------------------------------ the next action on an employer lead (22 Nov 2026)

/** What to do next at each employer stage, for whoever works the pipeline (Samuel or a VA). */
const EMPLOYER_NEXT: Record<string, string> = {
  received: "Make first contact within one business day: confirm the role is open and funded, and book a call.",
  contacted: "Qualify the vacancy: open and funded, headcount, first-year base pay, start date, who signs. Then Qualified Vacancy.",
  qualifying: "Discuss terms: send ittsuiworks.com/deal (25% of first-year base pay, 90-day replacement, Net 15) and the written agreement. Then Terms Discussion.",
  proposal: "Get the agreement signed (the /deal order or the 1-page agreement). No candidate name, photo or contact before it is signed.",
  matching: "Earlier stage: get the agreement signed before anyone is introduced, then Signed Agreement.",
  agreement: "Shortlist Verified candidates for the role. Ask each one for a yes to this employer by name before sharing who they are.",
  introduced: "Book the interviews and log each one.",
  interview: "Get the decision. On an offer, confirm the start date and first-year base pay in writing, then Hire.",
  hired: "Invoice from the start date: 25% of first-year base pay, due in 15 days (the deal order's Mercury button, or by hand in Mercury). Then Invoice.",
  invoiced: "Check the payment arrives within 15 days (it keeps the 90-day replacement) and diary a check-in before day 90.",
  in_progress: "Earlier stage: move it to the step it is really at (Hire or Invoice).",
  completed: "Earlier stage: move it to Invoice or Repeat Customer.",
  repeat: "Ask for the next open role.",
};

/**
 * The next action on an employer lead, and what needs attention: an overdue follow-up, or none planned at all.
 * Null for a lead that is Lost.
 */
export function nextAction(row: Pick<Inquiry, "kind" | "stage" | "checks" | "email">, events: InquiryEvent[], today: string): { text: string; warn: string } | null {
  if (row.kind !== "talent_request" || row.stage === "lost") return null;
  const open = events.filter((e) => e.kind === "followup" && !e.done).sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
  const overdue = open.find((e) => e.due && e.due < today);
  const early = row.stage === "received" || row.stage === "contacted";
  const warn = overdue
    ? `Follow-up overdue since ${overdue.due}: ${overdue.text}`
    : open.length === 0
      ? "No follow-up planned: add one with Log activity, kind Follow-up, and a due date."
      : early && !row.checks.vacancy
        ? "Verify the vacancy below to open the two email drafts."
        : "";
  return { text: EMPLOYER_NEXT[row.stage] ?? "Move it to the stage it is at.", warn };
}

export async function getFile(id: string): Promise<{ name: string; type: string; data: Buffer } | null> {
  const [row] = await query<{ name: string; type: string; data: Buffer }>(`SELECT name, type, data FROM inquiry_files WHERE id = $1`, [id]);
  return row ?? null;
}

export async function pipelineStats(): Promise<Record<string, number>> {
  const rows = await query<{ kind: string; stage: string; n: number }>(`SELECT kind, stage, count(*)::int AS n FROM inquiries GROUP BY 1, 2`);
  return Object.fromEntries(rows.map((r) => [`${r.kind}:${r.stage}`, r.n]));
}
