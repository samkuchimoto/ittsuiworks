import type { Dict } from "@/content";
import { EMAIL, pathFor, type Locale } from "@/lib/site";
import { LangSwitch } from "./LangSwitch";
import { Shell } from "./Shell";

/** The address becomes a mailto link wherever it appears in the text. */
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

/** Terms and privacy: one column of sections on a white card. */
export function LegalPage({ lang, t, path, doc }: { lang: Locale; t: Dict; path: string; doc: { title: string; updated: string; sections: { h: string; p: string }[] } }) {
  return (
    <Shell lang={lang} t={t}>
      <div className="bg-mist">
        <div className="mx-auto max-w-[820px] px-4 py-16 sm:px-8 lg:py-24">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <a href={pathFor(lang)} className="text-[14.5px] font-semibold text-navy underline-offset-4 hover:underline">
              ← {t.ui.back}
            </a>
            <LangSwitch lang={lang} path={path} label={t.hero.language} />
          </div>
          <h1 className="font-display mt-10 text-[40px] leading-tight text-navy sm:text-[52px]">{doc.title}</h1>
          <p className="mt-3 text-[14.5px] text-mute">{doc.updated}</p>
          <div className="mt-10 space-y-8 rounded-2xl bg-white p-7 ring-1 ring-line sm:p-10">
            {doc.sections.map((section) => (
              <section key={section.h}>
                <h2 className="text-[19px] font-bold text-navy">{section.h}</h2>
                <p className="mt-2 text-[16px] leading-relaxed text-ink/85">{withEmail(section.p)}</p>
              </section>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}
