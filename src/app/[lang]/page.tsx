import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { fill, getDictionary } from "@/content";
import { AlertForm } from "@/components/Forms";
import { Film } from "@/components/Film";
import { Footer } from "@/components/Footer";
import { NavBar, TopBar } from "@/components/Header";
import { ArrowIcon, CheckIcon, PlusIcon } from "@/components/Icons";
import { LangSwitch } from "@/components/LangSwitch";
import { LatestJobs } from "@/components/LatestJobs";
import { Mark } from "@/components/Logo";
import { Photo } from "@/components/Photo";
import { Cta, Label, Title } from "@/components/Typo";
import { PRICING, collectsSeekers, paymentsOn } from "@/lib/config";
import { countryOptions } from "@/lib/countries";
import { money } from "@/lib/format";
import { alternates } from "@/lib/seo";
import { BRAND, EMAIL, SITE_URL, isLocale, pathFor } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { alternates: alternates(lang, "/") };
}

const delay = (i: number) => ({ "--delay": `${i * 90}ms` }) as CSSProperties;

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const [heroA, heroB] = t.hero.images;
  const at = (path: string) => pathFor(lang, path);
  // Prices show only once Samuel has approved them and Stripe is connected.
  const priced = paymentsOn();
  const leadPrice = money(PRICING.lead.USD, "USD", lang);
  const sponsorPrice = money(PRICING.sponsor.USD, "USD", lang);
  // Japanese visitors see job alerts once the MHLW notification is filed (JAPAN_SEEKER_DATA).
  const alertsHere = lang !== "ja" || collectsSeekers("JP");
  const alertCountries = countryOptions(lang).filter(([code]) => collectsSeekers(code));

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND,
    alternateName: "一対ワークス",
    url: SITE_URL,
    logo: `${SITE_URL}/apple-icon.png`,
    email: EMAIL,
    description: t.meta.description,
    parentOrganization: { "@type": "Organization", name: "Kuchimoto LLC" },
  };
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND,
    url: SITE_URL,
    potentialAction: { "@type": "SearchAction", target: `${SITE_URL}/jobs?q={search_term_string}`, "query-input": "required name=search_term_string" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }} />
      <TopBar lang={lang} t={t.header} />
      <NavBar lang={lang} items={t.nav} />

      <main id="top">
        {/* Hero: bright sky, navy type on the left, the two entrances stacked below, buyers on a third line. */}
        <section aria-labelledby="hero-title" className="relative bg-white">
          <div className="relative overflow-hidden lg:h-[clamp(620px,calc(100svh-150px),800px)]">
            <div className="relative aspect-[16/10] overflow-hidden sm:aspect-[16/8] lg:absolute lg:inset-0 lg:aspect-auto">
              <Photo name={heroA.name} alt={heroA.alt} priority sizes="100vw" className="hero-a absolute inset-0 size-full object-cover object-[72%_center]" />
              <Photo name={heroB.name} alt="" sizes="100vw" className="hero-b absolute inset-0 size-full object-cover object-[72%_center]" />
              <div
                aria-hidden="true"
                className="absolute inset-0 hidden bg-[linear-gradient(90deg,#ffffff_0%,rgba(255,255,255,0.93)_28%,rgba(255,255,255,0.6)_46%,rgba(255,255,255,0)_64%)] lg:block"
              />
              <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent lg:hidden" />
            </div>
            <LangSwitch lang={lang} label={t.hero.language} className="absolute right-4 top-4 z-10 sm:right-8 lg:top-7" />

            <div className="relative mx-auto max-w-[1280px] px-4 pb-14 sm:px-8 lg:flex lg:h-full lg:items-center lg:pb-10">
              <div className="max-w-[800px]">
                <p className={`font-display text-[20px] text-navy sm:text-[24px] lg:text-[27px] ${lang === "en" ? "italic" : ""}`}>{t.hero.kicker}</p>
                <h1 id="hero-title" className="font-display mt-3 text-[44px] leading-[1.04] tracking-[-0.015em] text-navy sm:text-[62px] lg:text-[72px]">
                  {t.hero.title.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </h1>
                <p className="mt-6 max-w-[580px] text-[17px] leading-[1.75] text-ink/85 lg:text-[18px]">{t.hero.lead}</p>
                <div className="mt-8 flex flex-col gap-3 sm:max-w-[360px]">
                  <a
                    href={at("/post-job")}
                    className="group flex items-center justify-between gap-4 rounded-lg bg-orange px-6 py-[18px] text-[17px] font-semibold text-white shadow-[0_16px_36px_-14px_rgb(200_70_27/0.85)] transition hover:-translate-y-0.5 hover:bg-orange-deep"
                  >
                    {t.hero.primary}
                    <span className="grid size-8 place-items-center rounded-full bg-white/20 transition group-hover:bg-white/30">
                      <ArrowIcon />
                    </span>
                  </a>
                  <a
                    href={at("/jobs")}
                    className="group flex items-center justify-between gap-4 rounded-lg bg-navy px-6 py-[18px] text-[17px] font-semibold text-white shadow-[0_16px_36px_-16px_rgb(15_39_71/0.9)] transition hover:-translate-y-0.5 hover:bg-navy-deep"
                  >
                    {t.hero.secondary}
                    <span className="grid size-8 place-items-center rounded-full bg-white/15 transition group-hover:bg-white/25">
                      <ArrowIcon />
                    </span>
                  </a>
                </div>
                <p className="mt-5 text-[15.5px] text-ink/80">
                  {t.hero.projectQuestion}{" "}
                  <a href={at("/post-project")} className="font-semibold text-navy underline underline-offset-4 hover:text-orange">
                    {t.hero.projectLink}
                  </a>
                </p>
              </div>
            </div>
          </div>

          <div className="relative z-10 mx-auto max-w-[1280px] px-4 sm:px-8 lg:-mt-11">
            <ul className="grid divide-y divide-line rounded-xl bg-white shadow-[0_28px_60px_-32px_rgb(15_39_71/0.5)] ring-1 ring-navy/8 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {t.facts.map((fact) => (
                <li key={fact} className="flex items-center gap-4 px-6 py-5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sky text-navy">
                    <CheckIcon className="size-[18px]" />
                  </span>
                  <span className="text-[15.5px] font-semibold text-navy">{fact}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Live jobs, loaded after the page; hidden when there are none. */}
        <LatestJobs lang={lang} t={{ latest: t.latest, ui: t.ui }} />

        {/* The bottleneck, from first principles: projects are signed with money and finished by hands. */}
        <section id="bottleneck" aria-labelledby="bottleneck-title" className="relative mt-16 overflow-hidden bg-navy-deep py-20 text-white lg:mt-24 lg:py-28">
          <div className="absolute inset-x-0 top-0 h-[92svh] max-h-[980px] min-h-[620px]">
            <Film name="film-thermal" />
            <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,27,51,0.62)_0%,rgba(10,27,51,0.3)_55%,rgba(10,27,51,0.5)_100%)]" />
            <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,27,51,0.35)_0%,rgba(10,27,51,0.15)_40%,rgba(10,27,51,0.75)_78%,#0a1b33_100%)]" />
          </div>
          <div aria-hidden="true" className="blueprint-dark absolute inset-0 opacity-60" />
          <div className="relative mx-auto max-w-[1280px] px-4 sm:px-8">
            <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-end lg:gap-16">
              <div>
                <Label light>{t.bottleneck.label}</Label>
                <Title id="bottleneck-title" light className="lg:text-[58px]">
                  {t.bottleneck.title}
                </Title>
              </div>
              <p className="max-w-[34rem] text-[17.5px] leading-relaxed text-white/75">{t.bottleneck.intro}</p>
            </div>

            <div data-reveal className="mt-16">
              <ol className="relative grid grid-cols-5">
                <li aria-hidden="true" className="absolute left-[10%] right-[10%] top-[22px] h-px bg-white/25" />
                {t.bottleneck.chain.map((step, i) => {
                  const waiting = i >= 1 && i <= 3;
                  return (
                    <li key={step} className="relative flex flex-col items-center text-center">
                      <span
                        className={`font-display grid size-11 place-items-center rounded-full text-[18px] ${waiting ? "bg-orange text-white shadow-[0_0_0_6px_rgb(200_70_27/0.22)]" : "bg-navy text-white/80 ring-1 ring-white/30"}`}
                      >
                        {i + 1}
                      </span>
                      <span className={`mt-3 text-[13.5px] font-semibold sm:text-[16px] ${waiting ? "text-white" : "text-white/65"}`}>{step}</span>
                    </li>
                  );
                })}
              </ol>
              <div className="grid grid-cols-5">
                <div className="col-span-3 col-start-2 px-[8%]">
                  <div aria-hidden="true" className="mt-4 h-4 rounded-b-xl border-x-2 border-b-2 border-amber/80" />
                  <p className="mt-3 text-center text-[14px] font-bold tracking-wide text-amber sm:text-[16px]">{t.bottleneck.bracket}</p>
                </div>
              </div>
            </div>

            <ol className="mt-16 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {t.bottleneck.items.map((item, i) => (
                <li key={item.title} data-reveal style={delay(i)} className="border-t border-white/15 pt-6">
                  <span className="font-display text-[40px] leading-none text-amber">0{i + 1}</span>
                  <h3 className="mt-4 text-[18.5px] font-bold">{item.title}</h3>
                  <p className="mt-2 text-[15.5px] leading-relaxed text-white/75">{item.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* How it works: two pairs (a job and a technician, a project and a company), then the buyer's entrance. */}
        <section id="how" aria-labelledby="how-title" className="relative scroll-mt-16 overflow-hidden bg-sky py-20 lg:py-28">
          <div aria-hidden="true" className="blueprint absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
          <div className="relative mx-auto max-w-[1280px] px-4 sm:px-8">
            <div className="mx-auto max-w-[780px] text-center">
              <Label center>{t.how.label}</Label>
              <Title id="how-title">{t.how.title}</Title>
              <p className="mx-auto mt-5 max-w-[42rem] text-[17.5px] leading-relaxed text-mute">{t.how.intro}</p>
            </div>
            <div className="mt-14 grid gap-6 lg:grid-cols-[1fr_128px_1fr] lg:gap-0">
              {[
                { side: t.how.hire, href: at("/post-job"), dark: true },
                { side: t.how.win, href: at("/companies"), dark: false },
              ].map(({ side, href, dark }, n) => (
                <div key={side.title} className={n === 1 ? "lg:col-start-3" : ""}>
                  <div
                    data-reveal
                    style={delay(n)}
                    className={`flex h-full flex-col rounded-2xl p-8 lg:p-11 ${dark ? "bg-navy text-white shadow-[0_40px_80px_-40px_rgb(10_27_51/0.9)]" : "bg-white shadow-[0_40px_80px_-50px_rgb(15_39_71/0.6)] ring-1 ring-navy/10"}`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span aria-hidden="true" className={`block size-4 rounded-full ${dark ? "bg-amber" : "bg-navy"}`} />
                      <span className={`rounded-full px-3 py-1 text-[12.5px] font-bold uppercase tracking-[0.14em] ${dark ? "bg-white/10 text-amber" : "bg-sky text-orange"}`}>{side.tag}</span>
                    </div>
                    <h3 className={`font-display mt-5 text-[30px] leading-tight lg:text-[34px] ${dark ? "" : "text-navy"}`}>{side.title}</h3>
                    <ol className="mt-7 space-y-6">
                      {side.steps.map((step, i) => (
                        <li key={step.title} className="flex gap-4">
                          <span className={`font-display grid size-9 shrink-0 place-items-center rounded-full text-[17px] ${dark ? "bg-white/10 text-amber" : "bg-sky text-navy"}`}>{i + 1}</span>
                          <div>
                            <p className={`text-[17px] font-bold ${dark ? "" : "text-navy"}`}>{step.title}</p>
                            <p className={`mt-1 text-[15.5px] leading-relaxed ${dark ? "text-white/80" : "text-ink/80"}`}>{step.text}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-auto pt-8">
                      <Cta href={href} tone={dark ? "orange" : "navy"}>
                        {side.cta}
                      </Cta>
                    </div>
                  </div>
                </div>
              ))}
              <div aria-hidden="true" className="relative hidden items-center justify-center lg:col-start-2 lg:row-start-1 lg:flex">
                <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-navy/25" />
                <div className="relative grid size-24 place-items-center rounded-full bg-white shadow-[0_20px_40px_-20px_rgb(15_39_71/0.6)] ring-1 ring-navy/10">
                  <Mark className="size-14" />
                </div>
              </div>
            </div>
            <div data-reveal className="mt-6 flex flex-col items-start justify-between gap-5 rounded-2xl bg-white p-7 ring-1 ring-navy/10 sm:flex-row sm:items-center lg:px-11">
              <div>
                <p className="font-display text-[26px] leading-tight text-navy">{t.how.buyer.title}</p>
                <p className="mt-2 max-w-[44rem] text-[15.5px] leading-relaxed text-ink/80">{t.how.buyer.text}</p>
              </div>
              <Cta href={at("/post-project")} tone="white" className="shrink-0">
                {t.how.buyer.cta}
              </Cta>
            </div>
          </div>
        </section>

        {/* Three industries. Each card links to its live jobs. */}
        <section aria-labelledby="sectors-title" className="bg-mist py-20 lg:py-28">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-8">
            <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
              <div>
                <Label>{t.sectors.label}</Label>
                <Title id="sectors-title">{t.sectors.title}</Title>
              </div>
              <p className="max-w-[34rem] text-[17.5px] leading-relaxed text-mute lg:justify-self-end">{t.sectors.intro}</p>
            </div>
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {t.sectors.items.map((sector, i) => (
                <article
                  key={sector.id}
                  id={sector.id}
                  data-reveal
                  style={delay(i)}
                  className="group flex scroll-mt-24 flex-col overflow-hidden rounded-2xl bg-white shadow-[0_30px_60px_-42px_rgb(15_39_71/0.55)] ring-1 ring-navy/8"
                >
                  <div className="aspect-[16/10] overflow-hidden">
                    <Photo name={sector.image.name} alt={sector.image.alt} sizes="(min-width: 1024px) 30vw, 100vw" className="size-full object-cover transition duration-700 group-hover:scale-[1.04]" />
                  </div>
                  <div className="flex flex-1 flex-col p-7 lg:p-8">
                    <h3 className="font-display text-[30px] leading-tight text-navy">{sector.title}</h3>
                    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
                      {[
                        [t.sectors.recruit, sector.recruit],
                        [t.sectors.find, sector.find],
                      ].map(([title, items]) => (
                        <div key={title as string}>
                          <p className="text-[12.5px] font-bold uppercase tracking-[0.16em] text-orange">{title as string}</p>
                          <ul className="mt-3 space-y-2">
                            {(items as string[]).map((item) => (
                              <li key={item} className="flex gap-2.5 text-[15px] leading-snug text-ink/85">
                                <span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-navy" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <div className="mt-auto pt-7">
                      <p className="border-t border-line pt-5 text-[13.5px] leading-relaxed text-mute">
                        <span className="font-bold text-navy">{t.sectors.certs}: </span>
                        {sector.certs}
                      </p>
                      <a href={at(`/jobs?trade=${sector.id}`)} className="mt-4 inline-flex items-center gap-2 text-[15px] font-semibold text-navy underline-offset-4 hover:underline">
                        {t.sectors.jobs}
                        <ArrowIcon className="size-4" />
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* The story film: night shift to morning meeting. */}
        <section aria-labelledby="film-title" className="relative bg-navy-deep text-white">
          <div className="relative h-[72svh] max-h-[800px] min-h-[460px] overflow-hidden">
            <Film name="film-story" alt={t.film.alt} play={t.film.play} />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(10,27,51,0.15)_0%,rgba(10,27,51,0)_35%,rgba(10,27,51,0.88)_100%)]" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0">
              <div className="mx-auto max-w-[1280px] px-4 pb-12 sm:px-8 lg:pb-16">
                <h2 id="film-title" className="font-display max-w-[20ch] text-[34px] leading-[1.06] sm:text-[48px] lg:text-[60px]">
                  {t.film.title}
                </h2>
                <p className="mt-4 max-w-[36rem] text-[17px] leading-relaxed text-white/80">{t.film.text}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Fees: free to post, pay per lead. Prices appear only once approved and payable. */}
        <section id="fees" aria-labelledby="fees-title" className="bg-sky py-20 lg:py-24">
          <div className="mx-auto grid max-w-[1280px] gap-10 px-4 sm:px-8 lg:grid-cols-[1fr_2fr] lg:items-center lg:gap-14">
            <div>
              <Label>{t.fees.label}</Label>
              <Title id="fees-title">{t.fees.title}</Title>
              <Cta href={at("/post-job")} className="mt-8">
                {t.fees.cta}
              </Cta>
            </div>
            <ul className="grid gap-4 sm:grid-cols-3">
              {t.fees.items.map((fee, i) => (
                <li key={fee.big} data-reveal style={delay(i)} className="rounded-2xl bg-white p-7 ring-1 ring-navy/8 lg:p-8">
                  <p className="font-display text-[38px] leading-none text-navy lg:text-[42px]">{fee.big}</p>
                  <span aria-hidden="true" className="mt-5 block h-0.5 w-10 bg-orange" />
                  <p className="mt-5 text-[15px] leading-relaxed text-ink/80">{fee.text}</p>
                  {priced && i === 1 && <p className="mt-4 text-[15px] font-bold text-navy">{fill(t.fees.leadPrice, { price: leadPrice })}</p>}
                  {priced && i === 0 && <p className="mt-4 text-[14px] text-mute">{fill(t.fees.sponsor, { price: sponsorPrice })}</p>}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Technicians: job alerts by email (browse only on the Japanese site until the MHLW notification). */}
        <section id="technicians" aria-labelledby="tech-title" className="scroll-mt-16 bg-navy py-20 text-white lg:py-28">
          <div className="mx-auto grid max-w-[1280px] gap-12 px-4 sm:px-8 lg:grid-cols-2 lg:gap-16">
            <div>
              <Label light>{t.technicians.label}</Label>
              <Title id="tech-title" light>
                {t.technicians.title}
              </Title>
              <p className="mt-5 max-w-[34rem] text-[17px] leading-relaxed text-white/80">{t.technicians.text}</p>
              <a href={at("/jobs")} className="mt-6 inline-flex items-center gap-2 text-[16px] font-semibold text-amber underline-offset-4 hover:underline">
                {t.technicians.browse}
                <ArrowIcon className="size-4" />
              </a>
              <Photo name={t.technicians.image.name} alt={t.technicians.image.alt} sizes="(min-width: 1024px) 45vw, 100vw" className="mt-10 aspect-[16/10] w-full rounded-xl object-cover" />
            </div>
            <div data-reveal className="relative rounded-2xl bg-white p-6 text-ink shadow-[0_40px_90px_-40px_rgb(0_0_0/0.6)] sm:p-9 lg:self-center">
              {alertsHere ? (
                <>
                  <p className="font-display mb-6 text-[28px] leading-tight text-navy">{t.alerts.formTitle}</p>
                  <AlertForm lang={lang} t={{ form: t.form, ui: t.ui, alerts: t.alerts }} countries={alertCountries} />
                  {!collectsSeekers("JP") && <p className="mt-5 text-[13.5px] text-mute">{t.technicians.japan}</p>}
                </>
              ) : (
                <div className="py-4">
                  <p className="font-display text-[28px] leading-tight text-navy">{t.technicians.browse}</p>
                  <p className="mt-3 text-[15.5px] leading-relaxed text-ink/80">{t.technicians.japan}</p>
                  <Cta href={at("/jobs")} tone="navy" className="mt-6">
                    {t.technicians.browse}
                  </Cta>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* FAQ. */}
        <section id="faq" aria-labelledby="faq-title" className="scroll-mt-16 py-20 lg:py-28">
          <div className="mx-auto grid max-w-[1280px] gap-10 px-4 sm:px-8 lg:grid-cols-[1fr_2fr] lg:gap-16">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <Label>{t.faq.label}</Label>
              <Title id="faq-title">{t.faq.title}</Title>
            </div>
            <div className="divide-y divide-line border-y border-line">
              {t.faq.items.map((item) => (
                <details key={item.q} className="group">
                  <summary className="flex cursor-pointer items-center justify-between gap-6 py-6 text-[17.5px] font-semibold text-navy">
                    <span className="flex gap-4">
                      <span aria-hidden="true" className="font-display text-[20px] leading-none text-orange">
                        Q
                      </span>
                      {item.q}
                    </span>
                    <span className="faq-plus grid size-9 shrink-0 place-items-center rounded-full ring-1 ring-line transition group-hover:ring-navy">
                      <PlusIcon />
                    </span>
                  </summary>
                  <p className="flex gap-4 pb-7 pr-12 text-[16px] leading-relaxed text-ink/80">
                    <span aria-hidden="true" className="font-display text-[20px] leading-none text-navy">
                      A
                    </span>
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Company overview (会社概要) and how to reach a person. */}
        <section id="company" aria-labelledby="company-title" className="bg-mist py-20 lg:py-24">
          <div className="mx-auto grid max-w-[1280px] gap-12 px-4 sm:px-8 lg:grid-cols-[2fr_1fr] lg:gap-14">
            <div>
              <Label>{t.company.label}</Label>
              <Title id="company-title">{t.company.title}</Title>
              <dl className="mt-10 overflow-hidden rounded-2xl bg-white ring-1 ring-line">
                {t.company.rows.map(([key, value]) => (
                  <div key={key} className="grid border-b border-line last:border-b-0 sm:grid-cols-[230px_1fr]">
                    <dt className="bg-sky px-6 pb-1 pt-4 text-[14.5px] font-bold text-navy sm:py-5">{key}</dt>
                    <dd className="px-6 pb-4 pt-1 text-[15.5px] leading-relaxed sm:py-5">
                      {value === EMAIL ? (
                        <a href={`mailto:${EMAIL}`} className="font-semibold text-navy underline underline-offset-4">
                          {value}
                        </a>
                      ) : (
                        value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div id="contact" className="scroll-mt-24 lg:pt-[92px]">
              <div className="rounded-2xl bg-navy p-8 text-white">
                <Label light>{t.contact.label}</Label>
                <p className="font-display mt-4 text-[28px] leading-tight">{t.contact.title}</p>
                <p className="mt-3 text-[15.5px] leading-relaxed text-white/80">
                  {t.contact.text.split(EMAIL)[0]}
                  <a href={`mailto:${EMAIL}`} className="break-all font-semibold text-amber underline underline-offset-4">
                    {EMAIL}
                  </a>
                  {t.contact.text.split(EMAIL)[1] ?? ""}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer lang={lang} t={t.footer} nav={t.nav} />
    </>
  );
}
