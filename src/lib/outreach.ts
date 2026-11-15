/**
 * Automatic outreach to trade companies. Each daily run:
 *  1. Finds companies: one public source per run (OpenStreetMap HVAC firms, shipyards and data centers; PeeringDB
 *     data center facilities), rotating through the outreach countries. Admin CSV imports join the same queue.
 *  2. Reads each company's own website for a business email it publishes there. Skips sites that ask for no
 *     unsolicited email, sites closed to robots, and addresses on the stop list.
 *  3. Sends the approved emails (outreach-texts.ts) from a separate mailbox over SMTP, a few a day at first, more
 *     each day. Follow-ups go only when replies can be read (IMAP), and stop at the first reply or bounce.
 *
 * Sending is OFF unless OUTREACH_LIVE=on and OUTREACH_SMTP_URL, OUTREACH_FROM and OUTREACH_POSTAL_ADDRESS are set.
 * Steps 1 and 2 run anyway once the database exists, so a ready queue is waiting when it is switched on.
 * Never sent through Resend: its acceptable use policy forbids cold email.
 */
import "server-only";
import { fill } from "@/content";
import { LEAD_SLOTS, OUTREACH, TRADES, isTrade, outreachQuota } from "./config";
import { countryName, isCountry } from "./countries";
import { getState, hasDatabase, newId, query, releaseLock, setState, takeLock } from "./db";
import { trySendMail } from "./mail";
import { inviteToLead, withdrawInvite, type Project } from "./market";
import { LEAD_IN_HAND_TEXTS, OPERATOR_TEXTS, OUTREACH_TEXTS } from "./outreach-texts";
import { EMAIL, SITE_URL, pathFor } from "./site";

const UA = "IttsuiWorksBot/1.0 (+https://ittsuiworks.com)";

export type Prospect = {
  id: string;
  source: string;
  company: string;
  website: string;
  domain: string;
  email: string | null;
  country: string;
  trade: string;
  lang: string;
  status: "new" | "ready" | "sent" | "replied" | "bounced" | "unsubscribed" | "done" | "skipped";
  step: number;
  next_at: Date | null;
  last_sent_at: Date | null;
  note: string;
  lead_offered_at?: Date | null;
};

/**
 * Facility operators: data centers listed on PeeringDB or OpenStreetMap. They buy cooling and power work, so they
 * get the buyer emails (OPERATOR_TEXTS), never the contractor ones, and are never offered a lead.
 */
const OPERATOR_SQL = `(p.source = 'peeringdb' OR (p.source = 'osm' AND p.trade = 'datacenter'))`;
export const isOperator = (p: Pick<Prospect, "source" | "trade">) => p.source === "peeringdb" || (p.source === "osm" && p.trade === "datacenter");

export function outreachCountries(): string[] {
  const list = (process.env.OUTREACH_COUNTRIES ?? "").split(",").map((c) => c.trim().toUpperCase()).filter(isCountry);
  return list.length ? list : [...OUTREACH.defaultCountries];
}

export function outreachConfig() {
  const live = process.env.OUTREACH_LIVE === "on";
  const smtp = Boolean(process.env.OUTREACH_SMTP_URL && process.env.OUTREACH_FROM);
  const address = Boolean(process.env.OUTREACH_POSTAL_ADDRESS);
  const imap = Boolean(process.env.OUTREACH_IMAP_URL);
  // Each new kind of email waits for Samuel's approval of its words (outreach-texts.ts), then one Vercel switch.
  const leadOffers = process.env.OUTREACH_LEAD_OFFERS === "on";
  const operators = process.env.OUTREACH_OPERATORS === "on";
  return { live, smtp, address, imap, sending: live && smtp && address, leadOffers, operators, countries: outreachCountries() };
}

// ------------------------------------------------------------------ domains and emails

const SECOND_LEVEL = new Set(["co", "com", "net", "org", "ne", "or", "ac", "go", "gov", "edu", "ltd", "plc"]);
/** example.co.jp -> example.co.jp, www.shop.example.com -> example.com */
export function baseDomain(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const tld = parts.at(-1)!;
  const sld = parts.at(-2)!;
  return tld.length === 2 && SECOND_LEVEL.has(sld) ? parts.slice(-3).join(".") : parts.slice(-2).join(".");
}

function siteUrl(raw: string): URL | null {
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.hostname.includes(".") ? url : null;
  } catch {
    return null;
  }
}

const ROLE = ["info", "contact", "sales", "office", "service", "hello", "inquiry", "enquiries", "inquiries", "support", "admin", "jobs", "careers", "recruit", "hr", "mail"];
const JUNK = /\.(png|jpe?g|gif|webp|svg|css|js)$|^(no-?reply|donotreply|privacy|abuse|postmaster|webmaster|example)@|sentry|wixpress|example\.com|domain\.com|godaddy/i;
const REFUSES = /(no|not|without)\W{0,3}(unsolicited|solicitation)|unsolicited[^.]{0,60}(not|prohibited|refuse)|営業[^。]{0,20}(お断り|ご遠慮|禁止|控え)|(お断り|ご遠慮)[^。]{0,20}営業|迷惑メール[^。]{0,10}お断り/i;

/** The best business address a site publishes on its own domain: role addresses first. */
export function pickEmail(html: string, domain: string): string | null {
  const found = new Set<string>();
  const decoded = html.replace(/&#64;|&#x40;|\[at\]|\(at\)/gi, "@").replace(/%40/g, "@");
  for (const m of decoded.matchAll(/[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}/g)) {
    const email = m[0].toLowerCase().replace(/^mailto:/, "");
    if (JUNK.test(email)) continue;
    if (baseDomain(email.split("@")[1]) !== domain) continue;
    found.add(email);
  }
  const list = [...found];
  return list.find((e) => ROLE.includes(e.split("@")[0].split(/[.+-]/)[0])) ?? list[0] ?? null;
}

async function fetchText(url: string, max = 600_000): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,text/plain" }, redirect: "follow", signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("text/html") && !type.includes("text/plain")) return null;
    return (await res.text()).slice(0, max);
  } catch {
    return null;
  }
}

/** True when robots.txt closes the whole site to every robot (or to us). */
async function robotsClosed(origin: string): Promise<boolean> {
  const txt = await fetchText(`${origin}/robots.txt`, 50_000);
  if (!txt) return false;
  let applies = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (/^user-agent$/i.test(key)) applies = value === "*" || /ittsuiworks/i.test(value);
    else if (applies && /^disallow$/i.test(key) && value === "/") return true;
  }
  return false;
}

/** Reads a company's own site (home page, then a contact or about page) for a published business email. */
export async function findEmail(website: string): Promise<{ email: string | null; note: string }> {
  const url = siteUrl(website);
  if (!url) return { email: null, note: "bad website" };
  const domain = baseDomain(url.hostname);
  if (await robotsClosed(url.origin)) return { email: null, note: "robots.txt closed" };
  const home = await fetchText(url.origin);
  if (!home) return { email: null, note: "site did not load" };
  if (REFUSES.test(home)) return { email: null, note: "asks for no unsolicited email" };
  let email = pickEmail(home, domain);
  if (!email) {
    const links = [...home.matchAll(/href="([^"#]+)"/gi)]
      .map((m) => m[1])
      .filter((h) => /contact|kontakt|inquiry|enquiry|about|company|toiawase|otoiawase|お問い合わせ|会社概要/i.test(h))
      .slice(0, 2);
    for (const href of links) {
      let next: URL;
      try {
        next = new URL(href, url.origin);
      } catch {
        continue;
      }
      if (baseDomain(next.hostname) !== domain) continue;
      const page = await fetchText(next.href);
      if (!page) continue;
      if (REFUSES.test(page)) return { email: null, note: "asks for no unsolicited email" };
      email = pickEmail(page, domain);
      if (email) break;
    }
  }
  return { email, note: email ? "found on own site" : "no email on site" };
}

// ------------------------------------------------------------------ discovery

type Found = { company: string; website: string; country: string; trade: string; source: string };

const OSM_QUERIES: Record<string, string[]> = {
  hvac: [`nwr["craft"="hvac"]["website"](area.a);`, `nwr["craft"="hvac"]["contact:website"](area.a);`],
  marine: [`nwr["industrial"="shipyard"]["website"](area.a);`, `nwr["craft"="boatbuilder"]["website"](area.a);`],
  datacenter: [`nwr["telecom"="data_center"]["website"](area.a);`, `nwr["building"="data_center"]["website"](area.a);`],
};

/** Public Overpass servers. The main one is often at capacity, so a mirror is tried next. */
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"];

/** Companies from OpenStreetMap; null when every server was busy (the same source is tried again next run). */
async function fromOsm(country: string, trade: string): Promise<Found[] | null> {
  const body = `[out:json][timeout:38];area["ISO3166-1"="${country}"][admin_level=2]->.a;(${OSM_QUERIES[trade].join("")});out tags 400;`;
  for (const endpoint of OVERPASS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(body)}`,
        signal: AbortSignal.timeout(40_000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { elements?: { tags?: Record<string, string> }[]; remark?: string };
      if (json.remark && !json.elements?.length) continue;
      return (json.elements ?? [])
        .map((e) => e.tags ?? {})
        .map((tags) => ({ company: tags.name ?? tags.operator ?? "", website: tags.website ?? tags["contact:website"] ?? "", country, trade, source: "osm" }))
        .filter((f) => f.company && f.website);
    } catch {
      // Busy or slow: try the next server.
    }
  }
  return null;
}

async function fromPeeringDb(country: string): Promise<Found[] | null> {
  try {
    const res = await fetch(`https://www.peeringdb.com/api/fac?country=${country}&status=ok`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { name?: string; org_name?: string; website?: string }[] };
    return (json.data ?? [])
      .map((f) => ({ company: f.org_name || f.name || "", website: f.website ?? "", country, trade: "datacenter", source: "peeringdb" }))
      .filter((f) => f.company && f.website);
  } catch {
    return null;
  }
}

/** Adds companies to the queue, one per website domain. Returns how many were new. */
export async function addProspects(found: (Found & { email?: string })[]): Promise<number> {
  let added = 0;
  for (const f of found) {
    const url = siteUrl(f.website) ?? (f.email ? siteUrl(f.email.split("@")[1]) : null);
    if (!url || !isCountry(f.country) || !isTrade(f.trade)) continue;
    const domain = baseDomain(url.hostname);
    const email = f.email && baseDomain(f.email.split("@")[1] ?? "") === domain ? f.email.toLowerCase() : null;
    const rows = await query(
      `INSERT INTO prospects (id, source, company, website, domain, email, country, trade, lang, status, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (domain) DO NOTHING RETURNING id`,
      [newId(), f.source, f.company.slice(0, 160), url.origin, domain, email, f.country, f.trade, f.country === "JP" ? "ja" : "en", email ? "ready" : "new", email ? "imported" : ""],
    );
    added += rows.length;
  }
  return added;
}

/**
 * One source a day, rotating through countries x (OSM hvac, OSM data centers, OSM marine, PeeringDB).
 * When OpenStreetMap is busy, the same source waits for the next run and PeeringDB fills in, so every run adds.
 */
async function discover(): Promise<{ source: string; found: number; added: number; busy?: boolean }> {
  const countries = outreachCountries();
  const sources = [...TRADES.map((t) => `osm:${t}`), "peeringdb"];
  const cursor = (await getState<number>("outreach:cursor")) ?? 0;
  const country = countries[Math.floor(cursor / sources.length) % countries.length];
  const source = sources[cursor % sources.length];
  const found = source === "peeringdb" ? await fromPeeringDb(country) : await fromOsm(country, source.split(":")[1]);
  if (found === null && source !== "peeringdb") {
    const backup = (await fromPeeringDb(country)) ?? [];
    return { source: `${source} ${country} busy, peeringdb ${country}`, found: backup.length, added: await addProspects(backup), busy: true };
  }
  await setState("outreach:cursor", (cursor + 1) % (countries.length * sources.length));
  return { source: `${source} ${country}`, found: found?.length ?? 0, added: await addProspects(found ?? []) };
}

async function enrich(deadline: number): Promise<number> {
  const queue = await query<Prospect>(`SELECT * FROM prospects WHERE status = 'new' ORDER BY created_at LIMIT $1`, [OUTREACH.enrichPerRun]);
  let ready = 0;
  for (const p of queue) {
    // Each website takes up to ~12 s; stop in time for the function limit (maxDuration in the cron route).
    if (Date.now() > deadline - 12_000) break;
    const { email, note } = await findEmail(p.website);
    const stopped = email ? (await query(`SELECT 1 FROM suppression WHERE email = $1`, [email])).length > 0 : false;
    await query(`UPDATE prospects SET email = $2, status = $3, note = $4 WHERE id = $1`, [p.id, email, email && !stopped ? "ready" : "skipped", stopped ? "on the stop list" : note]);
    if (email && !stopped) ready++;
  }
  return ready;
}

// ------------------------------------------------------------------ replies and bounces

/** Marks prospects who replied (or whose email bounced), so no follow-up reaches them. */
async function readReplies(): Promise<{ replied: number; bounced: number }> {
  const url = process.env.OUTREACH_IMAP_URL;
  if (!url) return { replied: 0, bounced: 0 };
  const { ImapFlow } = await import("imapflow");
  const u = new URL(url);
  const client = new ImapFlow({
    host: u.hostname,
    port: Number(u.port || 993),
    secure: u.protocol !== "imap:",
    auth: { user: decodeURIComponent(u.username), pass: decodeURIComponent(u.password) },
    logger: false,
  });
  const since = new Date(Date.now() - 3 * 86_400_000);
  const senders = new Set<string>();
  const bouncedText: string[] = [];
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      for await (const msg of client.fetch({ since }, { envelope: true, source: true })) {
        const from = msg.envelope?.from?.[0]?.address?.toLowerCase() ?? "";
        const subject = msg.envelope?.subject ?? "";
        if (/mailer-daemon|postmaster/i.test(from) || /undeliverable|delivery status|failure notice|returned mail|delivery has failed/i.test(subject)) {
          bouncedText.push(msg.source?.toString("utf8").slice(0, 20_000) ?? "");
        } else if (from) senders.add(from);
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
  const sent = await query<Prospect>(`SELECT * FROM prospects WHERE status = 'sent'`);
  let replied = 0;
  let bounced = 0;
  for (const p of sent) {
    if (!p.email) continue;
    if (bouncedText.some((t) => t.toLowerCase().includes(p.email!))) {
      await query(`UPDATE prospects SET status = 'bounced' WHERE id = $1`, [p.id]);
      await query(`INSERT INTO suppression (email, reason) VALUES ($1, 'bounced') ON CONFLICT DO NOTHING`, [p.email]);
      bounced++;
    } else if ([...senders].some((s) => s === p.email || baseDomain(s.split("@")[1] ?? "") === p.domain)) {
      await query(`UPDATE prospects SET status = 'replied' WHERE id = $1`, [p.id]);
      replied++;
    }
  }
  return { replied, bounced };
}

// ------------------------------------------------------------------ sending

function outreachValues(p: Prospect) {
  const texts = p.lang === "ja" ? OUTREACH_TEXTS.ja : OUTREACH_TEXTS.en;
  const lang: "en" | "ja" = p.lang === "ja" ? "ja" : "en";
  return {
    texts,
    lang,
    values: {
      company: p.company,
      trade: texts.tradeNames[p.trade as keyof typeof texts.tradeNames] ?? p.trade,
      country: countryName(p.country, lang),
      postJob: `${SITE_URL}${pathFor(lang, "/post-job")}`,
      postProject: `${SITE_URL}${pathFor(lang, "/post-project")}`,
      companies: `${SITE_URL}${pathFor(lang, "/companies")}`,
      domain: p.domain,
      email: p.email ?? "",
      address: process.env.OUTREACH_POSTAL_ADDRESS ?? "",
      unsubscribe: `${SITE_URL}/api/unsubscribe?k=prospect&t=${p.id}`,
    } as Record<string, string>,
  };
}

export function renderOutreach(p: Prospect, step: number): { subject: string; text: string } {
  const { texts, lang, values } = outreachValues(p);
  const s = (isOperator(p) ? OPERATOR_TEXTS[lang].steps : texts.steps)[step];
  return { subject: fill(s.subject, values), text: [...s.lines, ...texts.footer].map((l) => fill(l, values)).join("\n") };
}

/** The lead in hand email: one open project, values from inviteToLead. */
export function renderLeadOffer(p: Prospect, lead: Record<string, string>): { subject: string; text: string } {
  const { texts, lang, values } = outreachValues(p);
  const all = { ...values, ...lead };
  const s = LEAD_IN_HAND_TEXTS[lang];
  return { subject: fill(s.subject, all), text: [...s.lines, ...texts.footer].map((l) => fill(l, all)).join("\n") };
}

/** Not a trade company's business address (schools, government), or malformed ("info@www.example.com"). */
const notBusiness = (email: string) => {
  const host = (email.split("@")[1] ?? "").toLowerCase();
  return host.startsWith("www.") || /\.(edu|gov|mil)$/.test(host) || /\.(ac|go|lg)\.jp$/.test(host);
};

type Transport = { sendMail: (mail: Record<string, unknown>) => Promise<unknown> };

async function sendOne(transport: Transport, p: Prospect, mail: { subject: string; text: string }): Promise<void> {
  const unsubscribe = `${SITE_URL}/api/unsubscribe?k=prospect&t=${p.id}`;
  await transport.sendMail({
    from: process.env.OUTREACH_FROM,
    to: p.email!,
    // A reply reaches the outreach mailbox (read over IMAP, so follow-ups stop) and the inbox Samuel reads.
    replyTo: [process.env.OUTREACH_FROM!, EMAIL],
    subject: mail.subject,
    text: mail.text,
    headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
}

/**
 * Lead in hand, first in each run: open projects that fewer than LEAD_SLOTS companies took go to contractors of the
 * same trade and country on the outreach list (never operators, never a company that stopped, left or already gets
 * lead emails), inside the day's room. Only rows still in the email sequence ('ready' or 'sent'): never 'done' rows,
 * which include the companies emailed by hand from Gmail in November 2026 (never emailed again). Returns how many were sent.
 */
async function sendLeadOffers(transport: Transport, room: number, steps: number): Promise<number> {
  const { perProject, maxPerProject, spacingDays } = OUTREACH.leadInHand;
  const open = await query<Project & { offered: string }>(
    `SELECT pr.*, (SELECT count(*) FROM leads l WHERE l.project_id = pr.id) AS offered FROM projects pr
     WHERE pr.status = 'open' AND pr.sold < $1 AND pr.country = ANY($2) ORDER BY pr.verified_at`,
    [LEAD_SLOTS, outreachCountries()],
  );
  let sent = 0;
  for (const project of open) {
    const n = Math.min(perProject, maxPerProject - Number(project.offered), room - sent);
    if (n <= 0) continue;
    const candidates = await query<Prospect>(
      `SELECT p.* FROM prospects p
       WHERE p.email IS NOT NULL AND p.trade = $1 AND p.country = $2 AND p.status IN ('ready', 'sent') AND NOT ${OPERATOR_SQL}
         AND (p.lead_offered_at IS NULL OR p.lead_offered_at < now() - make_interval(days => $3))
         AND NOT EXISTS (SELECT 1 FROM suppression s WHERE s.email = p.email)
         AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.email = p.email AND (c.leads OR c.status IN ('left', 'imported')))
         AND NOT EXISTS (SELECT 1 FROM leads l JOIN companies c ON c.id = l.company_id WHERE l.project_id = $4 AND c.email = p.email)
       ORDER BY p.created_at LIMIT $5`,
      [project.trade, project.country, spacingDays, project.id, n * 3],
    );
    let used = 0;
    for (const p of candidates) {
      if (used >= n) break;
      if (notBusiness(p.email!)) {
        await query(`UPDATE prospects SET status = 'skipped', note = 'not a business address' WHERE id = $1`, [p.id]);
        continue;
      }
      const invite = await inviteToLead(project, { company: p.company, email: p.email!, website: p.website, country: p.country, trade: p.trade, lang: p.lang });
      if (!invite) continue;
      try {
        await sendOne(transport, p, renderLeadOffer(p, invite.values));
      } catch (error) {
        console.error("[outreach] lead offer failed:", error instanceof Error ? error.message : "unknown");
        await withdrawInvite(invite.token);
        continue;
      }
      // A first email to this company starts its follow-ups; a company already in its follow-ups gets the next one
      // three days later at the soonest, so two emails never land the same week.
      const first = p.status === "ready";
      const nextAt = first ? (steps > 1 ? new Date(Date.now() + OUTREACH.followUpDays[0] * 86_400_000) : null) : p.status === "sent" ? new Date(Math.max(new Date(p.next_at ?? 0).getTime(), Date.now() + 3 * 86_400_000)) : p.next_at;
      await query(`UPDATE prospects SET lead_offered_at = now(), last_sent_at = now(), step = $2, status = $3, next_at = $4 WHERE id = $1`, [
        p.id,
        first ? 1 : p.step,
        first ? (steps > 1 ? "sent" : "done") : p.status,
        nextAt,
      ]);
      used++;
      sent++;
    }
  }
  return sent;
}

type Batch = { sent: number; leadOffers: number };
const NOTHING: Batch = { sent: 0, leadOffers: 0 };

async function sendBatch(): Promise<Batch> {
  if (!outreachConfig().sending) return NOTHING;
  const domain = (process.env.OUTREACH_FROM ?? "").match(/@([^>\s]+)/)?.[1]?.toLowerCase() ?? "default";
  // One batch at a time: two runs at once (a click on Run while a run is going) would both pick the same companies
  // and email them twice. The lock outlasts the longest run (maxDuration 300 s), so a run cut off still frees it.
  const lock = `outreach:sending:${domain}`;
  if (!(await takeLock(lock, 6 * 60_000))) {
    console.log("[outreach] another run is sending: nothing sent by this one");
    return NOTHING;
  }
  try {
    const batch = await sendLocked(domain);
    console.log(`[outreach] sent ${batch.sent} from ${domain} (${batch.leadOffers} lead offers)`);
    return batch;
  } finally {
    await releaseLock(lock).catch(() => undefined);
  }
}

async function sendLocked(domain: string): Promise<Batch> {
  const cfg = outreachConfig();
  // One-off "send now" (Samuel, 15 Nov 2026: "If the daily limit blocks it, override or reset it and send anyway."):
  // the state key outreach:send-now:<domain> holds the time it was set. For 2 hours after that time the weekend skip
  // is lifted and the daily count only counts emails sent since then, so it buys exactly one extra batch. After the
  // 2 hours the rules below apply again unchanged.
  const sendNow = await getState<string>(`outreach:send-now:${domain}`);
  const sendNowAt = sendNow ? new Date(sendNow).getTime() : Number.NaN;
  const forced = Date.now() >= sendNowAt && Date.now() - sendNowAt < 2 * 3_600_000;
  // Business days only (Samuel, 15 Nov 2026: "Keep Monday"): the run is at 22:00 UTC, so Saturday and Sunday runs
  // (US weekend) send nothing.
  const day = new Date().getUTCDay();
  if (!forced && (day === 0 || day === 6)) return NOTHING;
  // The warm-up starts again for every new sending domain.
  let startedAt = await getState<string>(`outreach:started:${domain}`);
  if (!startedAt) {
    startedAt = new Date().toISOString();
    await setState(`outreach:started:${domain}`, startedAt);
  }
  const days = Math.floor((Date.now() - new Date(startedAt).getTime()) / 86_400_000);
  const quota = outreachQuota(days);
  const countFrom = new Date(forced ? sendNowAt : Date.now() - 20 * 3_600_000).toISOString();
  const [{ n }] = await query<{ n: string }>(`SELECT count(*) AS n FROM prospects WHERE last_sent_at > $1`, [countFrom]);
  const room = quota - Number(n);
  if (room <= 0) return NOTHING;
  const steps = 1 + (cfg.imap ? OUTREACH.followUpDays.length : 0);
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport(process.env.OUTREACH_SMTP_URL!);
  try {
    // A real project first: it is the email most worth the day's room.
    const leadOffers = cfg.leadOffers ? await sendLeadOffers(transport, room, steps) : 0;
    let sent = leadOffers;
    if (sent >= room) return { sent, leadOffers };
    // Operators wait, with no email at all, until their own texts are approved (OUTREACH_OPERATORS=on). An invited
    // company (one lead offered, nothing taken) stays in its email sequence; any other account leaves it.
    const due = await query<Prospect>(
      `SELECT p.* FROM prospects p
       WHERE p.email IS NOT NULL AND p.country = ANY($1)
         AND (p.status = 'ready' OR (p.status = 'sent' AND p.step < $2 AND p.next_at <= now()))
         AND ($4 OR NOT ${OPERATOR_SQL})
         AND NOT EXISTS (SELECT 1 FROM suppression s WHERE s.email = p.email)
         AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.email = p.email AND c.status <> 'invited')
       ORDER BY p.status = 'sent' DESC, p.created_at LIMIT $3`,
      [cfg.countries, steps, (room - sent) * 3, cfg.operators],
    );
    for (const p of due) {
      if (sent >= room) break;
      // A bounce or a wrong recipient hurts the sending domain's reputation, so such an address is skipped for good.
      if (notBusiness(p.email!)) {
        await query(`UPDATE prospects SET status = 'skipped', note = 'not a business address' WHERE id = $1`, [p.id]);
        continue;
      }
      try {
        await sendOne(transport, p, renderOutreach(p, p.step));
      } catch (error) {
        console.error("[outreach] send failed:", error instanceof Error ? error.message : "unknown");
        continue;
      }
      const step = p.step + 1;
      const nextDays = step < steps ? OUTREACH.followUpDays[step - 1] - (step > 1 ? OUTREACH.followUpDays[step - 2] : 0) : null;
      await query(`UPDATE prospects SET step = $2, status = $3, last_sent_at = now(), next_at = $4 WHERE id = $1`, [
        p.id,
        step,
        nextDays === null ? "done" : "sent",
        nextDays === null ? null : new Date(Date.now() + nextDays * 86_400_000),
      ]);
      sent++;
    }
    return { sent, leadOffers };
  } finally {
    transport.close();
  }
}

export async function unsubscribeProspect(id: string): Promise<string | null> {
  if (!/^[a-z0-9x]{6,12}$/.test(id)) return null;
  const [p] = await query<Prospect>(`UPDATE prospects SET status = 'unsubscribed' WHERE id = $1 RETURNING *`, [id]);
  if (!p?.email) return null;
  await query(`INSERT INTO suppression (email, reason) VALUES ($1, 'unsubscribed') ON CONFLICT DO NOTHING`, [p.email]);
  await trySendMail({ subject: `OUTREACH STOP: ${p.company}`, lines: [`${p.email} asked to stop. It is on the stop list.`] });
  return p.email;
}

export async function prospectById(id: string): Promise<Prospect | null> {
  if (!hasDatabase() || !/^[a-z0-9x]{6,12}$/.test(id)) return null;
  return (await query<Prospect>(`SELECT * FROM prospects WHERE id = $1`, [id]))[0] ?? null;
}

export async function outreachStats(): Promise<Record<string, number>> {
  const rows = await query<{ status: string; n: string }>(`SELECT status, count(*) AS n FROM prospects GROUP BY status`);
  const stats: Record<string, number> = Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
  const [{ n }] = await query<{ n: string }>(`SELECT count(*) AS n FROM prospects p WHERE p.status = 'ready' AND ${OPERATOR_SQL}`);
  stats[outreachConfig().operators ? "operatorsReady" : "operatorsWaitingForApproval"] = Number(n);
  const [{ offers }] = await query<{ offers: string }>(`SELECT count(*) AS offers FROM prospects WHERE lead_offered_at IS NOT NULL`);
  stats.leadInHandSent = Number(offers);
  return stats;
}

/** The daily outreach run. Discovery and email finding always run; sending only when switched on. */
export async function dailyOutreach() {
  const deadline = Date.now() + 240_000;
  const found = await discover().catch((error) => ({ source: "error", found: 0, added: 0, error: error instanceof Error ? error.message : "unknown" }));
  const ready = await enrich(deadline).catch(() => 0);
  const replies = await readReplies().catch((error) => {
    console.error("[outreach] imap failed:", error instanceof Error ? error.message : "unknown");
    return { replied: 0, bounced: 0 };
  });
  const { sent, leadOffers } = await sendBatch();
  return { ...found, ready, ...replies, sent, leadOffers, config: outreachConfig() };
}
