import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number) => ({
    url: `${SITE_URL}${path === "/" ? "" : path}`,
    priority,
    alternates: { languages: { en: `${SITE_URL}${path === "/" ? "" : path}`, ja: `${SITE_URL}/ja${path === "/" ? "" : path}` } },
  });
  return [page("/", 1), { ...page("/", 0.9), url: `${SITE_URL}/ja` }, page("/privacy", 0.2), { ...page("/privacy", 0.2), url: `${SITE_URL}/ja/privacy` }];
}
