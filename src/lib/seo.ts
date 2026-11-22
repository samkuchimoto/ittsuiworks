import type { Metadata } from "next";
import { pathFor, type Locale } from "./site";

/** Canonical and hreflang links for a page that exists in both languages. */
export function alternates(lang: Locale, path: string, canonicalLang: Locale = lang): Metadata["alternates"] {
  return {
    canonical: pathFor(canonicalLang, path),
    languages: { en: pathFor("en", path), ja: pathFor("ja", path), "x-default": pathFor("en", path) },
  };
}

/**
 * Private pages (accounts, leads, projects, alerts, requests, admin): never in search results, and their URL (which
 * holds the private token or the admin key) is never sent to another site in a Referer header.
 */
export const privatePage: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };
