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
import { OUTREACH, TRADES, isTrade, outreachQuota } from "./config";
import { countryName, isCountry } from "./countries";
import { getState, hasDatabase, newId, query, setState } from "./db";
import { trySendMail } from "./mail";
import { OUTREACH_TEXTS } from "./outreach-texts";
import { SITE_URL, pathFor } from "./site";

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
};

export function outreachCountries(): string[] {
  const list = (process.env.OUTREACH_COUNTRIES ?? "").split(",").map((c) => c.trim().toUpperCase()).filter(isCountry);
  return list.length ? list : [...OUTREACH.defaultCountries];
}

export function outreachConfig() {
  const live = process.env.OUTREACH_LIVE === "on";
  const smtp = Boolean(process.env.OUTREACH_SMTP_URL && process.env.OUTREACH_FROM);
  const address = Boolean(process.env.OUTREACH_POSTAL_ADDRESS);
  const imap = Boolean(process.env.OUTREACH_IMAP_URL);
  return { live, smtp, address, imap, sending: live && smtp && address, countries: outreachCountries() };
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

export function renderOutreach(p: Prospect, step: number): { subject: string; text: string } {
  const texts = p.lang === "ja" ? OUTREACH_TEXTS.ja : OUTREACH_TEXTS.en;
  const lang = p.lang === "ja" ? "ja" : "en";
  const values = {
    company: p.company,
    trade: texts.tradeNames[p.trade as keyof typeof texts.tradeNames] ?? p.trade,
    country: countryName(p.country, lang),
    postJob: `${SITE_URL}${pathFor(lang, "/post-job")}`,
    companies: `${SITE_URL}${pathFor(lang, "/companies")}`,
    domain: p.domain,
    email: p.email ?? "",
    address: process.env.OUTREACH_POSTAL_ADDRESS ?? "",
    unsubscribe: `${SITE_URL}/api/unsubscribe?k=prospect&t=${p.id}`,
  };
  const s = texts.steps[step];
  return { subject: fill(s.subject, values), text: [...s.lines, ...texts.footer].map((l) => fill(l, values)).join("\n") };
}

async function sendBatch(): Promise<number> {
  const cfg = outreachConfig();
  if (!cfg.sending) return 0;
  // The warm-up starts again for every new sending domain.
  const domain = (process.env.OUTREACH_FROM ?? "").match(/@([^>\s]+)/)?.[1]?.toLowerCase() ?? "default";
  let startedAt = await getState<string>(`outreach:started:${domain}`);
  if (!startedAt) {
    startedAt = new Date().toISOString();
    await setState(`outreach:started:${domain}`, startedAt);
  }
  const days = Math.floor((Date.now() - new Date(startedAt).getTime()) / 86_400_000);
  const quota = outreachQuota(days);
  const [{ n }] = await query<{ n: string }>(`SELECT count(*) AS n FROM prospects WHERE last_sent_at > now() - interval '20 hours'`);
  const room = quota - Number(n);
  if (room <= 0) return 0;
  const steps = 1 + (cfg.imap ? OUTREACH.followUpDays.length : 0);
  const due = await query<Prospect>(
    `SELECT p.* FROM prospects p
     WHERE p.email IS NOT NULL AND p.country = ANY($1)
       AND (p.status = 'ready' OR (p.status = 'sent' AND p.step < $2 AND p.next_at <= now()))
       AND NOT EXISTS (SELECT 1 FROM suppression s WHERE s.email = p.email)
       AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.email = p.email)
     ORDER BY p.status = 'sent' DESC, p.created_at LIMIT $3`,
    [cfg.countries, steps, room],
  );
  if (due.length === 0) return 0;
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport(process.env.OUTREACH_SMTP_URL!);
  let sent = 0;
  for (const p of due) {
    const { subject, text } = renderOutreach(p, p.step);
    const unsubscribe = `${SITE_URL}/api/unsubscribe?k=prospect&t=${p.id}`;
    try {
      await transport.sendMail({
        from: process.env.OUTREACH_FROM,
        to: p.email!,
        subject,
        text,
        headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      });
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
  transport.close();
  return sent;
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
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
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
  const sent = await sendBatch();
  return { ...found, ready, ...replies, sent, config: outreachConfig() };
}
