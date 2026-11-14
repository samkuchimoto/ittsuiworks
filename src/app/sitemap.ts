import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { allLiveJobs } from "@/lib/market";
import { SITE_URL } from "@/lib/site";

/** Every public page in both languages, then every live job (once, in the language it was written in). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Built at request time, so a job is in the sitemap the moment it goes live.
  await connection();
  const both = (path: string, priority: number): MetadataRoute.Sitemap => {
    const en = `${SITE_URL}${path === "/" ? "" : path}`;
    const ja = `${SITE_URL}/ja${path === "/" ? "" : path}`;
    const alternates = { languages: { en, ja } };
    return [
      { url: en, priority, alternates },
      { url: ja, priority: Math.max(0.1, priority - 0.1), alternates },
    ];
  };
  const pages = [
    ...both("/", 1),
    ...both("/jobs", 0.9),
    ...both("/post-job", 0.8),
    ...both("/post-project", 0.8),
    ...both("/companies", 0.8),
    ...both("/terms", 0.2),
    ...both("/privacy", 0.2),
  ];
  const jobs = await allLiveJobs().catch(() => []);
  return [
    ...pages,
    ...jobs.map((job) => ({
      url: `${SITE_URL}${job.lang === "ja" ? "/ja" : ""}/jobs/${job.id}`,
      lastModified: job.published_at ?? undefined,
      priority: 0.7,
      alternates: { languages: { en: `${SITE_URL}/jobs/${job.id}`, ja: `${SITE_URL}/ja/jobs/${job.id}` } },
    })),
  ];
}
