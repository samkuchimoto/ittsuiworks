"use client";

import { useState } from "react";
import type { Dict } from "@/content";
import { pathFor, type Locale } from "@/lib/site";
import { ArrowIcon } from "./Icons";

const TRADES = ["hvac", "electrical", "datacenter", "marine"] as const;
const HUBS = ["tx", "fl", "us", "jp"] as const;

/**
 * The B2B quick selector under the hero (Samuel, 16 Nov 2026, Airbnb's one-line search in our industrial style):
 * mode, trade and hub, then Continue opens the matching form with those already chosen (?trade=&hub=, read by the
 * form in the browser, so both form pages stay static). Without JavaScript it still opens the request form.
 */
export function QuickSelector({ lang, t }: { lang: Locale; t: Dict["selector"] }) {
  const [mode, setMode] = useState<"request" | "project">("request");
  const cell = "flex min-w-0 flex-1 flex-col gap-1 px-5 py-4 sm:px-6";
  const label = "text-[12px] font-bold uppercase tracking-[0.16em] text-orange";
  const select = "w-full cursor-pointer appearance-none bg-transparent pr-6 text-[16px] font-semibold text-navy focus:outline-none";
  const chevron = "pointer-events-none absolute right-0 top-1/2 size-2 -translate-y-1/2 rotate-45 border-b-2 border-r-2 border-navy/60";
  return (
    <form
      action={pathFor(lang, mode === "project" ? "/post-project" : "/request")}
      method="get"
      aria-label={t.label}
      className="flex flex-col divide-y divide-line overflow-hidden rounded-xl bg-white shadow-[0_28px_60px_-32px_rgb(15_39_71/0.5)] ring-1 ring-navy/8 lg:flex-row lg:items-stretch lg:divide-x lg:divide-y-0"
    >
      <label className={cell}>
        <span className={label}>{t.mode}</span>
        <span className="relative">
          <select value={mode} onChange={(e) => setMode(e.target.value === "project" ? "project" : "request")} className={select}>
            <option value="request">{t.modes.request}</option>
            <option value="project">{t.modes.project}</option>
          </select>
          <span aria-hidden="true" className={chevron} />
        </span>
      </label>
      <label className={cell}>
        <span className={label}>{t.trade}</span>
        <span className="relative">
          <select name="trade" defaultValue="hvac" className={select}>
            {TRADES.map((k) => (
              <option key={k} value={k}>
                {t.trades[k]}
              </option>
            ))}
          </select>
          <span aria-hidden="true" className={chevron} />
        </span>
      </label>
      <label className={cell}>
        <span className={label}>{t.hub}</span>
        <span className="relative">
          <select name="hub" defaultValue={lang === "ja" ? "jp" : "tx"} className={select}>
            {HUBS.map((k) => (
              <option key={k} value={k}>
                {t.hubs[k]}
              </option>
            ))}
          </select>
          <span aria-hidden="true" className={chevron} />
        </span>
      </label>
      <div className="flex p-3 lg:w-[230px]">
        <button
          type="submit"
          className="group flex w-full items-center justify-between gap-3 rounded-lg bg-orange px-5 py-4 text-[16px] font-semibold text-white transition hover:bg-orange-deep"
        >
          {t.go}
          <span className="grid size-7 place-items-center rounded-full bg-white/20 transition group-hover:bg-white/30">
            <ArrowIcon className="size-4" />
          </span>
        </button>
      </div>
    </form>
  );
}
