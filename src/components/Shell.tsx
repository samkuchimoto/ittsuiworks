import type { ReactNode } from "react";
import type { Dict } from "@/content";
import type { Locale } from "@/lib/site";
import { Footer } from "./Footer";
import { NavBar, TopBar } from "./Header";
import { LangSwitch } from "./LangSwitch";
import { Label } from "./Typo";

/** Every page other than home: the same white bar, navy menu and footer. */
export function Shell({ lang, t, current, children }: { lang: Locale; t: Dict; current?: string; children: ReactNode }) {
  return (
    <>
      <TopBar lang={lang} t={t.header} onHome={false} />
      <NavBar lang={lang} items={t.nav} onHome={false} current={current} />
      <main id="top">{children}</main>
      <Footer lang={lang} t={t.footer} nav={t.nav} onHome={false} />
    </>
  );
}

/** The light blueprint band at the top of a page: label, title, one paragraph, the language switch. */
export function PageHead({
  lang,
  t,
  path,
  label,
  title,
  intro,
  children,
}: {
  lang: Locale;
  t: Dict;
  path: string;
  label: string;
  title: string;
  intro?: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-sky">
      <div aria-hidden="true" className="blueprint absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black_35%,transparent_80%)]" />
      <div className="relative mx-auto max-w-[1280px] px-4 pb-14 pt-10 sm:px-8 lg:pb-20 lg:pt-14">
        <div className="flex justify-end">
          <LangSwitch lang={lang} path={path} label={t.hero.language} />
        </div>
        <div className="mt-4 max-w-[860px]">
          <Label>{label}</Label>
          <h1 className="font-display mt-4 text-[38px] leading-[1.08] text-navy sm:text-[50px] lg:text-[60px]">{title}</h1>
          {intro && <p className="mt-5 max-w-[42rem] text-[17.5px] leading-relaxed text-ink/80">{intro}</p>}
          {children}
        </div>
      </div>
    </section>
  );
}

/** A white card for forms and panels. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-6 shadow-[0_40px_80px_-50px_rgb(15_39_71/0.5)] ring-1 ring-navy/10 sm:p-9 ${className}`}>{children}</div>;
}

/** A short status line in a sky box (confirmations, notices). */
export function Notice({ children, tone = "sky" }: { children: ReactNode; tone?: "sky" | "orange" }) {
  return (
    <p role="status" className={`rounded-xl px-5 py-4 text-[15.5px] font-semibold ${tone === "orange" ? "bg-orange/10 text-orange-deep" : "bg-sky text-navy ring-1 ring-navy/10"}`}>
      {children}
    </p>
  );
}
