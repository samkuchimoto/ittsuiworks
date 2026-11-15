/**
 * Apply clicks, the loop Indeed grew on: a job that links out to the employer's own careers page sends each
 * technician through /api/go/<job>, which counts the click and tags the link, so the employer's hiring system and
 * web stats show Ittsui Works as where the applicant came from. An employer who sees that has a reason to feature
 * the job (the 99 USD Samuel approved on 14 November 2026, buyable from every job page) or to post here directly.
 * No personal data: a click is a job id and a time, nothing about the visitor.
 */
import "server-only";
import { hasDatabase, query } from "@/lib/db";

/** Lever's documented tag for a job board that sends applicants on (help.lever.co, "Tracking conversions from custom job sites"). */
const LEVER_SOURCE = "Ittsui Works";

/** The employer's apply link with Ittsui Works as the source. Parameters already on the link are never changed. */
export function trackedApplyUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return raw;
  const add = (key: string, value: string) => {
    if (!url.searchParams.has(key)) url.searchParams.append(key, value);
  };
  if (url.hostname === "lever.co" || url.hostname.endsWith(".lever.co")) {
    add("lever-origin", "applied");
    add("lever-source[]", LEVER_SOURCE);
  }
  add("utm_source", "ittsuiworks");
  add("utm_medium", "job_board");
  return url.toString();
}

/** Link checkers, crawlers and previews are not applicants. */
const NOT_A_PERSON = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|scan|curl|wget|python|httpclient|go-http|^node|undici|axios|okhttp|java\/|facebookexternalhit|embedly|whatsapp|telegram|slack|discord/i;
export const isPerson = (userAgent: string | null) => Boolean(userAgent) && !NOT_A_PERSON.test(userAgent!);

export async function countApplyClick(jobId: string): Promise<void> {
  await query(`INSERT INTO apply_clicks (job_id) VALUES ($1)`, [jobId]);
}

/** Apply clicks sent to each employer, for the admin page and the daily summary. */
export async function clicksByEmployer(days = 30, limit = 15): Promise<{ company: string; jobs: number; clicks: number }[]> {
  if (!hasDatabase()) return [];
  const rows = await query<{ company: string; jobs: string; clicks: string }>(
    `SELECT c.name AS company, count(DISTINCT a.job_id) AS jobs, count(*) AS clicks
       FROM apply_clicks a JOIN jobs j ON j.id = a.job_id JOIN companies c ON c.id = j.company_id
      WHERE a.at > now() - make_interval(days => $1)
      GROUP BY c.name ORDER BY count(*) DESC, c.name LIMIT $2`,
    [days, limit],
  );
  return rows.map((r) => ({ company: r.company, jobs: Number(r.jobs), clicks: Number(r.clicks) }));
}
