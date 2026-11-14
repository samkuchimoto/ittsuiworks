/** Money, pay and dates, written the way each language writes them. Safe for pages and emails. */
import type { Dict } from "@/content";
import { ZERO_DECIMAL } from "./config";
import type { Locale } from "./site";

const intl = (lang: Locale) => (lang === "ja" ? "ja-JP" : "en-US");

export function money(amount: number, currency: string, lang: Locale): string {
  const whole = ZERO_DECIMAL.has(currency) || Number.isInteger(amount);
  try {
    return new Intl.NumberFormat(intl(lang), {
      style: "currency",
      currency,
      currencyDisplay: currency === "USD" && lang === "en" ? "symbol" : "code",
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

type PayJob = { pay_min: number | string | null; pay_max: number | string | null; pay_currency: string; pay_unit: string };

/** "$32 to $45 an hour" / "32 USD〜45 USD／時". Empty when the employer listed no pay. */
export function payText(job: PayJob, t: Dict["ui"], lang: Locale): string {
  const min = job.pay_min === null ? null : Number(job.pay_min);
  const max = job.pay_max === null ? null : Number(job.pay_max);
  if (min === null && max === null) return "";
  const unit = t.payUnit[job.pay_unit as keyof Dict["ui"]["payUnit"]] ?? "";
  const m = (v: number) => money(v, job.pay_currency, lang);
  const range = min !== null && max !== null && max > min ? (lang === "ja" ? `${m(min)}〜${m(max)}` : `${m(min)} to ${m(max)}`) : m((min ?? max)!);
  return lang === "ja" ? `${range}${unit}` : `${range} ${unit}`;
}

export function dateText(value: Date | string, lang: Locale): string {
  return new Intl.DateTimeFormat(intl(lang), { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(value));
}

/** Smallest currency unit, as Stripe counts it. */
export const toMinor = (amount: number, currency: string) => (ZERO_DECIMAL.has(currency) ? Math.round(amount) : Math.round(amount * 100));
