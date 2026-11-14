import { getDictionary } from "@/content";
import { countryName } from "@/lib/countries";
import { payText } from "@/lib/format";
import { allLiveJobs } from "@/lib/market";
import { SITE_URL, pathFor } from "@/lib/site";

/**
 * Every live job as an XML feed in the common job-board format (publisher, job, title, date, url, company, city,
 * country, description, salary, jobtype, category). Job search engines and aggregators read it; one feed, many
 * employers. Each job links back to its page here, where technicians apply.
 */
const cdata = (value: string) => `<![CDATA[${value.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
const JOBTYPE: Record<string, string> = { full_time: "fulltime", part_time: "parttime", contract: "contract", temporary: "temporary" };

export async function GET() {
  const t = getDictionary("en");
  const jobs = await allLiveJobs().catch(() => []);
  const items = jobs.map((job) => {
    const lang = job.lang === "ja" ? "ja" : "en";
    const pay = payText(job, getDictionary(lang).ui, lang);
    return [
      "<job>",
      `<title>${cdata(job.title)}</title>`,
      `<date>${cdata(new Date(job.published_at!).toUTCString())}</date>`,
      `<referencenumber>${cdata(job.id)}</referencenumber>`,
      `<url>${cdata(`${SITE_URL}${pathFor(lang, `/jobs/${job.id}`)}`)}</url>`,
      `<company>${cdata(job.company_name ?? "")}</company>`,
      `<city>${cdata(job.city)}</city>`,
      `<country>${cdata(job.country)}</country>`,
      `<countryname>${cdata(countryName(job.country, "en"))}</countryname>`,
      `<description>${cdata([job.description, job.certifications ? `\n\n${t.job.certs}: ${job.certifications}` : ""].join(""))}</description>`,
      pay ? `<salary>${cdata(pay)}</salary>` : "",
      `<jobtype>${cdata(JOBTYPE[job.employment] ?? job.employment)}</jobtype>`,
      `<category>${cdata(t.ui.trades[job.trade as keyof typeof t.ui.trades] ?? job.trade)}</category>`,
      `<expirationdate>${cdata(new Date(job.expires_at!).toISOString().slice(0, 10))}</expirationdate>`,
      "</job>",
    ]
      .filter(Boolean)
      .join("");
  });
  const xml = `<?xml version="1.0" encoding="utf-8"?>\n<source><publisher>Ittsui Works</publisher><publisherurl>${SITE_URL}</publisherurl><lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n${items.join("\n")}\n</source>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
}
