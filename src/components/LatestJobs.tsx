"use client";

import { useEffect, useState } from "react";
import type { Dict } from "@/content";
import { pathFor, type Locale } from "@/lib/site";
import { JobCard, type CardJob } from "./JobCard";
import { Label } from "./Typo";

const FILTERS = ["all", "datacenter", "hvac", "electrical", "marine", "txfl"] as const;
type Filter = (typeof FILTERS)[number];

/** Where "See all jobs" goes for each filter (the jobs page filters by trade, country and words). */
const ALL_JOBS: Record<Filter, string> = {
  all: "/jobs",
  datacenter: "/jobs?trade=datacenter",
  hvac: "/jobs?trade=hvac",
  electrical: "/jobs?q=electric",
  marine: "/jobs?trade=marine",
  txfl: "/jobs?country=US",
};

/**
 * The home page stays a static page; live jobs load after it, from /api/jobs/latest. Since 16 Nov 2026 it sits after the
 * B2B sections, as "Live Infrastructure Demand & Open Roles", with a filter strip (each filter is its own cached list).
 * With no live jobs at all the section does not show.
 */
export function LatestJobs({ lang, t }: { lang: Locale; t: { latest: Dict["latest"]; ui: Dict["ui"] } }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [jobs, setJobs] = useState<CardJob[] | null>(null);
  const [any, setAny] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(`/api/jobs/latest${filter === "all" ? "" : `?filter=${filter}`}`)
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((body: { jobs?: CardJob[] }) => {
        if (!alive) return;
        setJobs(body.jobs ?? []);
        if (filter === "all") setAny((body.jobs ?? []).length > 0);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [filter]);
  if (!any) return null;
  return (
    <section aria-labelledby="latest-title" className="mx-auto max-w-[1280px] px-4 py-16 sm:px-8 lg:py-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Label>{t.latest.label}</Label>
          <h2 id="latest-title" className="font-display mt-3 max-w-[22ch] text-[32px] leading-tight text-navy sm:text-[40px]">
            {t.latest.title}
          </h2>
        </div>
        <a href={pathFor(lang, ALL_JOBS[filter])} className="text-[15.5px] font-semibold text-navy underline underline-offset-4 hover:text-orange">
          {t.latest.all}
        </a>
      </div>
      <div role="group" aria-label={t.latest.label} className="mt-8 flex flex-wrap overflow-hidden rounded-lg ring-1 ring-navy/15">
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`flex-1 whitespace-nowrap border-r border-navy/10 px-4 py-3 text-[14.5px] font-semibold transition last:border-r-0 ${
              filter === key ? "bg-navy text-white" : "bg-white text-navy hover:bg-sky"
            }`}
          >
            {t.latest.filters[key]}
          </button>
        ))}
      </div>
      {jobs && jobs.length > 0 ? (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <JobCard job={job} lang={lang} t={t.ui} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 rounded-lg bg-mist px-6 py-8 text-[15.5px] text-mute">{jobs ? t.latest.none : " "}</p>
      )}
    </section>
  );
}
