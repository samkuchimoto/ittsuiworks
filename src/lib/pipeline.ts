/**
 * The sourcing pipeline (Samuel, 16 November 2026). Every request, project and application lands here and in the
 * inbox. Nothing is charged and nobody is introduced automatically: a person confirms the agreement, the state license
 * and the insurance before any engagement, and presents a technician only after verification and with consent.
 *
 * People (technician, partner):  received -> qualified (stage 1) -> verified (stage 2), or declined.
 *   Stage 1 "Qualified, verification pending": answered the qualification questions and gave consent.
 *   Stage 2 "Verified, ready to pitch": license number, identity and work history checked by a person.
 * Clients (talent_request, project): received -> review -> engaged, or closed.
 *   "Engaged" only once a written agreement is signed (and, for a project, the partner's license and insurance checked).
 */
import "server-only";
import { countryName } from "./countries";
import { newId, query } from "./db";
import { trySendMail } from "./mail";

export const KINDS = ["talent_request", "project", "technician", "partner"] as const;
export type Kind = (typeof KINDS)[number];
export const isKind = (v: string): v is Kind => (KINDS as readonly string[]).includes(v);

export const STAGES: Record<Kind, readonly string[]> = {
  technician: ["received", "qualified", "verified", "declined"],
  partner: ["received", "qualified", "verified", "declined"],
  talent_request: ["received", "review", "engaged", "closed"],
  project: ["received", "review", "engaged", "closed"],
};

export const STAGE_LABEL: Record<string, string> = {
  received: "Received, not screened",
  qualified: "Stage 1 · Qualified, verification pending",
  verified: "Stage 2 · Verified and ready to pitch",
  declined: "Declined",
  review: "In review (agreement and checks pending)",
  engaged: "Engaged (agreement signed, checks confirmed)",
  closed: "Closed",
};

export const KIND_LABEL: Record<Kind, string> = {
  talent_request: "Technician requests (employers)",
  project: "Commercial projects (owners, GCs)",
  technician: "Technician applications",
  partner: "Trade partner applications",
};

/** What a person must confirm before each stage. The admin form shows one box per check. */
export const CHECKS: Record<string, { key: string; label: string }[]> = {
  "technician:verified": [
    { key: "license", label: "License or certification number checked on the issuing authority's public lookup (TDLR, DBPR, EPA 608 card...)" },
    { key: "identity", label: "Identity checked (name matches the license and an ID)" },
    { key: "history", label: "Work history checked (a past employer or client confirmed)" },
  ],
  "partner:verified": [
    { key: "license", label: "State contractor license checked on the state's public lookup, active, right trade" },
    { key: "insurance", label: "Certificates of liability and workers' comp insurance seen, in date" },
  ],
  "talent_request:engaged": [{ key: "agreement", label: "Written placement agreement signed (fee, guarantee, payment terms)" }],
  "project:engaged": [
    { key: "agreement", label: "Written referral agreement signed with the licensed contractor" },
    { key: "license", label: "The contractor's state license checked for this trade and place" },
    { key: "insurance", label: "The contractor's liability and workers' comp certificates seen" },
  ],
};

/** The consent a technician gives on the site (Samuel's words), stored with the application. */
export const TECH_CONSENT_EN = "I consent to Ittsui Works storing my application and presenting my profile to hiring employers and commercial contractors upon qualification.";

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
  files?: { id: string; name: string; size: number }[];
};

export type NewInquiry = Pick<Inquiry, "kind" | "name" | "email" | "phone" | "company" | "country" | "place" | "trades" | "data" | "lang"> & {
  source?: string;
  consentText?: string;
  consentAt?: Date;
  stage?: string;
};

export type Upload = { name: string; type: string; bytes: Buffer };

const SUBJECT: Record<Kind, string> = {
  talent_request: "TECHNICIAN REQUEST",
  project: "COMMERCIAL PROJECT",
  technician: "TECHNICIAN APPLICATION",
  partner: "TRADE PARTNER",
};

const NEXT_STEP: Record<Kind, string> = {
  talent_request: "Next: reply to agree the role and the fee in writing. No technician is introduced before a signed agreement.",
  project: "Next: confirm scope and size, then match a licensed partner. Agreement, license and insurance checks before any introduction.",
  technician: "Next: screen (stage 1), then verify license, identity and work history (stage 2) before presenting the profile.",
  partner: "Next: check the state license and the insurance certificates before sending any project.",
};

/** Stores a submission (and its file), then tells the inbox. Returns the new id. */
export async function createInquiry(input: NewInquiry, file?: Upload | null): Promise<string> {
  const id = newId();
  const consentAt = input.consentText ? (input.consentAt ?? new Date()) : null;
  await query(
    `INSERT INTO inquiries (id, kind, source, name, email, phone, company, country, place, trades, data, consent_at, consent_text, stage, lang)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [id, input.kind, input.source ?? "site", input.name, input.email, input.phone, input.company, input.country, input.place, input.trades, JSON.stringify(input.data), consentAt, input.consentText ?? "", input.stage ?? "received", input.lang],
  );
  if (file) {
    await query(`INSERT INTO inquiry_files (id, inquiry_id, name, type, size, data) VALUES ($1, $2, $3, $4, $5, $6)`, [newId(), id, file.name.slice(0, 120), file.type, file.bytes.length, file.bytes]);
  }
  const who = input.company ? `${input.company} (${input.name})` : input.name;
  const where = [input.place, countryName(input.country)].filter(Boolean).join(", ");
  await trySendMail({
    subject: `${SUBJECT[input.kind]}: ${who}, ${input.trades.join("/")}, ${where}`.slice(0, 180),
    replyTo: input.email,
    lines: [
      ...[
        `${SUBJECT[input.kind]} (${input.source ?? "site"}, ${input.lang})`,
        `Name: ${input.name}`,
        input.company ? `Company: ${input.company}` : "",
        `Email: ${input.email}`,
        `Phone: ${input.phone || "not given"}`,
        `Place: ${where}`,
        `Trades: ${input.trades.join(", ")}`,
        ...Object.entries(input.data).map(([k, v]) => `${k}: ${v || "not given"}`),
        file ? `File: ${file.name} (${Math.round(file.bytes.length / 1024)} KB), on the admin page` : "",
        input.consentText ? `Consent: "${input.consentText}" (${(consentAt ?? new Date()).toISOString()})` : "",
      ].filter(Boolean),
      "",
      NEXT_STEP[input.kind],
      "Reply to this email to answer them directly.",
    ],
  });
  return id;
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
  if (row.kind === "technician" && (stage === "qualified" || stage === "verified") && !row.consent_at) return "No consent on record: ask the qualification and consent questions first.";
  const needed = CHECKS[`${row.kind}:${stage}`] ?? [];
  const checks = { ...row.checks };
  const day = new Date().toISOString().slice(0, 10);
  for (const c of needed) if (ticked.includes(c.key) && !checks[c.key]) checks[c.key] = `${day}${note ? `: ${note}` : ""}`;
  const missing = needed.filter((c) => !checks[c.key]);
  if (missing.length) return `Tick every check first: ${missing.map((c) => c.key).join(", ")}.`;
  const notes = note ? `${row.notes ? `${row.notes}\n` : ""}${day} ${stage}: ${note}`.slice(-4000) : row.notes;
  await query(`UPDATE inquiries SET stage = $2, stage_at = now(), checks = $3, notes = $4 WHERE id = $1`, [id, stage, JSON.stringify(checks), notes]);
  return null;
}

export async function getFile(id: string): Promise<{ name: string; type: string; data: Buffer } | null> {
  const [row] = await query<{ name: string; type: string; data: Buffer }>(`SELECT name, type, data FROM inquiry_files WHERE id = $1`, [id]);
  return row ?? null;
}

export async function pipelineStats(): Promise<Record<string, number>> {
  const rows = await query<{ kind: string; stage: string; n: number }>(`SELECT kind, stage, count(*)::int AS n FROM inquiries GROUP BY 1, 2`);
  return Object.fromEntries(rows.map((r) => [`${r.kind}:${r.stage}`, r.n]));
}
