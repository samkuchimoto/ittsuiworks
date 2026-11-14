import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { fill, getDictionary } from "@/content";
import { JobCard } from "@/components/JobCard";
import { PageHead, Shell } from "@/components/Shell";
import { Cta } from "@/components/Typo";
import { TRADES, isTrade } from "@/lib/config";
import { countryName, isCountry } from "@/lib/countries";
import { jobCountries, listJobs } from "@/lib/market";
import { alternates } from "@/lib/seo";
import { isLocale, pathFor } from "@/lib/site";

export async function generateMetadata({ params, searchParams }: PageProps<"/[lang]/jobs">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang);
  const sp = await searchParams;
  const filtered = Object.keys(sp).length > 0;
  return {
    title: t.meta.jobsTitle,
    description: t.meta.jobsDescription,
    alternates: alternates(lang, "/jobs"),
    // Filtered and paged lists stay out of the index; the job pages themselves are indexed.
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

const PER_PAGE = 20;

export default async function Jobs({ params, searchParams }: PageProps<"/[lang]/jobs">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await connection();
  const t = getDictionary(lang);
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const trade = isTrade(one(sp.trade)) ? one(sp.trade) : "";
  const country = isCountry(one(sp.country).toUpperCase()) ? one(sp.country).toUpperCase() : "";
  const q = one(sp.q).trim().slice(0, 60);
  const page = Math.max(1, Math.min(50, Number(one(sp.page)) || 1));

  const [{ jobs, total }, countries] = await Promise.all([listJobs({ trade, country, q, page, perPage: PER_PAGE }), jobCountries()]);
  const countryList = [...new Set([...countries, ...(country ? [country] : [])])]
    .map((c) => [c, countryName(c, lang)] as [string, string])
    .sort((a, b) => a[1].localeCompare(b[1], lang));
  const filtered = Boolean(trade || country || q);
  const pageLink = (n: number) => {
    const s = new URLSearchParams();
    if (trade) s.set("trade", trade);
    if (country) s.set("country", country);
    if (q) s.set("q", q);
    if (n > 1) s.set("page", String(n));
    const str = s.toString();
    return `${pathFor(lang, "/jobs")}${str ? `?${str}` : ""}`;
  };
  const pages = Math.ceil(total / PER_PAGE);

  return (
    <Shell lang={lang} t={t} current="/jobs">
      <PageHead lang={lang} t={t} path="/jobs" label={t.jobs.label} title={t.jobs.title} intro={t.jobs.intro} />

      <section className="mx-auto max-w-[1280px] px-4 py-12 sm:px-8 lg:py-16">
        <form action={pathFor(lang, "/jobs")} className="grid gap-3 rounded-2xl bg-white p-5 shadow-[0_30px_60px_-45px_rgb(15_39_71/0.6)] ring-1 ring-navy/10 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
          <label className="block">
            <span className="mb-1.5 block text-[14px] font-semibold text-navy">{t.jobs.trade}</span>
            <select name="trade" defaultValue={trade} className="field">
              <option value="">{t.jobs.allTrades}</option>
              {TRADES.map((k) => (
                <option key={k} value={k}>
                  {t.ui.trades[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[14px] font-semibold text-navy">{t.jobs.country}</span>
            <select name="country" defaultValue={country} className="field">
              <option value="">{t.jobs.allCountries}</option>
              {countryList.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[14px] font-semibold text-navy">{t.jobs.search}</span>
            <input name="q" defaultValue={q} maxLength={60} placeholder={t.jobs.searchHint} className="field placeholder:text-mute/70" />
          </label>
          <button type="submit" className="h-[50px] rounded-md bg-navy px-6 text-[15.5px] font-semibold text-white transition hover:bg-navy-deep">
            {t.jobs.filter}
          </button>
        </form>

        <p className="mt-8 text-[15px] font-semibold text-mute" aria-live="polite">
          {total === 1 ? t.jobs.countOne : fill(t.jobs.count, { n: total })}
        </p>

        {jobs.length > 0 ? (
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <li key={job.id}>
                <JobCard job={job} lang={lang} t={t.ui} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-5 rounded-2xl bg-mist p-10 text-center ring-1 ring-line">
            <p className="font-display text-[26px] text-navy">{filtered ? t.jobs.empty : t.jobs.emptyAll}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Cta href={pathFor(lang, "/post-job")}>{t.jobs.emptyCta}</Cta>
              <Cta href={`${pathFor(lang)}#technicians`} tone="white">
                {t.jobs.alerts}
              </Cta>
            </div>
          </div>
        )}

        {pages > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-4 text-[15px] font-semibold text-navy" aria-label="Pages">
            {page > 1 && (
              <a href={pageLink(page - 1)} className="rounded-md px-4 py-2 ring-1 ring-line hover:ring-navy">
                {t.jobs.previous}
              </a>
            )}
            <span className="text-mute">
              {page} / {pages}
            </span>
            {page < pages && (
              <a href={pageLink(page + 1)} className="rounded-md px-4 py-2 ring-1 ring-line hover:ring-navy">
                {t.jobs.next}
              </a>
            )}
          </nav>
        )}

        {jobs.length > 0 && (
          <div className="mt-12 flex flex-col items-start justify-between gap-4 rounded-2xl bg-navy p-7 text-white sm:flex-row sm:items-center">
            <p className="font-display text-[24px] leading-tight">{t.technicians.title}</p>
            <Cta href={`${pathFor(lang)}#technicians`} className="shrink-0">
              {t.jobs.alerts}
            </Cta>
          </div>
        )}
      </section>
    </Shell>
  );
}
