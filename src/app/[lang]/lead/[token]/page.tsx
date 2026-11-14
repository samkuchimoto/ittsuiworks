import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { fill, getDictionary } from "@/content";
import { Card, Notice, Shell } from "@/components/Shell";
import { Label } from "@/components/Typo";
import { LEAD_SLOTS, paymentsOn } from "@/lib/config";
import { countryName } from "@/lib/countries";
import { money } from "@/lib/format";
import { leadPrice, leadView } from "@/lib/market";
import { privatePage } from "@/lib/seo";
import { isLocale, pathFor } from "@/lib/site";

export const metadata: Metadata = privatePage;

/** A project lead offered to one company: the project without the buyer, then the buyer once paid. */
export default async function LeadPage({ params, searchParams }: PageProps<"/[lang]/lead/[token]">) {
  const { lang, token } = await params;
  if (!isLocale(lang)) notFound();
  await connection();
  const view = await leadView(token);
  if (!view) notFound();
  const { lead, project, company } = view;
  const t = getDictionary(lang);
  const l = t.lead;
  const cancelled = (await searchParams).cancelled === "1";
  const price = leadPrice(company);
  const canBuy = !lead.paid_at && project.status === "open" && project.sold < LEAD_SLOTS && company.status === "active" && paymentsOn();

  const facts: [string, string][] = [
    [l.place, `${project.city}, ${countryName(project.country, lang)}`],
    [l.size, t.ui.budgets[project.budget as keyof typeof t.ui.budgets] ?? project.budget],
    [l.start, t.ui.starts[project.start as keyof typeof t.ui.starts] ?? project.start],
    [l.power, t.ui.power[project.power as keyof typeof t.ui.power] ?? project.power],
  ];

  return (
    <Shell lang={lang} t={t}>
      <section className="bg-sky">
        <div className="mx-auto max-w-[1080px] px-4 py-10 sm:px-8 lg:py-14">
          <Label>{l.title}</Label>
          <h1 lang={project.lang} className="font-display mt-4 text-[34px] leading-tight text-navy sm:text-[46px]">
            {project.title}
          </h1>
          <p className="mt-2 text-[15.5px] text-mute">
            {t.ui.trades[project.trade as keyof typeof t.ui.trades]} · {fill(l.taken, { n: project.sold })}
          </p>
          {cancelled && (
            <div className="mt-6">
              <Notice>{l.cancelled}</Notice>
            </div>
          )}
        </div>
      </section>
      <section className="mx-auto grid max-w-[1080px] gap-8 px-4 py-12 sm:px-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <dl className="grid gap-px overflow-hidden rounded-2xl bg-line ring-1 ring-line sm:grid-cols-2">
            {facts.map(([k, v]) => (
              <div key={k} className="bg-white px-6 py-4">
                <dt className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-orange">{k}</dt>
                <dd className="mt-1 text-[16px] font-semibold text-navy">{v}</dd>
              </div>
            ))}
          </dl>
          <h2 className="font-display mt-8 text-[26px] text-navy">{l.scope}</h2>
          <p lang={project.lang} className="mt-3 whitespace-pre-line text-[16px] leading-[1.8] text-ink/85">
            {project.scope}
          </p>
        </div>
        <Card className="lg:self-start">
          {lead.paid_at ? (
            <div>
              <Notice>{l.bought}</Notice>
              <p className="mt-6 text-[12.5px] font-bold uppercase tracking-[0.14em] text-orange">{l.buyer}</p>
              <p className="mt-2 text-[18px] font-bold text-navy">{project.buyer.name}</p>
              <p className="text-[15.5px] text-ink/85">
                {project.buyer.role}, {project.buyer.company}
              </p>
              <p className="mt-3">
                <a href={`mailto:${project.buyer.email}`} className="font-semibold text-navy underline underline-offset-4">
                  {project.buyer.email}
                </a>
              </p>
              {project.buyer.phone && (
                <p className="mt-1 text-[15.5px]">
                  {l.phone}:{" "}
                  <a href={`tel:${project.buyer.phone.replace(/[^\d+]/g, "")}`} className="font-semibold text-navy underline underline-offset-4">
                    {project.buyer.phone}
                  </a>
                </p>
              )}
            </div>
          ) : project.status === "closed" ? (
            <Notice>{l.closed}</Notice>
          ) : project.status === "full" || project.sold >= LEAD_SLOTS ? (
            <Notice>{l.full}</Notice>
          ) : canBuy ? (
            <form action="/api/checkout" method="post">
              <input type="hidden" name="kind" value="lead" />
              <input type="hidden" name="token" value={lead.token} />
              <input type="hidden" name="back" value={pathFor(lang, `/lead/${lead.token}`)} />
              <button className="w-full rounded-md bg-orange px-6 py-4 text-[17px] font-semibold text-white shadow-[0_10px_30px_-12px_rgb(200_70_27/0.7)] transition hover:bg-orange-deep">
                {fill(l.buy, { price: money(price.amount, price.currency, lang) })}
              </button>
              <p className="mt-4 text-[14.5px] leading-relaxed text-mute">{l.buyText}</p>
            </form>
          ) : (
            <Notice>{l.closed}</Notice>
          )}
        </Card>
      </section>
    </Shell>
  );
}
