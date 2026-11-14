/**
 * The daily job import (see lib/feeds.ts for the sources and filters). For each employer feed:
 *  - jobs still on the employer's page stay live (keepDays more),
 *  - jobs gone from it end at once,
 *  - new technician jobs are published on their own page and announced to search engines.
 * Imported employers are companies with status 'imported': they never receive email, leads or applications here
 * (every imported job sends applicants to the employer's own page).
 */
import "server-only";
import { IMPORT } from "./config";
import { isCountry } from "./countries";
import { hasDatabase, newId, newToken, query } from "./db";
import { FEEDS, jobFromListing, listFeed, type Feed, type FeedJob, type FeedListing } from "./feeds";
import { jobUrls, pingIndexNow } from "./market";

const sourceKey = (feed: Feed) => `${feed.ats}:${feed.slug}`;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

async function companyFor(feed: Feed): Promise<string> {
  const [row] = await query<{ id: string }>(
    `INSERT INTO companies (id, name, email, website, country, trades, lang, token, status)
     VALUES ($1, $2, $3, $4, 'US', $5, 'en', $6, 'imported')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, website = EXCLUDED.website RETURNING id`,
    [newId(), feed.name, `${feed.ats}-${feed.slug}@import.invalid`, feed.website, [feed.trade], newToken()],
  );
  return row.id;
}

type FeedResult = { source: string; listed: number; kept: number; ended: number; added: number; skipped: number; urls: string[] };

async function importFeed(feed: Feed, budget: { left: number }): Promise<FeedResult> {
  const source = sourceKey(feed);
  const listings = await listFeed(feed);
  const ids = listings.map((l) => l.sourceId);
  const kept = await query(
    `UPDATE jobs SET status = 'live', expires_at = GREATEST(COALESCE(expires_at, now()), now() + make_interval(days => $3))
     WHERE source = $1 AND source_id = ANY($2) AND status IN ('live', 'expired') RETURNING id`,
    [source, ids, IMPORT.keepDays],
  );
  const ended = await query(`UPDATE jobs SET status = 'expired' WHERE source = $1 AND status = 'live' AND NOT (source_id = ANY($2)) RETURNING id`, [source, ids]);
  // Every job ever imported from this feed, closed ones included: a job taken down by hand is never imported again.
  const known = new Set((await query<{ source_id: string }>(`SELECT source_id FROM jobs WHERE source = $1`, [source])).map((r) => r.source_id));
  const fresh: FeedListing[] = listings.filter((l) => !known.has(l.sourceId)).slice(0, Math.max(0, budget.left));
  budget.left -= fresh.length;

  const details = await mapLimit(fresh, 6, (l) => jobFromListing(feed, l).catch(() => null));
  const jobs = details.filter((j): j is FeedJob => j !== null && isCountry(j.country) && j.country !== "JP");
  const urls: string[] = [];
  if (jobs.length) {
    const companyId = await companyFor(feed);
    for (const j of jobs) {
      const [row] = await query<{ id: string }>(
        `INSERT INTO jobs (id, company_id, title, trade, employment, country, city, pay_min, pay_max, pay_currency, pay_unit,
           description, certifications, apply_url, lang, status, published_at, expires_at, source, source_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, '', $13, 'en', 'live', $14, now() + make_interval(days => $15), $16, $17)
         ON CONFLICT (source, source_id) DO NOTHING RETURNING id`,
        [newId(), companyId, j.title, feed.trade, j.employment, j.country, j.city, j.payMin, j.payMax, j.payCurrency, j.payUnit, j.description, j.applyUrl, j.postedAt ?? new Date(), IMPORT.keepDays, source, j.sourceId],
      );
      if (row) urls.push(...jobUrls(row));
    }
  }
  return { source, listed: listings.length, kept: kept.length, ended: ended.length, added: urls.length / 2, skipped: fresh.length - jobs.length, urls };
}

/** Runs every feed (four at a time). A feed that fails changes nothing for its jobs and is reported. */
export async function importJobs() {
  if (!IMPORT.on || !hasDatabase()) return { on: IMPORT.on, added: 0 };
  const budget = { left: IMPORT.maxNewPerRun };
  const failed: string[] = [];
  const results = (
    await mapLimit(FEEDS, 4, (feed) =>
      importFeed(feed, budget).catch((error) => {
        failed.push(`${sourceKey(feed)}: ${error instanceof Error ? error.message.slice(0, 80) : "unknown"}`);
        return null;
      }),
    )
  ).filter((r): r is FeedResult => r !== null);
  const urls = results.flatMap((r) => r.urls);
  if (urls.length) await pingIndexNow(urls);
  const sum = (k: "listed" | "kept" | "ended" | "added" | "skipped") => results.reduce((n, r) => n + r[k], 0);
  return {
    on: true,
    feeds: results.length,
    failed,
    listed: sum("listed"),
    added: sum("added"),
    kept: sum("kept"),
    ended: sum("ended"),
    skipped: sum("skipped"),
    bySource: Object.fromEntries(results.filter((r) => r.added || r.ended).map((r) => [r.source, `+${r.added} -${r.ended}`])),
  };
}
