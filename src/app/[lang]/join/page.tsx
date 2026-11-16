import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/content";
import { PartnerForm, TechnicianForm } from "@/components/Forms";
import { Card, PageHead, Shell } from "@/components/Shell";
import { collectsSeekers } from "@/lib/config";
import { countryOptions } from "@/lib/countries";
import { alternates } from "@/lib/seo";
import { isLocale } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/join">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang);
  return { title: t.meta.joinTitle, description: t.meta.joinDescription, alternates: alternates(lang, "/join") };
}

/**
 * Two onboarding paths: A, an individual technician (no Google profile or reviews asked); B, a licensed subcontractor
 * or trade company (#partner). Technician applications are not collected for Japan until the MHLW notification.
 */
export default async function Join({ params }: PageProps<"/[lang]/join">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const techCountries = countryOptions(lang).filter(([code]) => collectsSeekers(code));
  const paths = [
    { id: "technician", tab: t.join.tech.tab },
    { id: "partner", tab: t.join.partner.tab },
  ];
  return (
    <Shell lang={lang} t={t} current="/join">
      <PageHead lang={lang} t={t} path="/join" label={t.join.label} title={t.join.title} intro={t.join.intro}>
        <p className="mt-8 text-[13px] font-bold uppercase tracking-[0.14em] text-orange">{t.join.choose}</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          {paths.map((p, i) => (
            <a
              key={p.id}
              href={`#${p.id}`}
              className={`rounded-lg px-6 py-4 text-[16px] font-semibold text-white transition hover:-translate-y-0.5 ${i === 0 ? "bg-orange hover:bg-orange-deep" : "bg-navy hover:bg-navy-deep"}`}
            >
              {p.tab}
            </a>
          ))}
        </div>
      </PageHead>
      <section id="technician" className="mx-auto grid max-w-[1280px] scroll-mt-20 gap-10 px-4 py-12 sm:px-8 lg:grid-cols-[1fr_1.6fr] lg:gap-14 lg:py-16">
        <div>
          <p className="text-[12.5px] font-bold uppercase tracking-[0.16em] text-orange">A · {t.join.tech.tab}</p>
          <h2 className="font-display mt-3 text-[32px] leading-tight text-navy">{t.join.tech.title}</h2>
          <p className="mt-4 text-[16px] leading-relaxed text-ink/80">{t.join.tech.text}</p>
          {!collectsSeekers("JP") && <p className="mt-4 text-[14px] leading-relaxed text-mute">{t.join.tech.japan}</p>}
        </div>
        <Card>
          <TechnicianForm lang={lang} t={{ form: t.form, ui: t.ui, join: t.join }} countries={techCountries} />
        </Card>
      </section>
      <section id="partner" className="scroll-mt-20 bg-mist">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-12 sm:px-8 lg:grid-cols-[1fr_1.6fr] lg:gap-14 lg:py-16">
          <div>
            <p className="text-[12.5px] font-bold uppercase tracking-[0.16em] text-orange">B · {t.join.partner.tab}</p>
            <h2 className="font-display mt-3 text-[32px] leading-tight text-navy">{t.join.partner.title}</h2>
            <p className="mt-4 text-[16px] leading-relaxed text-ink/80">{t.join.partner.text}</p>
          </div>
          <Card>
            <PartnerForm lang={lang} t={{ form: t.form, ui: t.ui, join: t.join }} countries={countryOptions(lang)} />
          </Card>
        </div>
      </section>
    </Shell>
  );
}
