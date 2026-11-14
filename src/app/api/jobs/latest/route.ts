import { listJobs } from "@/lib/market";

/** The six newest live jobs (featured first), for the home page. Cached at the edge for five minutes. */
export async function GET() {
  try {
    const { jobs } = await listJobs({ perPage: 6 });
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
