export const SITE_URL = "https://ittsuiworks.com";
export const BRAND = "Ittsui Works";
export const EMAIL = "contact@ittsuiworks.com";

export const locales = ["en", "ja"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "lang";

export const isLocale = (value: string): value is Locale => (locales as readonly string[]).includes(value);

/** English at the root, Japanese under /ja. */
export const pathFor = (lang: Locale, path = "/") => (lang === "en" ? path : path === "/" ? "/ja" : `/ja${path}`);
