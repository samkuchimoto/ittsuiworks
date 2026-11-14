import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { fill, getDictionary } from "@/content";
import { ApplyForm } from "@/components/Forms";
import { JobCard } from "@/components/JobCard";
import { LangSwitch } from "@/components/LangSwitch";
import { Card, Shell } from "@/components/Shell";
import { Label } from "@/components/Typo";
import { collectsSeekers, paymentsOn } from "@/lib/config";
import { countryName, countryOptions } from "@/lib/countries";
import { dateText, money, payText } from "@/lib/format";
import { getJob, isLive, listJobs, sponsorPrice } from "@/lib/market";
import { alternates } from "@/lib/seo";
import { SITE_URL, isLocale, pathFor, type Locale } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/jobs/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  if (!isLocale(lang)) return {};
  const job = await getJob(id);
  if (!job) return {};
  const t = getDictionary(lang);
  const where = `${job.city}, ${countryName(job.country, lang)}`;
  const title = `${job.title}, ${job.company_name} (${where}) | Ittsui Works`;
  const description = `${t.ui.trades[job.trade as keyof typeof t.ui.trades] ?? job.trade}. ${payText(job, t.ui, lang)} ${job.description}`.replace(/\s+/g, " ").slice(0, 155);
  return {
    title,
    description,
    // One indexed address per job: the language it was written in.
    alternates: alternates(lang, `/jobs/${job.id}`, job.lang === "ja" ? "ja" : "en"),
    robots: isLive(job) ? undefined : { index: false, follow: true },
    openGraph: { title, description, type: "website" },
  };
}

const EMPLOYMENT_TYPE: Record<string, string> = { full_time: "FULL_TIME", part_time: "PART_TIME", contract: "CONTRACTOR", temporary: "TEMPORARY" };
const UNIT: Record<string, string> = { hour: "HOUR", month: "MONTH", year: "YEAR" };

export default async function JobPage({ params }: PageProps<"/[lang]/jobs/[id]">) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  await connection();
  const job = await getJob(id);
  if (!job) notFound();
  const t = getDictionary(lang);
  const live = isLive(job);
  const pay = payText(job, t.ui, lang);
  const external = Boolean(job.apply_url) || !collectsSeekers(job.country);
  const applyHref = job.apply_url.includes("@") && !job.apply_url.startsWith("http") ? `mailto:${job.apply_url}` : job.apply_url;
  const featured = job.sponsored_until !== null && new Date(job.sponsored_until) > new Date();
  const canFeature = live && !featured && paymentsOn();
  const featurePrice = sponsorPrice({ country: job.country });
  const similar = live ? (await listJobs({ trade: job.trade, perPage: 4 })).jobs.filter((j) => j.id !== job.id).slice(0, 3) : [];

  const posting = live && {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!).replace(/\n/g, "<br>")}</p>`)
      .join("") + (job.certifications ? `<p>${t.job.certs}: ${job.certifications.replace(/[&<>]/g, "")}</p>` : ""),
    identifier: { "@type": "PropertyValue", name: "Ittsui Works", value: job.id },
    datePosted: new Date(job.published_at!).toISOString(),
    validThrough: new Date(job.expires_at!).toISOString(),
    employmentType: EMPLOYMENT_TYPE[job.employment],
    industry: t.ui.trades[job.trade as keyof typeof t.ui.trades],
    hiringOrganization: { "@type": "Organization", name: job.company_name, ...(job.company_website ? { sameAs: job.company_website } : {}) },
    jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: job.city, addressCountry: job.country } },
    ...(job.pay_min || job.pay_max
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: job.pay_currency,
            value: {
              "@type": "QuantitativeValue",
              ...(job.pay_min && job.pay_max && Number(job.pay_max) > Number(job.pay_min)
                ? { minValue: Number(job.pay_min), maxValue: Number(job.pay_max) }
                : { value: Number(job.pay_min ?? job.pay_max) }),
              unitText: UNIT[job.pay_unit],
            },
          },
        }
      : {}),
    directApply: !external,
    url: `${SITE_URL}${pathFor(job.lang === "ja" ? "ja" : "en", `/jobs/${job.id}`)}`,
  };

  const facts: [string, string][] = [
    [t.job.trade, t.ui.trades[job.trade as keyof typeof t.ui.trades] ?? job.trade],
    [t.job.type, t.ui.employment[job.employment as keyof typeof t.ui.employment] ?? job.employment],
    [t.job.place, `${job.city}, ${countryName(job.country, lang)}`],
    [t.job.pay, pay || t.ui.payNotListed],
    ...(job.published_at ? ([[t.job.posted, dateText(job.published_at, lang)]] as [string, string][]) : []),
  ];

  return (
    <Shell lang={lang} t={t} current="/jobs">
      {posting && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(posting).replace(/</g, "\\u003c") }} />}
      <section className="relative overflow-hidden bg-sky">
        <div aria-hidden="true" className="blueprint absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black_35%,transparent_80%)]" />
        <div className="relative mx-auto max-w-[1280px] px-4 pb-12 pt-8 sm:px-8 lg:pb-16">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <a href={pathFor(lang, "/jobs")} className="text-[14.5px] font-semibold text-navy underline-offset-4 hover:underline">
              ← {t.job.back}
            </a>
            <LangSwitch lang={lang} path={`/jobs/${job.id}`} label={t.hero.language} />
          </div>
          <div className="mt-8 max-w-[900px]">
            <Label>{t.ui.trades[job.trade as keyof typeof t.ui.trades]}</Label>
            <h1 lang={job.lang} className="font-display mt-4 text-[36px] leading-[1.1] text-navy sm:text-[48px] lg:text-[56px]">
              {job.title}
            </h1>
            <p className="mt-3 text-[18px] font-semibold text-ink/85">
              {job.company_name}
              {job.company_website && (
                <>
                  {" · "}
                  <a href={job.company_website} rel="nofollow noopener" target="_blank" className="font-normal text-navy underline underline-offset-4">
                    {new URL(job.company_website).hostname.replace(/^www\./, "")}
                  </a>
                </>
              )}
            </p>
            {job.source && job.company_name && <p className="mt-2 text-[14.5px] text-mute">{fill(t.job.source, { company: job.company_name })}</p>}
            {!live && (
              <p role="status" className="mt-6 inline-block rounded-xl bg-orange/10 px-5 py-3 text-[15.5px] font-semibold text-orange-deep">
                {t.job.closed} {t.job.closedText}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1280px] gap-10 px-4 py-12 sm:px-8 lg:grid-cols-[1.4fr_1fr] lg:gap-14 lg:py-16">
        <div>
          <dl className="grid gap-px overflow-hidden rounded-2xl bg-line ring-1 ring-line sm:grid-cols-2">
            {facts.map(([k, v]) => (
              <div key={k} className="bg-white px-6 py-4 sm:[&:last-child:nth-child(odd)]:col-span-2">
                <dt className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-orange">{k}</dt>
                <dd className="mt-1 text-[16px] font-semibold text-navy">{v}</dd>
              </div>
            ))}
          </dl>
          <h2 className="font-display mt-10 text-[30px] text-navy">{t.job.about}</h2>
          <div lang={job.lang} className="mt-4 whitespace-pre-line text-[16.5px] leading-[1.8] text-ink/85">
            {job.description}
          </div>
          {job.certifications && (
            <p lang={job.lang} className="mt-6 rounded-xl bg-sky px-5 py-4 text-[15.5px] text-ink/85">
              <span className="font-bold text-navy">{t.job.certs}: </span>
              {job.certifications}
            </p>
          )}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          {live && (
            <Card>
              {external ? (
                <div>
                  <p className="font-display text-[28px] leading-tight text-navy">{t.job.applyExternal}</p>
                  <p className="mt-3 text-[15.5px] text-ink/80">{t.job.applyExternalText}</p>
                  {applyHref && (
                    <a
                      href={applyHref}
                      rel="nofollow noopener"
                      target="_blank"
                      className="mt-6 inline-flex items-center gap-3 rounded-md bg-orange px-7 py-4 text-[16px] font-semibold text-white transition hover:bg-orange-deep"
                    >
                      {t.job.applyExternal}
                    </a>
                  )}
                </div>
              ) : (
                <>
                  <p className="font-display text-[28px] leading-tight text-navy">{t.job.apply}</p>
                  <p className="mb-6 mt-2 text-[15px] text-mute">{t.job.applyText}</p>
                  <ApplyForm lang={lang} t={{ form: t.form, job: t.job }} jobId={job.id} countries={countryOptions(lang as Locale)} />
                </>
              )}
            </Card>
          )}
          {canFeature && (
            <form action="/api/checkout" method="post" className="mt-6 rounded-2xl bg-mist px-6 py-5 ring-1 ring-line">
              <input type="hidden" name="kind" value="feature" />
              <input type="hidden" name="job" value={job.id} />
              <input type="hidden" name="lang" value={lang} />
              <input type="hidden" name="back" value={pathFor(lang, `/jobs/${job.id}`)} />
              <p className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-orange">{t.job.employers}</p>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink/80">{t.job.featureText}</p>
              <button className="mt-4 rounded-md px-5 py-2.5 text-[14.5px] font-semibold text-navy ring-1 ring-navy/30 transition hover:ring-navy">
                {fill(t.job.featureButton, { price: money(featurePrice.amount, featurePrice.currency, lang) })}
              </button>
            </form>
          )}
        </div>
      </section>

      {similar.length > 0 && (
        <section className="bg-mist py-14">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-8">
            <h2 className="font-display text-[30px] text-navy">{t.job.similar}</h2>
            <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((j) => (
                <li key={j.id}>
                  <JobCard job={j} lang={lang} t={t.ui} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </Shell>
  );
}
