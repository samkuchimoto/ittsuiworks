"use client";

import { LOCALE_COOKIE, pathFor, type Locale } from "@/lib/site";
import { GlobeIcon } from "./Icons";

/** "日本語 / English", as on the reference site. Remembers the choice, so the root stops redirecting. */
export function LangSwitch({ lang, path = "/", label, className = "" }: { lang: Locale; path?: string; label: string; className?: string }) {
  const remember = (next: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  };
  const item = (target: Locale, text: string) =>
    target === lang ? (
      <span aria-current="true" className="font-bold text-navy">{text}</span>
    ) : (
      <a href={pathFor(target, path)} hrefLang={target} lang={target} onClick={() => remember(target)} className="text-mute underline-offset-4 hover:text-navy hover:underline">
        {text}
      </a>
    );
  return (
    <nav aria-label={label} className={`inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-[14px] shadow-[0_6px_24px_-8px_rgb(15_39_71/0.35)] ring-1 ring-navy/10 backdrop-blur ${className}`}>
      <GlobeIcon className="size-4 text-navy" />
      {item("ja", "日本語")}
      <span className="text-line" aria-hidden="true">/</span>
      {item("en", "English")}
    </nav>
  );
}
