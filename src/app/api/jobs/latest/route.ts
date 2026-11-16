import { listJobs, type JobFilter } from "@/lib/market";

/**
 * The six newest live jobs (featured first), for the home page. Cached at the edge for five minutes, per filter.
 * ?filter= is one of the home page's filter strip keys (16 Nov 2026); anything else means all roles.
 */
const FILTERS: Record<string, JobFilter> = {
  datacenter: { trade: "datacenter" },
  hvac: { trade: "hvac" },
  marine: { trade: "marine" },
  electrical: { titleWord: "electric" },
  txfl: { country: "US", txfl: true },
};

export async function GET(request: Request) {
  try {
    const key = new URL(request.url).searchParams.get("filter") ?? "";
    const { jobs } = await listJobs({ perPage: 6, ...(FILTERS[key] ?? {}) });
    const slim = jobs.map(({ id, title, trade, employment, country, city, pay_min, pay_max, pay_currency, pay_unit, published_at, sponsored_until, company_name }) => ({
      id,
      title,
      trade,
      employment,
      country,
      city,
      pay_min,
      pay_max,
      pay_currency,
      pay_unit,
      published_at,
      sponsored_until,
      company_name,
    }));
    return Response.json({ jobs: slim }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch {
    return Response.json({ jobs: [] });
  }
}
