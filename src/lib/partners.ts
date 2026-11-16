/**
 * Technician profiles (Samuel, 17 November 2026: "list all active partners, hide their names; a client clicks a
 * partner, which notifies us and the partner").
 *
 * Consent first (his 16 November rule "do not repurpose Indeed records" stays true): an invited profile holds only
 * the anonymous card (ID, trade, city, state, certifications as written on the resume). No name, email or phone of
 * an invited person is stored here. The person becomes ACTIVE only by confirming through their own link and typing
 * their own details, which go into their pipeline entry (a technician application with consent). Only active
 * profiles are public, without name, photo or contact.
 */
import "server-only";
import { randomBytes } from "node:crypto";
import type { SourcingTrade } from "./config";
import { newToken, query } from "./db";
import { trySendMail } from "./mail";
import { addEvent, createInquiry } from "./pipeline";
import { EMAIL, SITE_URL } from "./site";

/**
 * The email to a technician when a client asks for their profile. OFF until Samuel approves these words: while
 * `notify` is false only the inbox is told. Values: {first} {city} {id} {role}.
 */
export const PARTNERS = {
  notify: false,
  mail: {
    subject: "An employer asked for your profile ({role}, {city})",
    lines: [
      "Hello {first},",
      "",
      "A commercial employer in {city} asked for your Ittsui Works profile ({id}) for this role: {role}.",
      "Reply YES to this email if you would like us to introduce you. Nothing about you is shared before you say yes.",
      "",
      "Ittsui Works recruiting team",
      "--",
      "Ittsui Works is a private personnel service operated by Kuchimoto LLC, 30 N Gould St, Ste R, Sheridan, WY 82801, USA.",
    ],
  },
} as const;

/** What a technician agrees to when confirming their profile. */
export const DIRECTORY_CONSENT =
  "This profile is mine. I agree to Ittsui Works listing it anonymously (no name, photo or contact details) at ittsuiworks.com/technicians and contacting me when an employer asks for it. I am introduced to an employer only after I say yes.";

export type PartnerStatus = "invited" | "active" | "hidden";
export type Partner = {
  id: string;
  created_at: string;
  status: PartnerStatus;
  token: string | null;
  trade: string;
  city: string;
  state: string;
  certs: string;
  source: string;
  inquiry_id: string | null;
  confirmed_at: string | null;
};
export type PublicPartner = Pick<Partner, "id" | "trade" | "city" | "state" | "certs">;

export const isPartnerId = (value: string) => /^IW-[0-9A-F]{6}$/.test(value);
export const TRADE_LABEL: Record<string, string> = {
  hvac: "HVAC technician",
  electrical: "Electrician",
  datacenter: "Data center technician",
  marine: "Marine technician",
};
export const tradeLabel = (trade: string) => TRADE_LABEL[trade] ?? "Technician";
export const headline = (p: Pick<Partner, "trade" | "city" | "state">) => `${tradeLabel(p.trade)} · ${[p.city, p.state].filter(Boolean).join(", ") || "US"}`;
export const certList = (certs: string) =>
  certs
    .split(/[,;]/)
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 8);

/** A small CSV reader (quoted cells, doubled quotes, a byte-order mark). */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const tradeFrom = (label: string): string => (/hvac|refrigerat|air.?condition|heat pump|mechanical/i.test(label) ? "hvac" : /electric/i.test(label) ? "electrical" : "");

/**
 * The anonymous preview CSV (Partner ID, Headline, Trade, City, State, Certifications, Status): one invited profile per
 * row, each with its own confirm token. Rows already loaded are left as they are. Any other column is ignored, so a
 * name or contact column pasted by mistake is never stored. Returns how many were added and how many were skipped.
 */
export async function loadInvited(csv: string): Promise<{ added: number; skipped: number }> {
  const rows = parseCsv(csv);
  if (!rows.length) return { added: 0, skipped: 0 };
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (re: RegExp, fallback: number) => {
    const i = head.findIndex((h) => re.test(h));
    return i >= 0 ? i : fallback;
  };
  const hasHeader = head.some((h) => /partner id/.test(h));
  const [ci, ct, cc, cs, cx] = [col(/partner id/, 0), col(/^trade/, 2), col(/^city$/, 3), col(/^state$/, 4), col(/^certif/, 5)];
  let added = 0;
  let skipped = 0;
  for (const r of hasHeader ? rows.slice(1) : rows) {
    const id = (r[ci] ?? "").trim().toUpperCase();
    const state = (r[cs] ?? "").trim().toUpperCase();
    if (!isPartnerId(id)) {
      skipped++;
      continue;
    }
    const inserted = await query(
      `INSERT INTO partners (id, status, token, trade, city, state, certs, source) VALUES ($1, 'invited', $2, $3, $4, $5, $6, 'indeed-resume')
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [id, newToken(), tradeFrom(r[ct] ?? ""), (r[cc] ?? "").trim().slice(0, 80), /^[A-Z]{2}$/.test(state) ? state : "", (r[cx] ?? "").trim().slice(0, 300)],
    );
    if (inserted.length) added++;
    else skipped++;
  }
  return { added, skipped };
}

export async function listActive(filter: { trade?: string; state?: string } = {}): Promise<PublicPartner[]> {
  return query<PublicPartner>(
    `SELECT id, trade, city, state, certs FROM partners WHERE status = 'active'
       AND ($1::text IS NULL OR trade = $1) AND ($2::text IS NULL OR state = $2)
     ORDER BY confirmed_at DESC NULLS LAST, id`,
    [filter.trade || null, filter.state || null],
  );
}

export async function activeStates(): Promise<string[]> {
  return (await query<{ state: string }>(`SELECT DISTINCT state FROM partners WHERE status = 'active' AND state <> '' ORDER BY state`)).map((r) => r.state);
}

export async function getPartner(id: string): Promise<Partner | null> {
  if (!isPartnerId(id)) return null;
  const [row] = await query<Partner>(`SELECT * FROM partners WHERE id = $1`, [id]);
  return row ?? null;
}

export async function getPartnerByToken(token: string): Promise<Partner | null> {
  const [row] = await query<Partner>(`SELECT * FROM partners WHERE token = $1`, [token]);
  return row ?? null;
}

export type AdminPartner = Partner & { requests: number };
export async function listPartners(): Promise<AdminPartner[]> {
  return query<AdminPartner>(
    `SELECT p.*, (SELECT count(*)::int FROM inquiries i WHERE i.kind = 'talent_request' AND i.data->>'Requested technician' = p.id) AS requests
     FROM partners p ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'invited' THEN 1 ELSE 2 END, p.id`,
  );
}

export const confirmLink = (token: string) => `${SITE_URL}/partner/${token}`;

/** Listing on or off for a profile whose owner confirmed (an invited profile cannot be listed by hand). */
export async function setPartnerStatus(id: string, status: "active" | "hidden"): Promise<boolean> {
  const rows = await query(`UPDATE partners SET status = $2 WHERE id = $1 AND inquiry_id IS NOT NULL AND status IN ('active', 'hidden') RETURNING id`, [id, status]);
  return rows.length > 0;
}

const newPartnerId = () => `IW-${randomBytes(3).toString("hex").toUpperCase()}`;

/** A /join applicant who gave consent, listed anonymously from the admin page. */
export async function listFromInquiry(inquiryId: string): Promise<string | null> {
  const [inq] = await query<{ id: string; kind: string; place: string; trades: string[]; data: Record<string, string>; consent_at: string | null }>(
    `SELECT id, kind, place, trades, data, consent_at FROM inquiries WHERE id = $1`,
    [inquiryId],
  );
  if (!inq || inq.kind !== "technician" || !inq.consent_at) return null;
  const [existing] = await query<{ id: string }>(`SELECT id FROM partners WHERE inquiry_id = $1`, [inquiryId]);
  if (existing) return existing.id;
  const [city, state] = inq.place.split(",").map((s) => s.trim());
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = newPartnerId();
    const rows = await query(
      `INSERT INTO partners (id, status, trade, city, state, certs, source, inquiry_id, confirmed_at) VALUES ($1, 'active', $2, $3, $4, $5, 'join', $6, $7)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [id, inq.trades[0] ?? "", (city ?? "").slice(0, 80), /^[A-Za-z]{2}$/.test(state ?? "") ? state.toUpperCase() : "", (inq.data["Licenses and certifications"] ?? "").slice(0, 300), inquiryId, inq.consent_at],
    );
    if (rows.length) return id;
  }
  return null;
}

export type Confirmation = {
  name: string;
  email: string;
  phone: string;
  trade: SourcingTrade;
  city: string;
  state: string;
  certs: string;
  years: string;
  rate: string;
  available: string;
};

/**
 * The invited technician confirms: their own details go into a technician application (consent recorded, stage
 * Qualification Pending, the usual acknowledgment with their private link), and the profile becomes active.
 * Returns false when the link was already used.
 */
export async function confirmInvite(partner: Partner, c: Confirmation): Promise<boolean> {
  const [claimed] = await query<{ id: string }>(`UPDATE partners SET status = 'active', confirmed_at = now() WHERE id = $1 AND status = 'invited' RETURNING id`, [partner.id]);
  if (!claimed) return false;
  const inquiryId = await createInquiry({
    kind: "technician",
    source: "invite",
    stage: "qualified",
    name: c.name,
    email: c.email,
    phone: c.phone,
    company: "",
    country: "US",
    place: `${c.city}, ${c.state}`,
    trades: [c.trade],
    lang: "en",
    consentText: DIRECTORY_CONSENT,
    data: {
      "Partner ID": partner.id,
      "Licenses and certifications": c.certs,
      "Years of commercial experience": c.years,
      "Target rate": c.rate,
      "Earliest availability": c.available,
    },
  });
  await query(`UPDATE partners SET inquiry_id = $2, trade = $3, city = $4, state = $5, certs = $6 WHERE id = $1`, [partner.id, inquiryId, c.trade, c.city, c.state, c.certs]);
  return true;
}

/**
 * A client asked for a technician: the request itself is already in the pipeline (a technician request with
 * "Requested technician"). This tells the inbox who the technician is (private details stay out of the client's
 * page) and, only once Samuel switches it on, asks the technician whether they want to be introduced.
 */
export async function notifyRequest(partner: Partner, request: { reference: string; company: string; role: string; place: string }): Promise<void> {
  const [tech] = partner.inquiry_id
    ? await query<{ id: string; name: string; email: string; phone: string; place: string }>(`SELECT id, name, email, phone, place FROM inquiries WHERE id = $1`, [partner.inquiry_id])
    : [];
  const emailed = PARTNERS.notify && Boolean(tech?.email);
  await trySendMail({
    subject: `TECHNICIAN ASKED FOR: ${partner.id} by ${request.company}, ${request.role}`.slice(0, 180),
    lines: [
      `${request.company} asked for technician ${partner.id} (${headline(partner)}) for: ${request.role}, at ${request.place}.`,
      `Client request: reference ${request.reference.toUpperCase()} (admin page, Technician requests).`,
      tech ? `Technician (private): ${tech.name}, ${tech.email || "no email"}, ${tech.phone || "no phone"}, ${tech.place}. Pipeline reference ${tech.id.toUpperCase()}.` : "Technician: no pipeline entry found.",
      "",
      "Next: ask the technician whether they want to be introduced, then agree the terms with the client in writing. Nobody is introduced before both.",
      emailed ? "The technician was emailed and asked to reply YES." : "The technician was NOT emailed: the technician email is off until Samuel approves its words (admin page).",
    ],
  });
  if (emailed && tech) {
    const values: Record<string, string> = { first: tech.name.split(/\s+/)[0] || "there", city: request.place, id: partner.id, role: request.role };
    const fillIn = (s: string) => s.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? "");
    await trySendMail({ to: tech.email, replyTo: EMAIL, subject: fillIn(PARTNERS.mail.subject), lines: PARTNERS.mail.lines.map(fillIn) });
  }
}

/**
 * An Indeed lead replied YES in Indeed Messages (Samuel, 17 November 2026: "their YES in Indeed is enough"). One click
 * on the admin page records the consent with the exact question they answered, moves them to Qualification Pending and
 * turns their anonymous card on. Nobody is emailed. Returns the profile ID, or null when there is nothing to do.
 */
export async function saidYes(inquiryId: string, day: string): Promise<string | null> {
  const [inq] = await query<{ id: string; kind: string; source: string; data: Record<string, string>; consent_at: string | null }>(
    `SELECT id, kind, source, data, consent_at FROM inquiries WHERE id = $1`,
    [inquiryId],
  );
  if (!inq || inq.kind !== "technician" || inq.source !== "indeed-resume" || inq.consent_at || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const question = inq.data["Message (one line)"] || "Can we send your profile to employers hiring in your area?";
  const consent = `Said YES in Indeed Messages on ${day} to: "${question}"`;
  const [updated] = await query<{ id: string }>(
    `UPDATE inquiries SET consent_at = ($2::date + time '12:00') AT TIME ZONE 'UTC', consent_text = $3, stage = 'qualified', stage_at = now()
     WHERE id = $1 AND consent_at IS NULL RETURNING id`,
    [inquiryId, day, consent],
  );
  if (!updated) return null;
  await addEvent(inquiryId, { kind: "note", text: consent });
  const partnerId = (inq.data["Partner ID"] ?? "").toUpperCase();
  if (isPartnerId(partnerId)) {
    const [card] = await query<{ id: string }>(
      `UPDATE partners SET status = 'active', inquiry_id = $2, confirmed_at = now() WHERE id = $1 AND status = 'invited' RETURNING id`,
      [partnerId, inquiryId],
    );
    if (card) return card.id;
  }
  return listFromInquiry(inquiryId);
}
