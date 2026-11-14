/**
 * Every rule of the platform in one place. Two models, both proven at scale:
 *  - Jobs, the Indeed model: companies post jobs for free, technicians apply for free and get new jobs by email.
 *    Companies pay only to feature a job (more reach), never to post one.
 *  - Projects, the Thumbtack / Angi model: buyers post a project for free, it goes to the companies that do that
 *    work, and a company pays only for the leads it chooses. Each lead goes to LEAD_SLOTS companies at most.
 */

export const TRADES = ["hvac", "datacenter", "marine"] as const;
export type Trade = (typeof TRADES)[number];
export const isTrade = (value: string): value is Trade => (TRADES as readonly string[]).includes(value);

export const EMPLOYMENT = ["full_time", "part_time", "contract", "temporary"] as const;
export type Employment = (typeof EMPLOYMENT)[number];

export const PAY_UNITS = ["hour", "month", "year"] as const;
export type PayUnit = (typeof PAY_UNITS)[number];

export const CURRENCIES = ["USD", "JPY", "EUR", "GBP", "CAD", "AUD", "SGD", "AED", "SAR", "KRW", "INR", "MXN", "BRL", "PHP", "THB", "CHF", "NOK", "SEK", "DKK", "PLN", "NZD", "HKD", "TWD", "MYR", "IDR", "VND", "ZAR"] as const;
/** Currencies written without decimals. */
export const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "IDR", "TWD"]);

/** Project size, in US dollars so every country reads the same scale. */
export const BUDGETS = ["under50k", "50k250k", "250k1m", "1m10m", "over10m", "unknown"] as const;
export type Budget = (typeof BUDGETS)[number];
export const STARTS = ["now", "3m", "6m", "12m", "unset"] as const;
export type Start = (typeof STARTS)[number];
export const POWER = ["yes", "no", "na"] as const;

/** How long a free job stays live before its company renews it. */
export const JOB_DAYS = 30;
/** How long a featured job stays featured. */
export const SPONSOR_DAYS = 30;
/** Each project lead is sold to this many companies at most. */
export const LEAD_SLOTS = 3;
/** A project is offered to at most this many matching companies per day (the ones offered least recently first). */
export const LEAD_OFFERS_PER_DAY = 12;
/** Projects stay open to companies for this many days. */
export const PROJECT_DAYS = 45;

/**
 * Prices, approved by Samuel on 14 November 2026: 49 USD per lead, 99 USD to feature a job for 30 days, in US dollars
 * for every country. Shown and charged only while approved is true and Stripe is connected
 * (STRIPE_SECRET_KEY). Until then the site says "free to post" and never shows a price.
 * Market references (Nov 2026): Indeed Sponsored Jobs bill per click or per started application, $5/day minimum;
 * Thumbtack and Angi HVAC leads $15 to $110; Google Local Services HVAC leads about $51.
 */
export const PRICING = {
  approved: true,
  lead: { USD: 49 },
  sponsor: { USD: 99 },
} as const;
export const priceCurrency = (_country: string): "USD" => "USD";
/** Local tests run the paid flows against a mock Stripe (STRIPE_MOCK_URL, never set on Vercel). */
const localMock = () => Boolean(process.env.STRIPE_MOCK_URL?.startsWith("http://localhost"));
export const paymentsOn = () => (PRICING.approved || localMock()) && Boolean(process.env.STRIPE_SECRET_KEY);

/**
 * Japan: a site that collects job seekers' details must notify the Ministry of Health, Labour and Welfare first
 * (特定募集情報等提供事業の届出, 職業安定法 第43条の2). Until that is filed and this is true, jobs in Japan send
 * applicants straight to the employer and the site collects no technician details for Japan.
 */
export const JAPAN_SEEKER_DATA = false;
export const collectsSeekers = (country: string) => country !== "JP" || JAPAN_SEEKER_DATA;

/** Job alert emails: at most this many per day in total (Resend's free plan allows 100 a day for every site). */
export const ALERT_DAILY_CAP = 40;

/**
 * Outreach (cold email to trade companies). Off until Samuel approves the texts and sets OUTREACH_LIVE=on in Vercel.
 * It never goes through Resend: Resend's acceptable use policy forbids cold email, and kuchimoto.com carries the
 * forms of every site. It needs its own mailbox: OUTREACH_SMTP_URL, OUTREACH_FROM, OUTREACH_POSTAL_ADDRESS.
 */
export const OUTREACH = {
  /** Countries where emailing a business address published on its own website is lawful without prior consent. */
  defaultCountries: ["US", "JP"],
  /** Emails a day: starts low and climbs, so the mailbox earns a sending reputation. */
  startPerDay: 5,
  stepPerDay: 2,
  maxPerDay: 40,
  /** Days between the first email and each follow-up. Follow-ups only run when replies can be read (IMAP). */
  followUpDays: [4, 11],
  /** Websites read per daily run to find a published business email. */
  enrichPerRun: 60,
} as const;
