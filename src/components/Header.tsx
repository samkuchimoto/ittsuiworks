import type { Dict } from "@/content";
import { DEAL } from "@/content/deal";
import { pathFor, type Locale } from "@/lib/site";
import { PlusIcon } from "./Icons";
import { Wordmark } from "./Logo";

/** "#faq" lands on the home page section; "/jobs" is a page in the current language. */
export const linkFor = (lang: Locale, href: string, onHome: boolean) => (href.startsWith("#") ? (onHome ? href : `${pathFor(lang)}${href}`) : pathFor(lang, href));

/**
 * The white corporate bar: one line saying what we do, the logo, two links and the navy "Request Technicians" button.
 * English pages also get an outlined "See the Deal" button beside it (Samuel, 22 Nov 2026, after the Seal & Staff
 * header): not on /deal itself, not in Japanese (the deal is for US clients). With it, the two text links show from
 * 1280px only, and on phones both buttons take their own row under the logo.
 */
export function TopBar({ lang, t, onHome = true, showDeal = true }: { lang: Locale; t: Dict["header"]; onHome?: boolean; showDeal?: boolean }) {
  const deal = lang === "en" && showDeal;
  return (
    <header className="bg-white">
      <div className={`mx-auto flex max-w-[1280px] items-center justify-between gap-3 px-4 py-3 sm:px-8 lg:py-4 ${deal ? "flex-wrap sm:flex-nowrap" : ""}`}>
        <div className="min-w-0">
          <p className="mb-1.5 hidden text-[12.5px] text-mute lg:block">{t.positioning}</p>
          <a href={pathFor(lang)} aria-label={t.home} className="inline-flex">
            <Wordmark />
          </a>
        </div>
        <div className={`flex shrink-0 items-center gap-3 sm:gap-6 ${deal ? "w-full sm:w-auto" : ""}`}>
          <nav className={`hidden items-center gap-2 text-[14.5px] font-semibold text-navy ${deal ? "xl:flex" : "md:flex"}`}>
            {t.links.map((link, i) => (
              <span key={link.href} className="flex items-center gap-2">
                {i > 0 && <span className="text-line" aria-hidden="true">/</span>}
                <a href={linkFor(lang, link.href, onHome)} className="underline-offset-4 hover:underline">
                  {link.label}
                </a>
              </span>
            ))}
          </nav>
          <div className={`flex items-center gap-2 sm:gap-2.5 ${deal ? "w-full sm:w-auto" : ""}`}>
            {deal && (
              <a
                href="/deal"
                className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-navy bg-white px-4 py-[11px] text-[13.5px] font-semibold text-navy transition hover:bg-sky sm:px-6 sm:text-[14.5px]"
              >
                {DEAL.see}
              </a>
            )}
            <a
              href={pathFor(lang, t.ctaHref)}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-navy px-3 py-3 text-[13.5px] font-semibold text-white shadow-[0_8px_24px_-10px_rgb(15_39_71/0.8)] transition hover:bg-navy-deep sm:gap-2.5 sm:px-6 sm:text-[14.5px] ${deal ? "flex-1 justify-center sm:flex-none" : ""}`}
            >
              <PlusIcon className="size-[18px]" />
              {t.cta}
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}

/** The navy menu: five equal tabs, sticky while scrolling. Scrolls sideways on narrow phones. */
export function NavBar({ lang, items, onHome = true, current }: { lang: Locale; items: Dict["nav"]; onHome?: boolean; current?: string }) {
  return (
    <nav aria-label="Main" className="sticky top-0 z-40 bg-navy text-white shadow-[0_10px_30px_-18px_rgb(10_27_51/0.9)]">
      <ul className="no-scrollbar mx-auto flex max-w-[1280px] overflow-x-auto">
        {items.map((item, i) => (
          <li key={item.href} className="flex-1 shrink-0">
            <a
              href={linkFor(lang, item.href, onHome)}
              aria-current={current === item.href ? "page" : undefined}
              className={`relative flex h-[58px] items-center justify-center whitespace-nowrap px-5 text-[14.5px] font-semibold tracking-wide transition hover:bg-white/10 aria-[current=page]:bg-white/10 aria-[current=page]:shadow-[inset_0_-3px_0_var(--color-amber)] lg:text-[15.5px] ${i > 0 ? "before:absolute before:left-0 before:top-1/2 before:h-6 before:-translate-y-1/2 before:border-l before:border-white/25" : ""}`}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
