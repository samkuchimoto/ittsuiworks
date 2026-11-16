import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { fill, getDictionary } from "@/content";
import { Card, PageHead, Shell } from "@/components/Shell";
import { countryName } from "@/lib/countries";
import { hasDatabase, isToken } from "@/lib/db";
import { dateText } from "@/lib/format";
import { getInquiryByToken, isClient } from "@/lib/pipeline";
import { privatePage } from "@/lib/seo";
import { EMAIL, isLocale } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/inquiry/[token]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { ...privatePage, title: getDictionary(lang).meta.inquiryTitle };
}

/**
 * The sender's private page (Samuel, 16 Nov 2026: "securely revisit their request"): reached only from the link in
 * the acknowledgment email. Shows what was sent and where it stands; nothing can be changed here, and no account is
 * needed. Files are listed by name only (Samuel downloads them on the admin page).
 */
export default async function InquiryPage({ params }: PageProps<"/[lang]/inquiry/[token]">) {
  const { lang, token } = await params;
  if (!isLocale(lang)) notFound();
  await connection();
  if (!isToken(token) || !hasDatabase()) notFound();
  const row = await getInquiryByToken(token);
  if (!row) notFound();
  const t = getDictionary(lang);
  const p = t.inquiryPage;
  const status = isClient(row.kind) ? p.statuses[row.stage as keyof typeof p.statuses] : p.applicantStatuses[row.stage as keyof typeof p.applicantStatuses];
  const where = [row.place, countryName(row.country, lang)].filter(Boolean).join(", ");
  const facts: [string, string][] = [
    ...(row.company ? ([[t.form.company, row.company]] as [string, string][]) : []),
    [t.form.name, row.name],
    [t.form.email, row.email],
    ...(row.phone ? ([[t.form.phoneWhatsApp, row.phone]] as [string, string][]) : []),
    ...(where ? ([[t.form.placeState, where]] as [string, string][]) : []),
    ...(row.trades.length ? ([[t.form.tradesNeeded, row.trades.map((k) => t.ui.sourcingTrades[k as keyof typeof t.ui.sourcingTrades] ?? k).join(", ")]] as [string, string][]) : []),
    ...Object.entries(row.data).filter(([, v]) => v),
  ];
  return (
    <Shell lang={lang} t={t}>
      <PageHead
        lang={lang}
        t={t}
        path={`/inquiry/${token}`}
        label={fill(p.reference, { reference: row.id.toUpperCase() })}
        title={p.title[row.kind]}
        intro={fill(p.sent, { date: dateText(row.created_at, lang) })}
      />
      <section className="mx-auto grid max-w-[1280px] gap-8 px-4 py-12 sm:px-8 lg:grid-cols-[1fr_2fr] lg:py-16">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl bg-navy p-7 text-white">
            <p className="text-[12.5px] font-bold uppercase tracking-[0.16em] text-amber">{p.status}</p>
            <p className="font-display mt-3 text-[30px] leading-tight">{status ?? row.stage}</p>
          </div>
          <p className="mt-6 text-[14.5px] leading-relaxed text-mute">
            {p.help.split(EMAIL)[0]}
            <a href={`mailto:${EMAIL}`} className="font-semibold text-navy underline underline-offset-4">
              {EMAIL}
            </a>
            {p.help.split(EMAIL)[1] ?? ""}
          </p>
        </aside>
        <Card>
          <h2 className="font-display text-[26px] text-navy">{p.details}</h2>
          <dl className="mt-6 divide-y divide-line">
            {facts.map(([k, v]) => (
              <div key={k} className="grid gap-1 py-3 sm:grid-cols-[220px_1fr]">
                <dt className="text-[14px] font-semibold text-navy">{k}</dt>
                <dd className="whitespace-pre-wrap text-[15px] text-ink/85">{v}</dd>
              </div>
            ))}
          </dl>
          {(row.files ?? []).length > 0 && (
            <p className="mt-6 text-[14.5px] text-mute">
              <span className="font-semibold text-navy">{p.files}: </span>
              {(row.files ?? []).map((f) => f.name).join(", ")}
            </p>
          )}
        </Card>
      </section>
    </Shell>
  );
}
