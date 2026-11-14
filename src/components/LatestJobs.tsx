"use client";

import { useEffect, useState } from "react";
import type { Dict } from "@/content";
import { pathFor, type Locale } from "@/lib/site";
import { JobCard, type CardJob } from "./JobCard";
import { Label } from "./Typo";

/**
 * The home page stays a static page; the latest jobs load after it, from /api/jobs/latest.
 * With no live jobs the section does not show at all.
 */
export function LatestJobs({ lang, t }: { lang: Locale; t: { latest: Dict["latest"]; ui: Dict["ui"] } }) {
  const [jobs, setJobs] = useState<CardJob[]>([]);
  useEffect(() => {
    let alive = true;
    fetch("/api/jobs/latest")
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((body: { jobs?: CardJob[] }) => alive && setJobs(body.jobs ?? []))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  if (jobs.length === 0) return null;
  return (
    <section aria-labelledby="latest-title" className="mx-auto mt-16 max-w-[1280px] px-4 sm:px-8 lg:mt-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Label>{t.latest.label}</Label>
          <h2 id="latest-title" className="font-display mt-3 text-[32px] leading-tight text-navy sm:text-[40px]">
            {t.latest.title}
          </h2>
        </div>
        <a href={pathFor(lang, "/jobs")} className="text-[15.5px] font-semibold text-navy underline underline-offset-4 hover:text-orange">
          {t.latest.all}
        </a>
      </div>
      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => (
          <li key={job.id}>
            <JobCard job={job} lang={lang} t={t.ui} />
          </li>
        ))}
      </ul>
    </section>
  );
}
