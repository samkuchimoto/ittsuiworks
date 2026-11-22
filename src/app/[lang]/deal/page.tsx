import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DealOrder } from "@/components/DealOrder";
import { ShieldIcon } from "@/components/Icons";
import { Rich } from "@/components/Rich";
import { Shell } from "@/components/Shell";
import { Cta, Label } from "@/components/Typo";
import { getDictionary } from "@/content";
import { DEAL } from "@/content/deal";
import { COUNTRY_CODES, countryName } from "@/lib/countries";
import { SITE_URL, isLocale } from "@/lib/site";

const TITLE = "The Deal: paid strictly on results | Ittsui Works";

export async function generateMetadata({ params }: PageProps<"/[lang]/deal">): Promise<Metadata> {
  const { lang } = await params;
  if (lang !== "en") return {};
  return {
    title: TITLE,
    description: DEAL.intro,
    alternates: { canonical: `${SITE_URL}/deal` },
    openGraph: { type: "website", siteName: "Ittsui Works", url: `${SITE_URL}/deal`, title: TITLE, description: DEAL.intro, images: [{ url: "/media/og.jpg", width: 1200, height: 630 }] },
  };
}

/**
 * The deal (Samuel, 22 Nov 2026): the page the team opens on calls and sends to US clients, readable in a minute.
 * The promise (with the order button above the fold), the two deals, how payment works, and the button that opens the
 * official order form. English only
 * (US clients): /ja/deal sends visitors here, and the proxy never sends /deal to Japanese.
 */
export default async function Deal({ params }: PageProps<"/[lang]/deal">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  if (lang !== "en") redirect("/deal");
  const t = getDictionary("en");
  // Billing country: the United States first (the deal is for US clients), then every other country by name.
  const countries: [string, string][] = [
    ["US", "United States"],
    ...COUNTRY_CODES.filter((c) => c !== "US")
      .map((c) => [c, countryName(c, "en")] as [string, string])
      .sort((a, b) => a[1].localeCompare(b[1], "en")),
  ];

  return (
    <Shell lang="en" t={t} current="/deal">
      {/* 1. The promise */}
      <section className="relative overflow-hidden bg-sky">
        <div aria-hidden="true" className="blueprint absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black_35%,transparent_80%)]" />
        <div className="relative mx-auto max-w-[1280px] px-4 pb-10 pt-10 sm:px-8 lg:pb-14 lg:pt-14">
          <div className="max-w-[940px]">
            <Label>{DEAL.eyebrow}</Label>
            <h1 className="font-display mt-4 text-[34px] leading-[1.08] text-navy sm:text-[44px] lg:text-[54px]">{DEAL.title}</h1>
            <p className="mt-5 max-w-[46rem] text-[17.5px] leading-relaxed text-ink/80">{DEAL.intro}</p>
            {/* The order button above the fold (Samuel, 22 Nov 2026). "#order" opens the same form as the button below. */}
            <Cta href="#order" className="mt-7">
              {DEAL.cta}
            </Cta>
          </div>
        </div>
      </section>

      {/*
        2. The two deals, side by side on a wide screen. Both cards share the same five rows (header, then four detail
        rows) through CSS subgrid, so each row, the light-blue "The deal" box included, starts and ends at the same
        height in both cards, and both cards end level. Card B has no fourth row; its last track stays empty.
      */}
      <section aria-label="The two deals" className="bg-white">
        <div className="mx-auto grid max-w-[1280px] gap-5 px-4 py-10 sm:px-8 lg:grid-cols-2 lg:gap-x-6 lg:gap-y-0 lg:py-14">
          {DEAL.cards.map((card, i) => (
            <article
              key={card.key}
              aria-labelledby={`deal-${card.key}`}
              className="flex flex-col rounded-2xl bg-white p-6 shadow-[0_40px_80px_-50px_rgb(15_39_71/0.5)] ring-1 ring-navy/10 sm:p-8 lg:row-span-5 lg:grid lg:grid-rows-subgrid lg:gap-y-0"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 id={`deal-${card.key}`} className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-orange">
                    <span className="text-mute">{i === 0 ? "A" : "B"} · </span>
                    {card.tag}
                  </h2>
                  <span className="rounded-full bg-sky px-3 py-1 text-[12.5px] font-semibold text-navy ring-1 ring-navy/10">{card.badge}</span>
                </div>
                <p className="font-display mt-5 text-[46px] leading-none text-navy lg:text-[54px]">{card.big}</p>
                <p className="mt-2 text-[15.5px] font-semibold text-navy">{card.sub}</p>
                <span aria-hidden="true" className="mt-5 block h-0.5 w-10 bg-orange" />
              </div>
              <dl className="mt-4 lg:row-span-4 lg:grid lg:grid-rows-subgrid lg:gap-y-0">
                {card.rows.map((row) => (
                  <div
                    key={row.label}
                    className={`grid gap-1 py-3.5 sm:grid-cols-[9rem_1fr] sm:gap-5 ${row.deal ? "my-1 rounded-xl bg-sky px-4 ring-1 ring-navy/10" : "border-b border-line last:border-0"}`}
                  >
                    <dt className="text-[12px] font-bold uppercase tracking-[0.12em] text-mute sm:pt-[3px]">{row.label}</dt>
                    <dd className="text-[15.5px] leading-relaxed text-ink/85">
                      <Rich text={row.text} />
                      {row.list && (
                        <ol className="mt-2 space-y-1.5">
                          {row.list.map((gate, n) => (
                            <li key={gate} className="flex items-center gap-2.5 font-semibold text-navy">
                              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-navy text-[12px] text-white">{n + 1}</span>
                              {gate}
                            </li>
                          ))}
                        </ol>
                      )}
                      {row.after && <span className="mt-2 block">{row.after}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </section>

      {/* 3. How you pay, and the order button */}
      <section aria-labelledby="pay-title" className="relative overflow-hidden bg-navy text-white">
        <div aria-hidden="true" className="blueprint-dark absolute inset-0" />
        <div className="relative mx-auto max-w-[1280px] px-4 py-12 sm:px-8 lg:py-16">
          <Label light>{DEAL.pay.label}</Label>
          <h2 id="pay-title" className="font-display mt-4 text-[30px] leading-[1.1] sm:text-[38px]">
            {DEAL.pay.title}
          </h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {DEAL.pay.steps.map((step, i) => (
              <li key={step.title} className="rounded-2xl bg-white/[0.06] p-6 ring-1 ring-white/15">
                <p className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber text-[15px] font-bold text-navy-deep">{i + 1}</span>
                  <span className="text-[17px] font-semibold">{step.title}</span>
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-white/80">
                  <Rich text={step.text} strong="font-semibold text-white" />
                </p>
              </li>
            ))}
          </ol>
          <DealOrder countries={countries} />
        </div>
      </section>

      {/* 4. Who you pay */}
      <section className="bg-mist">
        <div className="mx-auto flex max-w-[1280px] gap-4 px-4 py-8 sm:px-8">
          <ShieldIcon className="mt-0.5 size-6 shrink-0 text-navy" />
          <div className="space-y-1.5">
            <p className="text-[15px] font-semibold leading-relaxed text-navy">{DEAL.trust}</p>
            <p className="text-[14px] leading-relaxed text-mute">
              {DEAL.safety}{" "}
              <a href={DEAL.verify.link} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy underline underline-offset-2">
                {DEAL.verify.text}
              </a>
            </p>
          </div>
        </div>
      </section>
    </Shell>
  );
}
