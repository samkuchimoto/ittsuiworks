import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { fill, getDictionary } from "@/content";
import { jobAction, leadSettingsAction, leaveAction } from "@/app/actions";
import { Card, Notice, Shell } from "@/components/Shell";
import { Cta, Label } from "@/components/Typo";
import { TRADES, paymentsOn } from "@/lib/config";
import { countryName } from "@/lib/countries";
import { dateText, money } from "@/lib/format";
import { accountView, openAccount, sponsorPrice } from "@/lib/market";
import { privatePage } from "@/lib/seo";
import { isLocale, pathFor } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/account/[token]">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: getDictionary(lang).meta.accountTitle, ...privatePage } : privatePage;
}

const button = "rounded-md px-3.5 py-2 text-[14px] font-semibold ring-1 transition";

/** A company's account. The link in every email opens it; the first visit confirms the email and publishes waiting jobs. */
export default async function Account({ params }: PageProps<"/[lang]/account/[token]">) {
  const { lang, token } = await params;
  if (!isLocale(lang)) notFound();
  await connection();
  const opened = await openAccount(token);
  if (!opened) notFound();
  const { company, confirmed, published } = opened;
  const t = getDictionary(lang);
  const a = t.account;

  if (company.status === "left") {
    return (
      <Shell lang={lang} t={t}>
        <section className="mx-auto max-w-[820px] px-4 py-20 sm:px-8">
          <Notice>{a.left}</Notice>
        </section>
      </Shell>
    );
  }

  const { jobs, applications, leads } = await accountView(company);
  const featurePrice = sponsorPrice(company);
  const now = new Date();

  return (
    <Shell lang={lang} t={t}>
      <section className="bg-sky">
        <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-8 lg:py-14">
          <Label>{a.title}</Label>
          <h1 className="font-display mt-4 text-[36px] leading-tight text-navy sm:text-[48px]">{company.name}</h1>
          <p className="mt-2 text-[15.5px] text-mute">
            {company.email} · {countryName(company.country, lang)}
          </p>
          <div className="mt-6 space-y-3">
            {confirmed && <Notice>{a.confirmed}</Notice>}
            {published.length > 0 && <Notice>{t.postJob.liveTitle}: {published.map((j) => j.title).join(", ")}</Notice>}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1280px] gap-10 px-4 py-12 sm:px-8 lg:grid-cols-[1.5fr_1fr] lg:py-16">
        <div className="space-y-10">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="font-display text-[30px] text-navy">{a.jobs}</h2>
              <Cta href={`${pathFor(lang, "/post-job")}?account=${company.token}`}>{a.postJob}</Cta>
            </div>
            {jobs.length === 0 ? (
              <p className="mt-6 text-[15.5px] text-mute">{a.noJobs}</p>
            ) : (
              <ul className="mt-6 divide-y divide-line border-y border-line">
                {jobs.map((job) => {
                  const live = job.status === "live" && job.expires_at && new Date(job.expires_at) > now;
                  const status = live ? "live" : job.status === "live" ? "expired" : job.status;
                  const featured = job.sponsored_until && new Date(job.sponsored_until) > now;
                  return (
                    <li key={job.id} className="py-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          {live ? (
                            <a href={pathFor(lang, `/jobs/${job.id}`)} className="text-[17px] font-bold text-navy underline-offset-4 hover:underline">
                              {job.title}
                            </a>
                          ) : (
                            <p className="text-[17px] font-bold text-navy">{job.title}</p>
                          )}
                          <p className="mt-1 text-[14px] text-mute">
                            {job.city}, {countryName(job.country, lang)} · {fill(a.applications, { n: job.applications })}
                            {live && job.expires_at && ` · ${fill(a.until, { date: dateText(job.expires_at, lang) })}`}
                          </p>
                          {featured && <p className="mt-1 text-[14px] font-semibold text-orange-deep">{fill(a.featuredUntil, { date: dateText(job.sponsored_until!, lang) })}</p>}
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[12.5px] font-bold uppercase tracking-[0.12em] ${live ? "bg-sky text-navy" : "bg-mist text-mute"}`}>
                          {a.status[status as keyof typeof a.status] ?? status}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(status === "live" || status === "pending") && (
                          <form action={jobAction}>
                            <input type="hidden" name="token" value={company.token} />
                            <input type="hidden" name="job" value={job.id} />
                            <input type="hidden" name="lang" value={lang} />
                            <button name="action" value="close" className={`${button} text-ink ring-line hover:ring-navy`}>
                              {a.close}
                            </button>
                          </form>
                        )}
                        {(status === "live" || status === "expired") && (
                          <form action={jobAction}>
                            <input type="hidden" name="token" value={company.token} />
                            <input type="hidden" name="job" value={job.id} />
                            <input type="hidden" name="lang" value={lang} />
                            <button name="action" value="renew" className={`${button} text-navy ring-navy/30 hover:ring-navy`}>
                              {a.renew}
                            </button>
                          </form>
                        )}
                        {live && !featured && paymentsOn() && (
                          <form action="/api/checkout" method="post">
                            <input type="hidden" name="kind" value="sponsor" />
                            <input type="hidden" name="account" value={company.token} />
                            <input type="hidden" name="job" value={job.id} />
                            <input type="hidden" name="back" value={pathFor(lang, `/account/${company.token}`)} />
                            <button className={`${button} bg-orange text-white ring-orange hover:bg-orange-deep`}>
                              {fill(a.feature, { price: money(featurePrice.amount, featurePrice.currency, lang) })}
                            </button>
                          </form>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="font-display text-[30px] text-navy">{a.recent}</h2>
            {applications.length === 0 ? (
              <p className="mt-6 text-[15.5px] text-mute">{a.noApplications}</p>
            ) : (
              <ul className="mt-6 divide-y divide-line border-y border-line">
                {applications.map((app) => (
                  <li key={app.id} className="py-5">
                    <p className="text-[16.5px] font-bold text-navy">
                      {app.name}{" "}
                      <a href={`mailto:${app.email}`} className="font-normal underline underline-offset-4">
                        {app.email}
                      </a>
                    </p>
                    <p className="mt-1 text-[14px] text-mute">
                      {app.job_title} · {countryName(app.country, lang)} · {app.years} · {dateText(app.created_at, lang)}
                    </p>
                    <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink/85">{app.certifications}</p>
                    {app.message && <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink/70">{app.message}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-10 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <h2 className="font-display text-[28px] text-navy">{a.leads}</h2>
            <p className="mt-3 text-[15px] text-ink/80">
              {company.leads && company.trades.length
                ? fill(a.leadsOn, { trades: company.trades.map((k) => t.ui.trades[k as keyof typeof t.ui.trades] ?? k).join(", ") })
                : a.leadsOff}
            </p>
            <form action={leadSettingsAction} className="mt-5 space-y-4">
              <input type="hidden" name="token" value={company.token} />
              <input type="hidden" name="lang" value={lang} />
              <fieldset>
                <legend className="mb-2 text-[14px] font-semibold text-navy">{a.trades}</legend>
                <div className="flex flex-wrap gap-2">
                  {TRADES.map((k) => (
                    <label key={k} className="cursor-pointer">
                      <input type="checkbox" name="trades" value={k} defaultChecked={company.trades.includes(k)} className="peer sr-only" />
                      <span className="inline-flex rounded-full border border-line px-4 py-2 text-[14px] transition peer-checked:border-navy peer-checked:bg-navy peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-orange">
                        {t.ui.trades[k]}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="space-y-2 text-[14.5px]">
                <label className="flex items-center gap-3">
                  <input type="radio" name="abroad" value="no" defaultChecked={!company.abroad} className="size-4 accent-navy" />
                  {fill(a.home, { country: countryName(company.country, lang) })}
                </label>
                <label className="flex items-center gap-3">
                  <input type="radio" name="abroad" value="yes" defaultChecked={company.abroad} className="size-4 accent-navy" />
                  {a.abroad}
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button name="leads" value="on" className={`${button} bg-navy text-white ring-navy hover:bg-navy-deep`}>
                  {company.leads ? a.save : a.turnOn}
                </button>
                {company.leads && (
                  <button name="leads" value="off" className={`${button} text-ink ring-line hover:ring-navy`}>
                    {a.turnOff}
                  </button>
                )}
              </div>
            </form>
            {leads.length === 0 ? (
              <p className="mt-6 border-t border-line pt-5 text-[15px] text-mute">{a.noLeads}</p>
            ) : (
              <ul className="mt-6 divide-y divide-line border-t border-line">
                {leads.map((lead) => (
                  <li key={lead.token} className="flex items-center justify-between gap-3 py-4">
                    <a href={pathFor(lang, `/lead/${lead.token}`)} className="text-[15px] font-semibold text-navy underline-offset-4 hover:underline">
                      {lead.title}
                      <span className="block text-[13.5px] font-normal text-mute">
                        {lead.city}, {countryName(lead.country, lang)}
                      </span>
                    </a>
                    <span className="shrink-0 text-[13px] font-bold uppercase tracking-[0.1em] text-orange">{lead.paid_at ? a.leadTaken : a.leadOpen}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <form action={leaveAction} className="rounded-2xl bg-mist p-6 ring-1 ring-line">
            <input type="hidden" name="token" value={company.token} />
            <input type="hidden" name="lang" value={lang} />
            <p className="text-[14.5px] text-mute">{a.leaveText}</p>
            <button className={`${button} mt-3 text-orange-deep ring-orange/40 hover:ring-orange`}>{a.leave}</button>
          </form>
        </div>
      </section>
    </Shell>
  );
}
