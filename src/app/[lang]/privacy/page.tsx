import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/content";
import { Footer } from "@/components/Footer";
import { NavBar, TopBar } from "@/components/Header";
import { LangSwitch } from "@/components/LangSwitch";
import { EMAIL, isLocale, pathFor } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/privacy">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang);
  return {
    title: t.meta.privacyTitle,
    alternates: { canonical: pathFor(lang, "/privacy"), languages: { en: "/privacy", ja: "/ja/privacy", "x-default": "/privacy" } },
  };
}

/** Linked, with my email in the text, so a mailto works wherever the address appears. */
function withEmail(text: string) {
  const [before, after] = text.split(EMAIL);
  if (after === undefined) return text;
  return (
    <>
      {before}
      <a href={`mailto:${EMAIL}`} className="font-semibold text-navy underline underline-offset-4">
        {EMAIL}
      </a>
      {after}
    </>
  );
}

export default async function Privacy({ params }: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  return (
    <>
      <TopBar lang={lang} t={t.header} onHome={false} />
      <NavBar lang={lang} items={t.nav} onHome={false} />
      <main className="bg-mist">
        <div className="mx-auto max-w-[820px] px-4 py-16 sm:px-8 lg:py-24">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <a href={pathFor(lang)} className="text-[14.5px] font-semibold text-navy underline-offset-4 hover:underline">
              ← {t.privacy.back}
            </a>
            <LangSwitch lang={lang} path="/privacy" label={t.hero.language} />
          </div>
          <h1 className="font-display mt-10 text-[40px] leading-tight text-navy sm:text-[52px]">{t.privacy.title}</h1>
          <p className="mt-3 text-[14.5px] text-mute">{t.privacy.updated}</p>
          <div className="mt-10 space-y-8 rounded-2xl bg-white p-7 ring-1 ring-line sm:p-10">
            {t.privacy.sections.map((section) => (
              <section key={section.h}>
                <h2 className="text-[19px] font-bold text-navy">{section.h}</h2>
                <p className="mt-2 text-[16px] leading-relaxed text-ink/85">{withEmail(section.p)}</p>
              </section>
            ))}
          </div>
        </div>
      </main>
      <Footer lang={lang} t={t.footer} nav={t.nav} onHome={false} />
    </>
  );
}
