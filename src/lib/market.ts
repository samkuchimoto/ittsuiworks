/**
 * The Ittsui Works platform. No person sits between the steps.
 *
 * Jobs (the Indeed model)
 * 1. A company posts a job (free). Confirming the email link publishes it for JOB_DAYS on its own page.
 * 2. A technician applies; the application reaches the company's inbox at once. Jobs in Japan send applicants
 *    to the employer's own link until JAPAN_SEEKER_DATA is on.
 * 3. Technicians with job alerts get each new job in their trade and country the next morning.
 * 4. A company can pay to feature a job (first in every list) once PRICING is approved and Stripe is connected.
 *
 * Projects (the Thumbtack / Angi model)
 * 1. A buyer posts a project (free) and confirms the email link. Only projects with power, an approved budget
 *    and a start date are "open"; the others wait until the buyer updates them.
 * 2. Open projects are emailed to companies in the trade and country, without the buyer's contact.
 * 3. A company pays for the lead and gets the buyer's contact at once. LEAD_SLOTS companies at most.
 */
import "server-only";
import type Stripe from "stripe";
import { fill, getDictionary, type Dict } from "@/content";
import {
  JOB_DAYS,
  LEAD_OFFERS_PER_DAY,
  LEAD_SLOTS,
  PRICING,
  PROJECT_DAYS,
  SPONSOR_DAYS,
  ALERT_DAILY_CAP,
  collectsSeekers,
  paymentsOn,
  priceCurrency,
} from "./config";
import { countryName } from "./countries";
import { hasDatabase, isToken, newId, newToken, query } from "./db";
import { dateText, money, toMinor } from "./format";
import { trySendMail, sendMail } from "./mail";
import { INDEXNOW_KEY, SITE_URL, isLocale, pathFor, type Locale } from "./site";
import { stripeClient } from "./stripe";

// ------------------------------------------------------------------ types

export type Company = {
  id: string;
  name: string;
  contact_name: string;
  email: string;
  website: string;
  country: string;
  trades: string[];
  abroad: boolean;
  lang: string;
  token: string;
  /** "imported": an employer whose jobs come from its careers page (lib/importer.ts); it gets no email, leads or applications here. */
  status: "unverified" | "active" | "left" | "imported";
  leads: boolean;
  verified_at: Date | null;
};

export type Job = {
  id: string;
  created_at: Date;
  company_id: string;
  title: string;
  trade: string;
  employment: string;
  country: string;
  city: string;
  pay_min: string | null;
  pay_max: string | null;
  pay_currency: string;
  pay_unit: string;
  description: string;
  certifications: string;
  apply_url: string;
  lang: string;
  status: "pending" | "live" | "closed" | "expired";
  published_at: Date | null;
  expires_at: Date | null;
  sponsored_until: Date | null;
  applications: number;
  /** "greenhouse:xai" etc. for jobs imported from an employer's careers page (lib/importer.ts); null when posted here. */
  source: string | null;
  company_name?: string;
  company_website?: string;
};

export type Application = {
  id: string;
  created_at: Date;
  job_id: string;
  name: string;
  email: string;
  country: string;
  years: string;
  certifications: string;
  message: string;
  job_title?: string;
};

export type Alert = { id: string; email: string; trade: string; country: string; lang: string; token: string; status: "unverified" | "active" | "off"; last_sent_at: Date | null; created_at: Date };

export type Buyer = { name: string; role: string; company: string; email: string; phone: string };

export type Project = {
  id: string;
  created_at: Date;
  trade: string;
  title: string;
  scope: string;
  country: string;
  city: string;
  budget: string;
  start: string;
  power: string;
  budget_approved: boolean;
  start_set: boolean;
  buyer: Buyer;
  lang: string;
  token: string;
  status: "unverified" | "waiting" | "open" | "full" | "closed";
  verified_at: Date | null;
  sold: number;
};

export type Lead = {
  token: string;
  project_id: string;
  company_id: string;
  offered_at: Date;
  stripe_session: string | null;
  paid_at: Date | null;
  amount: number | null;
  currency: string | null;
  refunded: boolean;
};

// ------------------------------------------------------------------ helpers

const langOf = (value: string): Locale => (isLocale(value) ? value : "en");
const dict = (value: string) => getDictionary(langOf(value));
export const pageUrl = (lang: string, path: string) => `${SITE_URL}${pathFor(langOf(lang), path)}`;
const tradeName = (t: Dict, trade: string) => t.ui.trades[trade as keyof Dict["ui"]["trades"]] ?? trade;
const place = (city: string, country: string, lang: string) => `${city}, ${countryName(country, lang)}`;
const mailLines = (lines: string[], values: Record<string, string | number>) => lines.map((l) => fill(l, values)).filter((l) => !/: $|：$/.test(l));

export const isReady = (p: Pick<Project, "power" | "budget_approved" | "start">) => p.budget_approved && p.start !== "unset" && p.power !== "no";

export function leadPrice(company: Pick<Company, "country">) {
  const currency = priceCurrency(company.country);
  return { amount: PRICING.lead[currency], currency };
}
export function sponsorPrice(company: Pick<Company, "country">) {
  const currency = priceCurrency(company.country);
  return { amount: PRICING.sponsor[currency], currency };
}

/** Announces new or changed pages to IndexNow (Bing, Yandex, Seznam, Naver). Production only, never blocks. */
export async function pingIndexNow(urls: string[]) {
  if (process.env.VERCEL_ENV !== "production" || urls.length === 0) return;
  try {
    await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: new URL(SITE_URL).host, key: INDEXNOW_KEY, keyLocation: `${SITE_URL}/indexnow.txt`, urlList: urls }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // Search engines find the page through the sitemap anyway.
  }
}

export const jobUrls = (job: Pick<Job, "id">) => [`${SITE_URL}/jobs/${job.id}`, `${SITE_URL}/ja/jobs/${job.id}`];

// ------------------------------------------------------------------ companies

export type CompanyInput = { name: string; contact_name: string; email: string; website: string; country: string; lang: string };

async function ensureCompany(input: CompanyInput): Promise<Company> {
  const [company] = await query<Company>(
    `INSERT INTO companies (id, name, contact_name, email, website, country, lang, token)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (email) DO UPDATE SET
       name = CASE WHEN companies.status <> 'active' THEN EXCLUDED.name ELSE companies.name END,
       contact_name = CASE WHEN companies.status <> 'active' THEN EXCLUDED.contact_name ELSE companies.contact_name END,
       website = CASE WHEN companies.website = '' THEN EXCLUDED.website ELSE companies.website END,
       status = CASE WHEN companies.status = 'left' THEN 'unverified' ELSE companies.status END
     RETURNING *`,
    [newId(), input.name, input.contact_name, input.email.toLowerCase(), input.website, input.country, langOf(input.lang), newToken()],
  );
  return company;
}

export async function companyByToken(token: string): Promise<Company | null> {
  if (!hasDatabase() || !isToken(token)) return null;
  return (await query<Company>(`SELECT * FROM companies WHERE token = $1`, [token]))[0] ?? null;
}

/** Signs a company up for project leads (and jobs). The email link confirms it. */
export async function registerCompany(input: CompanyInput & { trades: string[]; abroad: boolean }): Promise<void> {
  const company = await ensureCompany(input);
  await query(`UPDATE companies SET trades = $2, abroad = $3, leads = true WHERE id = $1`, [company.id, input.trades, input.abroad]);
  const t = dict(input.lang);
  await sendMail({
    to: company.email,
    subject: fill(t.mail.confirmCompany.subject, { company: company.name }),
    lines: mailLines(t.mail.confirmCompany.lines, { name: input.contact_name, link: pageUrl(input.lang, `/account/${company.token}`) }),
  });
}

/**
 * Opening the account link confirms the email: the company becomes active and its waiting jobs go live.
 * Called by the account page, so the link in every email works as a sign-in.
 */
export async function openAccount(token: string): Promise<{ company: Company; confirmed: boolean; published: Job[] } | null> {
  let company = await companyByToken(token);
  if (!company || company.status === "left") return company ? { company, confirmed: false, published: [] } : null;
  let confirmed = false;
  if (company.status === "unverified") {
    [company] = await query<Company>(`UPDATE companies SET status = 'active', verified_at = now() WHERE id = $1 RETURNING *`, [company.id]);
    confirmed = true;
  }
  const published = await query<Job>(
    `UPDATE jobs SET status = 'live', published_at = now(), expires_at = now() + make_interval(days => $2)
     WHERE company_id = $1 AND status = 'pending' RETURNING *`,
    [company.id, JOB_DAYS],
  );
  if (published.length) await pingIndexNow(published.flatMap(jobUrls));
  return { company, confirmed, published };
}

export async function accountView(company: Company) {
  const jobs = await query<Job>(`SELECT * FROM jobs WHERE company_id = $1 ORDER BY created_at DESC LIMIT 50`, [company.id]);
  const applications = await query<Application>(
    `SELECT a.*, j.title AS job_title FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.company_id = $1 ORDER BY a.created_at DESC LIMIT 20`,
    [company.id],
  );
  const leads = await query<Lead & { title: string; city: string; country: string; project_status: string; sold: number }>(
    `SELECT l.*, p.title, p.city, p.country, p.status AS project_status, p.sold FROM leads l JOIN projects p ON p.id = l.project_id
     WHERE l.company_id = $1 ORDER BY l.offered_at DESC LIMIT 30`,
    [company.id],
  );
  return { jobs, applications, leads };
}

export async function setJobStatus(token: string, jobId: string, action: "close" | "renew"): Promise<void> {
  const company = await companyByToken(token);
  if (!company || company.status !== "active") return;
  if (action === "close") {
    await query(`UPDATE jobs SET status = 'closed' WHERE id = $1 AND company_id = $2 AND status IN ('live', 'pending')`, [jobId, company.id]);
  } else {
    const [job] = await query<Job>(
      `UPDATE jobs SET status = 'live', published_at = COALESCE(published_at, now()),
         expires_at = GREATEST(COALESCE(expires_at, now()), now()) + make_interval(days => $3)
       WHERE id = $1 AND company_id = $2 AND status IN ('live', 'expired') RETURNING *`,
      [jobId, company.id, JOB_DAYS],
    );
    if (job) await pingIndexNow(jobUrls(job));
  }
}

export async function setLeadSettings(token: string, settings: { leads: boolean; trades: string[]; abroad: boolean }): Promise<void> {
  await query(`UPDATE companies SET leads = $2, trades = $3, abroad = $4 WHERE token = $1 AND status = 'active'`, [token, settings.leads, settings.trades, settings.abroad]);
}

export async function leaveAccount(token: string): Promise<void> {
  const company = await companyByToken(token);
  if (!company) return;
  await query(`UPDATE jobs SET status = 'closed' WHERE company_id = $1 AND status IN ('live', 'pending')`, [company.id]);
  await query(`UPDATE companies SET status = 'left', leads = false WHERE id = $1`, [company.id]);
}

// ------------------------------------------------------------------ jobs

export type JobInput = {
  title: string;
  trade: string;
  employment: string;
  country: string;
  city: string;
  pay_min: number | null;
  pay_max: number | null;
  pay_currency: string;
  pay_unit: string;
  description: string;
  certifications: string;
  apply_url: string;
  lang: string;
};

/**
 * Posts a job. From an active company's account (accountToken) it goes live at once; otherwise it waits for the
 * email link, which confirms the company and publishes every waiting job.
 */
export async function postJob(companyInput: CompanyInput, input: JobInput, accountToken?: string): Promise<{ live: boolean; jobId: string; email: string }> {
  const fromAccount = accountToken ? await companyByToken(accountToken) : null;
  const company = fromAccount && fromAccount.status === "active" ? fromAccount : await ensureCompany(companyInput);
  const live = company === fromAccount;
  const id = newId();
  await query(
    `INSERT INTO jobs (id, company_id, title, trade, employment, country, city, pay_min, pay_max, pay_currency, pay_unit, description,
       certifications, apply_url, lang, status, published_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
       CASE WHEN $16 = 'live' THEN now() END, CASE WHEN $16 = 'live' THEN now() + make_interval(days => $17) END)`,
    [
      id,
      company.id,
      input.title,
      input.trade,
      input.employment,
      input.country,
      input.city,
      input.pay_min,
      input.pay_max,
      input.pay_currency,
      input.pay_unit,
      input.description,
      input.certifications,
      input.apply_url,
      langOf(input.lang),
      live ? "live" : "pending",
      JOB_DAYS,
    ],
  );
  if (live) {
    await pingIndexNow(jobUrls({ id }));
  } else {
    const t = dict(input.lang);
    await sendMail({
      to: company.email,
      subject: fill(t.mail.confirmJob.subject, { title: input.title }),
      lines: mailLines(t.mail.confirmJob.lines, { name: companyInput.contact_name || company.contact_name, title: input.title, link: pageUrl(input.lang, `/account/${company.token}`) }),
    });
  }
  return { live, jobId: id, email: company.email };
}

const LIVE = `j.status = 'live' AND j.expires_at > now()`;
const JOB_SELECT = `SELECT j.*, c.name AS company_name, c.website AS company_website FROM jobs j JOIN companies c ON c.id = j.company_id`;
const FEATURED_FIRST = `COALESCE(j.sponsored_until > now(), false) DESC, j.published_at DESC`;

export type JobFilter = { trade?: string; country?: string; q?: string; page?: number; perPage?: number };

export async function listJobs(filter: JobFilter = {}): Promise<{ jobs: Job[]; total: number }> {
  if (!hasDatabase()) return { jobs: [], total: 0 };
  const per = filter.perPage ?? 20;
  const page = Math.max(1, filter.page ?? 1);
  const like = filter.q ? `%${filter.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const where = `${LIVE} AND ($1::text IS NULL OR j.trade = $1) AND ($2::text IS NULL OR j.country = $2)
    AND ($3::text IS NULL OR j.title ILIKE $3 OR j.city ILIKE $3 OR j.certifications ILIKE $3 OR j.description ILIKE $3 OR c.name ILIKE $3)`;
  const params = [filter.trade || null, filter.country || null, like];
  const jobs = await query<Job>(`${JOB_SELECT} WHERE ${where} ORDER BY ${FEATURED_FIRST} LIMIT $4 OFFSET $5`, [...params, per, (page - 1) * per]);
  const [{ count }] = await query<{ count: string }>(`SELECT count(*) FROM jobs j JOIN companies c ON c.id = j.company_id WHERE ${where}`, params);
  return { jobs, total: Number(count) };
}

/** Countries that have live jobs, for the filter. */
export async function jobCountries(): Promise<string[]> {
  if (!hasDatabase()) return [];
  return (await query<{ country: string }>(`SELECT DISTINCT j.country FROM jobs j WHERE ${LIVE}`)).map((r) => r.country);
}

export async function getJob(id: string): Promise<Job | null> {
  if (!hasDatabase() || !/^[a-z0-9x]{6,12}$/.test(id)) return null;
  return (await query<Job>(`${JOB_SELECT} WHERE j.id = $1 AND j.status <> 'pending'`, [id]))[0] ?? null;
}

export const isLive = (job: Job) => job.status === "live" && job.expires_at !== null && new Date(job.expires_at) > new Date();

/** Every live job, for the sitemap; the XML feed leaves out imported jobs (their employers syndicate them already). */
export async function allLiveJobs(limit = 5000, imported = true): Promise<Job[]> {
  if (!hasDatabase()) return [];
  return query<Job>(`${JOB_SELECT} WHERE ${LIVE} AND ($2 OR j.source IS NULL) ORDER BY j.published_at DESC LIMIT $1`, [limit, imported]);
}

// ------------------------------------------------------------------ applications

export type ApplicationInput = { name: string; email: string; country: string; years: string; certifications: string; message: string; lang: string };

export async function applyToJob(jobId: string, input: ApplicationInput): Promise<"ok" | "closed" | "duplicate" | "external"> {
  const job = await getJob(jobId);
  if (!job || !isLive(job)) return "closed";
  if (job.apply_url || !collectsSeekers(job.country)) return "external";
  const [row] = await query<{ id: string }>(
    `INSERT INTO applications (id, job_id, name, email, country, years, certifications, message, lang)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (job_id, email) DO NOTHING RETURNING id`,
    [newId(), job.id, input.name, input.email.toLowerCase(), input.country, input.years, input.certifications, input.message, langOf(input.lang)],
  );
  if (!row) return "duplicate";
  await query(`UPDATE jobs SET applications = applications + 1 WHERE id = $1`, [job.id]);
  const [company] = await query<Company>(`SELECT * FROM companies WHERE id = $1`, [job.company_id]);
  const tc = dict(company.lang);
  await sendMail({
    to: company.email,
    replyTo: input.email,
    subject: fill(tc.mail.application.subject, { title: job.title, name: input.name }),
    lines: mailLines(tc.mail.application.lines, {
      name: input.name,
      title: job.title,
      email: input.email,
      country: countryName(input.country, company.lang),
      years: input.years,
      experience: input.certifications,
      message: input.message,
      link: pageUrl(company.lang, `/account/${company.token}`),
    }),
  });
  const ta = dict(input.lang);
  await trySendMail({
    to: input.email,
    subject: fill(ta.mail.applied.subject, { title: job.title }),
    lines: mailLines(ta.mail.applied.lines, { name: input.name, title: job.title, company: job.company_name ?? "", link: pageUrl(input.lang, `/jobs?trade=${job.trade}`) }),
  });
  return "ok";
}

// ------------------------------------------------------------------ job alerts

export async function subscribeAlert(input: { email: string; trade: string; country: string; lang: string }): Promise<"sent" | "active"> {
  const [alert] = await query<Alert>(
    `INSERT INTO alerts (id, email, trade, country, lang, token) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (email, trade, country) DO UPDATE SET lang = EXCLUDED.lang,
       status = CASE WHEN alerts.status = 'active' THEN 'active' ELSE 'unverified' END
     RETURNING *`,
    [newId(), input.email.toLowerCase(), input.trade, input.country, langOf(input.lang), newToken()],
  );
  if (alert.status === "active") return "active";
  const t = dict(input.lang);
  await sendMail({
    to: alert.email,
    subject: t.mail.confirmAlert.subject,
    lines: mailLines(t.mail.confirmAlert.lines, {
      trade: tradeName(t, alert.trade),
      country: countryName(alert.country, input.lang),
      link: pageUrl(input.lang, `/alerts/${alert.token}`),
    }),
  });
  return "sent";
}

export async function alertByToken(token: string): Promise<Alert | null> {
  if (!hasDatabase() || !isToken(token)) return null;
  return (await query<Alert>(`SELECT * FROM alerts WHERE token = $1`, [token]))[0] ?? null;
}

/** Opening the alert link confirms it (double opt-in). */
export async function openAlert(token: string): Promise<Alert | null> {
  const alert = await alertByToken(token);
  if (alert?.status !== "unverified") return alert;
  return (await query<Alert>(`UPDATE alerts SET status = 'active' WHERE id = $1 RETURNING *`, [alert.id]))[0];
}

export async function setAlert(token: string, on: boolean): Promise<void> {
  await query(`UPDATE alerts SET status = $2 WHERE token = $1 AND status <> 'unverified'`, [token, on ? "active" : "off"]);
}

/** Each morning: new jobs since the last email, one email per alert, ALERT_DAILY_CAP emails at most. */
export async function sendDigests(): Promise<number> {
  const alerts = await query<Alert>(
    `SELECT * FROM alerts WHERE status = 'active' AND (last_sent_at IS NULL OR last_sent_at < now() - interval '20 hours')
     ORDER BY last_sent_at NULLS FIRST LIMIT 1000`,
  );
  let sent = 0;
  for (const alert of alerts) {
    if (sent >= ALERT_DAILY_CAP) break;
    const jobs = await query<Job>(
      `${JOB_SELECT} WHERE ${LIVE} AND j.trade = $1 AND j.country = $2 AND GREATEST(j.published_at, j.created_at) > GREATEST(COALESCE($3::timestamptz, $4::timestamptz), now() - interval '7 days')
       ORDER BY ${FEATURED_FIRST} LIMIT 10`,
      [alert.trade, alert.country, alert.last_sent_at, alert.created_at],
    );
    if (jobs.length === 0) continue;
    const t = dict(alert.lang);
    const unsubscribe = `${SITE_URL}/api/unsubscribe?k=alert&t=${alert.token}`;
    const ok = await trySendMail({
      to: alert.email,
      unsubscribe,
      subject: fill(t.mail.digest.subject, { trade: tradeName(t, alert.trade), country: countryName(alert.country, alert.lang) }),
      lines: [
        t.mail.digest.intro,
        "",
        ...jobs.map((j) => fill(t.mail.digest.job, { title: j.title, company: j.company_name ?? "", city: j.city, link: pageUrl(alert.lang, `/jobs/${j.id}`) })),
        "",
        fill(t.mail.digest.stop, { link: pageUrl(alert.lang, `/alerts/${alert.token}`) }),
      ],
    });
    if (ok) {
      sent++;
      await query(`UPDATE alerts SET last_sent_at = now() WHERE id = $1`, [alert.id]);
    }
  }
  return sent;
}

// ------------------------------------------------------------------ projects

export type ProjectInput = Omit<Project, "id" | "created_at" | "token" | "status" | "verified_at" | "sold" | "start_set">;

export async function postProject(input: ProjectInput): Promise<void> {
  const token = newToken();
  await query(
    `INSERT INTO projects (id, trade, title, scope, country, city, budget, start, power, budget_approved, start_set, buyer, lang, token)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      newId(),
      input.trade,
      input.title,
      input.scope,
      input.country,
      input.city,
      input.budget,
      input.start,
      input.power,
      input.budget_approved,
      input.start !== "unset",
      JSON.stringify({ ...input.buyer, email: input.buyer.email.toLowerCase() }),
      langOf(input.lang),
      token,
    ],
  );
  const t = dict(input.lang);
  await sendMail({
    to: input.buyer.email,
    subject: fill(t.mail.confirmProject.subject, { title: input.title }),
    lines: mailLines(t.mail.confirmProject.lines, { name: input.buyer.name, title: input.title, link: pageUrl(input.lang, `/project/${token}`) }),
  });
}

export async function projectByToken(token: string): Promise<Project | null> {
  if (!hasDatabase() || !isToken(token)) return null;
  return (await query<Project>(`SELECT * FROM projects WHERE token = $1`, [token]))[0] ?? null;
}

function projectLines(p: Project, lang = "en"): string[] {
  const t = dict(lang);
  return [
    `Project: ${p.title}`,
    `Trade: ${tradeName(t, p.trade)}`,
    `Place: ${place(p.city, p.country, lang)}`,
    `Size: ${t.ui.budgets[p.budget as keyof Dict["ui"]["budgets"]] ?? p.budget}`,
    `Start: ${t.ui.starts[p.start as keyof Dict["ui"]["starts"]] ?? p.start}`,
    `Power: ${t.ui.power[p.power as keyof Dict["ui"]["power"]] ?? p.power}`,
    `Budget approved: ${p.budget_approved ? "yes" : "not yet"}`,
    `The work: ${p.scope}`,
  ];
}

/** Opening the project link confirms the email; a ready project goes to companies at once. */
export async function openProject(token: string): Promise<{ project: Project; confirmed: boolean } | null> {
  const project = await projectByToken(token);
  if (!project) return null;
  if (project.status !== "unverified") return { project, confirmed: false };
  const [p] = await query<Project>(`UPDATE projects SET verified_at = now(), status = $2 WHERE id = $1 AND status = 'unverified' RETURNING *`, [
    project.id,
    isReady(project) ? "open" : "waiting",
  ]);
  if (!p) return { project, confirmed: false };
  await trySendMail({
    subject: `NEW PROJECT (${p.status}): ${p.title}, ${countryName(p.country)}`,
    lines: [...projectLines(p), "", `Buyer: ${p.buyer.name}, ${p.buyer.role}, ${p.buyer.company}`, `Email: ${p.buyer.email}`, `Phone: ${p.buyer.phone || "not given"}`, "", paymentsOn() ? "Leads are on: it is offered to matching companies automatically." : "Payments are off: no company receives it until prices are approved and Stripe is connected."],
  });
  if (p.status === "open") await offerProject(p);
  return { project: p, confirmed: true };
}

export async function updateProject(token: string, update: { power: string; budget_approved: boolean; start: string }): Promise<void> {
  const [p] = await query<Project>(
    `UPDATE projects SET power = $2, budget_approved = $3, start = $4, start_set = $4 <> 'unset' WHERE token = $1 AND status IN ('waiting', 'open') RETURNING *`,
    [token, update.power, update.budget_approved, update.start],
  );
  if (!p) return;
  const status = isReady(p) ? "open" : "waiting";
  if (status !== p.status) {
    const [changed] = await query<Project>(`UPDATE projects SET status = $2 WHERE id = $1 RETURNING *`, [p.id, status]);
    if (changed.status === "open") await offerProject(changed);
  }
}

export async function closeProject(token: string): Promise<void> {
  await query(`UPDATE projects SET status = 'closed' WHERE token = $1 AND status IN ('unverified', 'waiting', 'open', 'full')`, [token]);
}

// ------------------------------------------------------------------ leads

/** Emails an open project to matching companies that have not seen it, least recently offered first. */
export async function offerProject(p: Project): Promise<number> {
  if (!paymentsOn() || p.status !== "open" || p.sold >= LEAD_SLOTS) return 0;
  const companies = await query<Company>(
    `SELECT c.* FROM companies c WHERE c.status = 'active' AND c.leads AND $1 = ANY(c.trades) AND (c.country = $2 OR c.abroad)
       AND NOT EXISTS (SELECT 1 FROM leads l WHERE l.project_id = $3 AND l.company_id = c.id)
     ORDER BY c.last_offer_at NULLS FIRST LIMIT $4`,
    [p.trade, p.country, p.id, LEAD_OFFERS_PER_DAY],
  );
  for (const c of companies) {
    const token = newToken();
    await query(`INSERT INTO leads (token, project_id, company_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [token, p.id, c.id]);
    await query(`UPDATE companies SET last_offer_at = now() WHERE id = $1`, [c.id]);
    const t = dict(c.lang);
    const price = leadPrice(c);
    await trySendMail({
      to: c.email,
      subject: fill(t.mail.leadOffer.subject, { title: p.title, place: place(p.city, p.country, c.lang) }),
      lines: mailLines(t.mail.leadOffer.lines, {
        title: p.title,
        place: place(p.city, p.country, c.lang),
        budget: t.ui.budgets[p.budget as keyof Dict["ui"]["budgets"]] ?? p.budget,
        start: t.ui.starts[p.start as keyof Dict["ui"]["starts"]] ?? p.start,
        scope: p.scope.length > 600 ? `${p.scope.slice(0, 600)}...` : p.scope,
        price: money(price.amount, price.currency, langOf(c.lang)),
        link: pageUrl(c.lang, `/lead/${token}`),
      }),
    });
  }
  return companies.length;
}

export async function leadView(token: string): Promise<{ lead: Lead; project: Project; company: Company } | null> {
  if (!hasDatabase() || !isToken(token)) return null;
  const [lead] = await query<Lead>(`SELECT * FROM leads WHERE token = $1`, [token]);
  if (!lead) return null;
  const [project] = await query<Project>(`SELECT * FROM projects WHERE id = $1`, [lead.project_id]);
  const [company] = await query<Company>(`SELECT * FROM companies WHERE id = $1`, [lead.company_id]);
  return { lead, project, company };
}

const checkoutReturn = `${SITE_URL}/api/checkout/return?session_id={CHECKOUT_SESSION_ID}`;

/** A Stripe Checkout for one lead, at the price for the company's country (never a price from the browser). */
export async function leadCheckout(token: string): Promise<string | null> {
  const stripe = stripeClient();
  const view = await leadView(token);
  if (!stripe || !paymentsOn() || !view) return null;
  const { lead, project, company } = view;
  if (lead.paid_at || project.status !== "open" || project.sold >= LEAD_SLOTS || company.status !== "active") return null;
  const price = leadPrice(company);
  const t = dict(company.lang);
  const metadata = { site: "ittsuiworks", kind: "lead", lead: token };
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: company.email,
    line_items: [{ quantity: 1, price_data: { currency: price.currency.toLowerCase(), unit_amount: toMinor(price.amount, price.currency), product_data: { name: `${t.lead.title}: ${project.title}`.slice(0, 250) } } }],
    metadata,
    payment_intent_data: { metadata, statement_descriptor_suffix: "ITTSUIWORKS" },
    success_url: checkoutReturn,
    cancel_url: pageUrl(company.lang, `/lead/${token}?cancelled=1`),
    locale: company.lang === "ja" ? "ja" : "en",
  });
  await query(`UPDATE leads SET stripe_session = $2 WHERE token = $1 AND paid_at IS NULL`, [token, session.id]);
  return session.url;
}

const isFeatured = (job: Pick<Job, "sponsored_until">) => job.sponsored_until !== null && new Date(job.sponsored_until) > new Date();

/** One Stripe Checkout to feature a job for SPONSOR_DAYS, at the price in lib/config.ts. */
async function sponsorSession(job: Job, opts: { from: "account" | "job"; lang: string; email?: string; cancel: string }): Promise<string | null> {
  const stripe = stripeClient();
  if (!stripe || !paymentsOn()) return null;
  const price = sponsorPrice({ country: job.country });
  const metadata = { site: "ittsuiworks", kind: "sponsor", job: job.id, from: opts.from, lang: langOf(opts.lang) };
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ...(opts.email ? { customer_email: opts.email } : {}),
    line_items: [{ quantity: 1, price_data: { currency: price.currency.toLowerCase(), unit_amount: toMinor(price.amount, price.currency), product_data: { name: `Featured job, ${SPONSOR_DAYS} days: ${job.title}`.slice(0, 250) } } }],
    metadata,
    payment_intent_data: { metadata, statement_descriptor_suffix: "ITTSUIWORKS" },
    success_url: checkoutReturn,
    cancel_url: opts.cancel,
    locale: langOf(opts.lang) === "ja" ? "ja" : "en",
  });
  await query(`INSERT INTO sponsorships (stripe_session, job_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [session.id, job.id]);
  return session.url;
}

/** From the company's account page. */
export async function sponsorCheckout(accountToken: string, jobId: string): Promise<string | null> {
  const company = await companyByToken(accountToken);
  if (!company || company.status !== "active") return null;
  const [job] = await query<Job>(`SELECT * FROM jobs WHERE id = $1 AND company_id = $2 AND status = 'live'`, [jobId, company.id]);
  if (!job) return null;
  return sponsorSession(job, { from: "account", lang: company.lang, email: company.email, cancel: pageUrl(company.lang, `/account/${company.token}`) });
}

/**
 * From the job's own page, for the employer of any live job (posted here or imported): no account and no email step,
 * Stripe asks for the payer's email. The payer always comes back to the job page, never to an account page.
 */
export async function featureCheckout(jobId: string, lang: string): Promise<string | null> {
  const job = await getJob(jobId);
  if (!job || !isLive(job) || isFeatured(job)) return null;
  return sponsorSession(job, { from: "job", lang, cancel: pageUrl(lang, `/jobs/${job.id}`) });
}

/** Records a paid Checkout once (return page, webhook and daily check all call it). Returns where to send the payer. */
export async function checkoutPaid(session: Stripe.Checkout.Session): Promise<string> {
  if (session.payment_status !== "paid" || session.metadata?.site !== "ittsuiworks") return SITE_URL;
  const amount = session.amount_total ?? 0;
  const currency = (session.currency ?? "usd").toUpperCase();
  if (session.metadata.kind === "lead" && session.metadata.lead) return leadPaid(session.metadata.lead, session, amount, currency);
  if (session.metadata.kind === "sponsor" && session.metadata.job) return sponsorPaid(session, session.metadata.job, amount, currency);
  return SITE_URL;
}

const fromMinor = (amount: number, currency: string) => (toMinor(1, currency) === 1 ? amount : amount / 100);

async function leadPaid(token: string, session: Stripe.Checkout.Session, amount: number, currency: string): Promise<string> {
  const view = await leadView(token);
  if (!view) return SITE_URL;
  const back = pageUrl(view.company.lang, `/lead/${token}`);
  const [lead] = await query<Lead>(
    `UPDATE leads SET paid_at = now(), stripe_session = $2, amount = $3, currency = $4 WHERE token = $1 AND paid_at IS NULL RETURNING *`,
    [token, session.id, amount, currency],
  );
  if (!lead) return back;
  const { company } = view;
  const tc = dict(company.lang);
  const paid = money(fromMinor(amount, currency), currency, langOf(company.lang));
  const [project] = await query<Project>(
    `UPDATE projects SET sold = sold + 1, status = CASE WHEN sold + 1 >= $2 THEN 'full' ELSE status END WHERE id = $1 AND sold < $2 RETURNING *`,
    [lead.project_id, LEAD_SLOTS],
  );
  if (!project) {
    // Every slot went while this payment was being made: refund it in full.
    let refunded = false;
    try {
      const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
      if (intent) await stripeClient()?.refunds.create({ payment_intent: intent });
      refunded = Boolean(intent);
    } catch (error) {
      console.error("[lead] refund failed:", error instanceof Error ? error.message : "unknown");
    }
    await query(`UPDATE leads SET refunded = $2 WHERE token = $1`, [token, refunded]);
    if (refunded) await trySendMail({ to: company.email, subject: fill(tc.mail.refunded.subject, { title: view.project.title }), lines: mailLines(tc.mail.refunded.lines, { price: paid }) });
    await trySendMail({ subject: refunded ? `LEAD REFUNDED (slots full): ${view.project.title}` : `REFUND DUE BY HAND: ${view.project.title}`, lines: [`Company: ${company.name}, ${company.email}`, `Paid: ${paid}`, `Checkout: ${session.id}`] });
    return back;
  }
  const b = project.buyer;
  await trySendMail({
    to: company.email,
    replyTo: b.email,
    subject: fill(tc.mail.leadBought.subject, { title: project.title }),
    lines: mailLines(tc.mail.leadBought.lines, { title: project.title, name: b.name, role: b.role, company: b.company, email: b.email, phone: b.phone || "-", price: paid, link: back }),
  });
  const tb = dict(project.lang);
  await trySendMail({
    to: b.email,
    replyTo: company.email,
    subject: fill(tb.mail.leadSold.subject, { title: project.title }),
    lines: mailLines(tb.mail.leadSold.lines, { name: b.name, company: company.name, title: project.title, website: company.website, link: pageUrl(project.lang, `/project/${project.token}`) }),
  });
  await trySendMail({ subject: `LEAD SOLD (${project.sold}/${LEAD_SLOTS}): ${paid}, ${project.title}`, lines: [`Company: ${company.name}, ${company.email}`, ...projectLines(project)] });
  return back;
}

async function sponsorPaid(session: Stripe.Checkout.Session, jobId: string, amount: number, currency: string): Promise<string> {
  const [row] = await query(`UPDATE sponsorships SET paid_at = now(), amount = $2, currency = $3 WHERE stripe_session = $1 AND paid_at IS NULL RETURNING *`, [session.id, amount, currency]);
  const [job] = await query<Job>(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
  if (!job) return SITE_URL;
  const [company] = await query<Company>(`SELECT * FROM companies WHERE id = $1`, [job.company_id]);
  const account = pageUrl(company.lang, `/account/${company.token}`);
  // Paid from the public job page: back to the job page. The account link signs in, so only its owner gets it, by email.
  const payerLang = langOf(session.metadata?.lang ?? "en");
  const fromJob = session.metadata?.from === "job" || company.status === "imported";
  const back = fromJob ? pageUrl(payerLang, `/jobs/${job.id}`) : account;
  if (!row) return back;
  const [updated] = await query<Job>(
    `UPDATE jobs SET sponsored_until = GREATEST(COALESCE(sponsored_until, now()), now()) + make_interval(days => $2),
       expires_at = GREATEST(expires_at, GREATEST(COALESCE(sponsored_until, now()), now()) + make_interval(days => $2))
     WHERE id = $1 RETURNING *`,
    [jobId, SPONSOR_DAYS],
  );
  const t = dict(company.lang);
  const until = dateText(updated.sponsored_until!, langOf(company.lang));
  const paid = money(fromMinor(amount, currency), currency, langOf(company.lang));
  // Imported employers have no inbox here (their address ends in .invalid): only the payer is told.
  if (company.status !== "imported") {
    await trySendMail({
      to: company.email,
      subject: fill(t.mail.sponsorPaid.subject, { date: until, title: job.title }),
      lines: mailLines(t.mail.sponsorPaid.lines, { title: job.title, date: until, price: paid, link: account }),
    });
  }
  const payer = (session.customer_details?.email ?? session.customer_email ?? "").toLowerCase();
  if (payer && payer !== company.email) {
    const tp = dict(payerLang);
    const date = dateText(updated.sponsored_until!, payerLang);
    await trySendMail({
      to: payer,
      subject: fill(tp.mail.featurePaid.subject, { date, title: job.title }),
      lines: mailLines(tp.mail.featurePaid.lines, { title: job.title, date, price: money(fromMinor(amount, currency), currency, payerLang), link: pageUrl(payerLang, `/jobs/${job.id}`) }),
    });
  }
  await trySendMail({
    subject: `JOB FEATURED: ${paid}, ${job.title}`,
    lines: [
      `Company: ${company.name}${company.status === "imported" ? " (imported job)" : `, ${company.email}`}`,
      `Paid by: ${payer || "unknown"}`,
      `Until: ${until}`,
      `Job: ${pageUrl("en", `/jobs/${job.id}`)}`,
    ],
  });
  return back;
}

/** Checks a Checkout Session with Stripe (from the return link) and records it. */
export async function confirmCheckout(sessionId: string): Promise<string> {
  const stripe = stripeClient();
  if (!stripe || !/^cs_[\w]+$/.test(sessionId)) return SITE_URL;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return checkoutPaid(session);
}

/** Daily: payments whose payer never came back to the return page (and no webhook arrived). */
async function recoverCheckouts(): Promise<number> {
  const stripe = stripeClient();
  if (!stripe) return 0;
  const sessions = [
    ...(await query<{ s: string }>(`SELECT stripe_session AS s FROM leads WHERE paid_at IS NULL AND stripe_session IS NOT NULL AND offered_at > now() - interval '${PROJECT_DAYS} days'`)),
    ...(await query<{ s: string }>(`SELECT stripe_session AS s FROM sponsorships WHERE paid_at IS NULL AND created_at > now() - interval '3 days'`)),
  ];
  let recovered = 0;
  for (const { s } of sessions) {
    try {
      const session = await stripe.checkout.sessions.retrieve(s);
      if (session.payment_status === "paid") {
        await checkoutPaid(session);
        recovered++;
      }
    } catch (error) {
      console.error("[recover] failed:", error instanceof Error ? error.message : "unknown");
    }
  }
  return recovered;
}

// ------------------------------------------------------------------ the daily run

export async function dailyMarket() {
  // Ends and clean-up.
  const expired = await query(`UPDATE jobs SET status = 'expired' WHERE status = 'live' AND expires_at < now() RETURNING id`);
  await query(`UPDATE projects SET status = 'closed' WHERE status IN ('waiting', 'open', 'full') AND verified_at < now() - interval '${PROJECT_DAYS} days'`);
  await query(`DELETE FROM alerts WHERE status = 'unverified' AND created_at < now() - interval '7 days'`);
  await query(`DELETE FROM jobs WHERE status = 'pending' AND created_at < now() - interval '14 days'`);
  await query(`DELETE FROM projects WHERE status = 'unverified' AND created_at < now() - interval '14 days'`);
  await query(`DELETE FROM companies c WHERE c.status = 'unverified' AND c.created_at < now() - interval '14 days' AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.company_id = c.id)`);
  // Kept 12 months after the end, as the privacy policy says.
  await query(`DELETE FROM applications WHERE job_id IN (SELECT id FROM jobs WHERE status IN ('closed', 'expired') AND COALESCE(expires_at, created_at) < now() - interval '12 months')`);
  await query(`DELETE FROM sponsorships WHERE job_id IN (SELECT id FROM jobs WHERE status IN ('closed', 'expired') AND COALESCE(expires_at, created_at) < now() - interval '12 months')`);
  await query(`DELETE FROM jobs WHERE status IN ('closed', 'expired') AND COALESCE(expires_at, created_at) < now() - interval '12 months'`);
  await query(`DELETE FROM leads WHERE project_id IN (SELECT id FROM projects WHERE status = 'closed' AND created_at < now() - interval '13 months')`);
  await query(`DELETE FROM projects WHERE status = 'closed' AND created_at < now() - interval '13 months'`);

  const digests = await sendDigests();

  // Leads: open projects go to companies that have not seen them yet.
  let offered = 0;
  const unmatched: Project[] = [];
  if (paymentsOn()) {
    const open = await query<Project>(`SELECT * FROM projects WHERE status = 'open' AND sold < $1 ORDER BY verified_at`, [LEAD_SLOTS]);
    for (const p of open) {
      const n = await offerProject(p);
      offered += n;
      if (n === 0 && p.sold === 0) {
        const [{ count }] = await query<{ count: string }>(`SELECT count(*) FROM leads WHERE project_id = $1`, [p.id]);
        if (Number(count) === 0) unmatched.push(p);
      }
    }
  }
  const recovered = await recoverCheckouts();
  const fresh = unmatched.filter((p) => !(p as Project & { alerted_at?: Date | null }).alerted_at);
  for (const p of fresh) {
    await trySendMail({ subject: `NO COMPANY YET: ${p.title}, ${countryName(p.country)}`, lines: [...projectLines(p), "", "No signed-up company does this trade in this country yet. Outreach can target it."] });
    await query(`UPDATE projects SET alerted_at = now() WHERE id = $1`, [p.id]);
  }
  return { expired: expired.length, digests, offered, recovered, unmatched: unmatched.length };
}

/** Counts for the daily summary and the admin page. */
export async function marketStats() {
  const one = async (sql: string) => Number((await query<{ n: string }>(sql))[0]?.n ?? 0);
  return {
    liveJobs: await one(`SELECT count(*) AS n FROM jobs WHERE status = 'live' AND expires_at > now()`),
    newJobs: await one(`SELECT count(*) AS n FROM jobs WHERE status = 'live' AND GREATEST(published_at, created_at) > now() - interval '1 day'`),
    importedJobs: await one(`SELECT count(*) AS n FROM jobs WHERE status = 'live' AND expires_at > now() AND source IS NOT NULL`),
    applications: await one(`SELECT count(*) AS n FROM applications WHERE created_at > now() - interval '1 day'`),
    alerts: await one(`SELECT count(*) AS n FROM alerts WHERE status = 'active'`),
    companies: await one(`SELECT count(*) AS n FROM companies WHERE status = 'active'`),
    leadCompanies: await one(`SELECT count(*) AS n FROM companies WHERE status = 'active' AND leads`),
    openProjects: await one(`SELECT count(*) AS n FROM projects WHERE status = 'open'`),
    waitingProjects: await one(`SELECT count(*) AS n FROM projects WHERE status = 'waiting'`),
    newProjects: await one(`SELECT count(*) AS n FROM projects WHERE verified_at > now() - interval '1 day'`),
    leadsSold: await one(`SELECT count(*) AS n FROM leads WHERE paid_at > now() - interval '1 day' AND NOT refunded`),
  };
}
