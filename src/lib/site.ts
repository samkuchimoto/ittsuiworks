export const SITE_URL = "https://ittsuiworks.com";
export const BRAND = "Ittsui Works";
export const EMAIL = "contact@ittsuiworks.com";

export const locales = ["en", "ja"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "lang";

export const isLocale = (value: string): value is Locale => (locales as readonly string[]).includes(value);

/** IndexNow (Bing, Yandex, Seznam, Naver): new job pages are announced the moment they go live. The key is public by design. */
export const INDEXNOW_KEY = "6f1d2c9a8b7e4d3c9a1b2e3f4a5b6c7d";

/** English at the root, Japanese under /ja. */
export const pathFor = (lang: Locale, path = "/") => (lang === "en" ? path : path === "/" ? "/ja" : `/ja${path}`);
