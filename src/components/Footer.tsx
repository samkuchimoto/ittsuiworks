import type { Dict } from "@/content";
import { EMAIL, pathFor, type Locale } from "@/lib/site";
import { linkFor } from "./Header";
import { Wordmark } from "./Logo";

export function Footer({ lang, t, nav, onHome = true }: { lang: Locale; t: Dict["footer"]; nav: Dict["nav"]; onHome?: boolean }) {
  return (
    <footer className="bg-navy-deep text-white">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-14 sm:px-8 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <Wordmark tone="white" />
          <p className="mt-5 max-w-[30rem] text-[15px] leading-relaxed text-white/75">{t.tagline}</p>
          <a href={`mailto:${EMAIL}`} className="mt-5 inline-block font-semibold text-white underline-offset-4 hover:underline">
            {EMAIL}
          </a>
        </div>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-3 text-[15px] text-white/80 sm:grid-cols-3 lg:self-start">
          {nav.map((item) => (
            <li key={item.href}>
              <a href={linkFor(lang, item.href, onHome)} className="hover:text-white">
                {item.label}
              </a>
            </li>
          ))}
          <li>
            <a href={pathFor(lang, "/terms")} className="hover:text-white">
              {t.terms}
            </a>
          </li>
          <li>
            <a href={pathFor(lang, "/privacy")} className="hover:text-white">
              {t.privacy}
            </a>
          </li>
        </ul>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-4 py-6 text-[13px] text-white/60 sm:px-8">
          <p className="font-semibold text-white/80">{t.operated}</p>
          <p>{t.ai}</p>
          <p>{t.rights}</p>
        </div>
      </div>
    </footer>
  );
}
