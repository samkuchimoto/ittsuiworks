import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fill, getDictionary } from "@/content";
import { CompanyForm } from "@/components/Forms";
import { CheckIcon } from "@/components/Icons";
import { Card, PageHead, Shell } from "@/components/Shell";
import { PRICING, paymentsOn } from "@/lib/config";
import { countryOptions } from "@/lib/countries";
import { money } from "@/lib/format";
import { alternates } from "@/lib/seo";
import { isLocale } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/companies">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang);
  return { title: t.meta.companiesTitle, description: t.meta.companiesDescription, alternates: alternates(lang, "/companies") };
}

export default async function Companies({ params }: PageProps<"/[lang]/companies">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const price = lang === "ja" ? money(PRICING.lead.JPY, "JPY", lang) : money(PRICING.lead.USD, "USD", lang);
  return (
    <Shell lang={lang} t={t} current="/companies">
      <PageHead lang={lang} t={t} path="/companies" label={t.companies.label} title={t.companies.title} intro={t.companies.intro} />
      <section className="mx-auto grid max-w-[1280px] gap-10 px-4 py-12 sm:px-8 lg:grid-cols-[1fr_1.6fr] lg:gap-14 lg:py-16">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ul className="space-y-4">
            {t.companies.points.map((point) => (
              <li key={point} className="flex gap-3 text-[16.5px] font-semibold leading-relaxed text-navy">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-sky ring-1 ring-navy/10">
                  <CheckIcon className="size-4" />
                </span>
                {point}
              </li>
            ))}
          </ul>
          {paymentsOn() && <p className="mt-8 rounded-xl bg-sky px-5 py-4 text-[16px] font-bold text-navy">{fill(t.fees.leadPrice, { price })}</p>}
        </aside>
        <Card>
          <p className="font-display mb-6 text-[28px] leading-tight text-navy">{t.companies.form}</p>
          <CompanyForm lang={lang} t={{ form: t.form, ui: t.ui, companies: t.companies }} countries={countryOptions(lang)} />
        </Card>
      </section>
    </Shell>
  );
}
