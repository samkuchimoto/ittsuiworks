/** Shared checks for the form endpoints: same-site posts, per-IP limits, field readers. */
import "server-only";
import { isCountry } from "./countries";
import { hasDatabase } from "./db";
import { clientIp, rateLimit } from "./rate-limit";

export const fail = (error: string, status: number, fields?: string[]) => Response.json({ ok: false, error, fields }, { status });
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Refuses posts from other sites, floods, and requests before the database is connected. */
export function refuse(request: Request, name: string, limit = 6): Response | null {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return fail("forbidden", 403);
  if (!rateLimit(`${name}:${clientIp(request)}`, limit)) return fail("rate_limited", 429);
  if (!hasDatabase()) return fail("not_configured", 503);
  return null;
}

/** Reads a submitted form; null when the body is not a form or the hidden bot field is filled. */
export async function readForm(request: Request): Promise<FormData | "bot" | null> {
  try {
    const form = await request.formData();
    return String(form.get("website_url") ?? "").trim() ? "bot" : form;
  } catch {
    return null;
  }
}

export function reader(form: FormData) {
  const text = (name: string, max: number) => String(form.get(name) ?? "").trim().slice(0, max);
  return {
    text,
    oneOf: <T extends readonly string[]>(name: string, options: T): T[number] | null => {
      const value = text(name, 40);
      return (options as readonly string[]).includes(value) ? (value as T[number]) : null;
    },
    country: (name: string) => {
      const value = text(name, 2).toUpperCase();
      return isCountry(value) ? value : null;
    },
    email: (name: string) => {
      const value = text(name, 120).toLowerCase();
      return EMAIL.test(value) ? value : null;
    },
    /** A website typed as "acme.com" or "https://acme.com"; "" when empty, null when it is not a web address. */
    website: (name: string) => {
      const value = text(name, 200);
      if (!value) return "";
      try {
        const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
        return url.hostname.includes(".") ? url.origin + (url.pathname === "/" ? "" : url.pathname) : null;
      } catch {
        return null;
      }
    },
    /** A positive amount, or null when left empty; NaN when it is not a number. */
    amount: (name: string) => {
      const value = text(name, 14).replace(/[,\s]/g, "");
      if (!value) return null;
      const n = Number(value);
      return Number.isFinite(n) && n > 0 && n < 1e10 ? n : Number.NaN;
    },
    lang: () => (text("lang", 5) === "ja" ? "ja" : "en"),
  };
}
