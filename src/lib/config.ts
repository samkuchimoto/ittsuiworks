/**
 * Every rule of the platform in one place.
 *
 * Since 16 November 2026 (Samuel): Ittsui Works is a B2B technical recruiting and subcontractor sourcing network.
 * Employers request technicians, facility owners and general contractors submit commercial projects, technicians and
 * licensed trade companies apply. Every submission goes into the inquiry pipeline (lib/pipeline.ts); agreements,
 * state license checks and insurance checks are confirmed by a person before any engagement. Nothing is charged on
 * the site. The free job board and job alerts stay (they bring technicians).
 *
 * Before that, two self-serve models (kept in the code, switched off by PRICING.approved = false):
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
  /** OFF since 16 November 2026 (Samuel): no 49 USD leads, no 99 USD featured jobs, no card payment on the site. */
  approved: false,
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

/**
 * The sourcing network (16 November 2026). Trades a request, project, technician or partner can name: the job board's
 * three trades plus commercial electrical.
 */
export const SOURCING_TRADES = ["hvac", "electrical", "datacenter", "marine"] as const;
export type SourcingTrade = (typeof SOURCING_TRADES)[number];
/** Typical project size a trade partner takes, and the size of a submitted commercial project (USD). */
export const PROJECT_SIZES = ["10k50k", "50k250k", "250k"] as const;
export const ENGAGEMENTS = ["direct_hire", "contract", "contract_to_hire"] as const;
export const HEADCOUNTS = ["1", "2-5", "6-10", "11-25", "26+"] as const;
export const EXPERIENCE = ["0-2", "3-5", "6-10", "10+"] as const;
export const CREW_SIZES = ["1-5", "6-15", "16-50", "51+"] as const;
/** Résumé or license upload: PDF, image or Word, under Vercel's 4.5 MB request limit. */
export const UPLOAD = { maxBytes: 4_000_000, types: ["application/pdf", "image/jpeg", "image/png", "image/heic", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] } as const;
export const collectsSeekers = (country: string) => country !== "JP" || JAPAN_SEEKER_DATA;

/**
 * Job import, the way Indeed began (lib/feeds.ts): technician jobs from employers' public careers pages, each on its
 * own page with a link back to apply. Runs every day (vercel.json cron /api/cron/import). A job leaves the site the
 * day it leaves the employer's page; keepDays is the safety net if the import ever stops. Never Japan.
 * Turning `on` to false stops new imports; jobs already listed then end within keepDays.
 */
export const IMPORT = { on: true, keepDays: 7, maxNewPerRun: 600 } as const;

/** Job alert emails: at most this many per day in total (Resend's free plan allows 100 a day for every site). */
export const ALERT_DAILY_CAP = 40;

/**
 * Outreach (cold email to trade companies). Off until Samuel approves the texts and sets OUTREACH_LIVE=on in Vercel.
 * It never goes through Resend: Resend's acceptable use policy forbids cold email, and kuchimoto.com carries the
 * forms of every site. It needs its own mailbox: OUTREACH_SMTP_URL, OUTREACH_FROM, OUTREACH_POSTAL_ADDRESS.
 */
export const OUTREACH = {
  /**
   * PAUSED (Samuel, 16 November 2026): Ittsui Works no longer pitches contractors to buy leads; it becomes a B2B
   * technical recruiting and subcontractor sourcing network. While true, nothing is emailed by outreach: no first
   * emails, follow-ups, lead-in-hand offers or operator emails. Discovery, email finding and reply/bounce reading
   * still run. Set it back to false only on his word, with new approved texts.
   */
  paused: true,
  /** Countries where emailing a business address published on its own website is lawful without prior consent. */
  defaultCountries: ["US", "JP"],
  /**
   * Emails a day, counted from the first email of each sending domain (Samuel, 14 November 2026: "10 to 15 a day
   * for the first two weeks on every new domain"): 10 rising to 15 over warmupDays, then stepPerDay more each day
   * up to maxPerDay.
   */
  warmupFrom: 10,
  warmupTo: 15,
  warmupDays: 14,
  stepPerDay: 2,
  maxPerDay: 40,
  /**
   * Hard ceiling over the warm-up (Samuel, 15 November 2026: "Keep the 10-a-day limit from hello@getittsuiworks.com
   * for now. Do not raise it yet."). Raise it only on his word; the warm-up above then applies again.
   */
  dailyCap: 10,
  /** Days between the first email and each follow-up. Follow-ups only run when replies can be read (IMAP). */
  followUpDays: [4, 11],
  /** Websites read per daily run to find a published business email. */
  enrichPerRun: 60,
  /**
   * Lead in hand (the way Thumbtack and Angi filled a new city): an open project that fewer than LEAD_SLOTS signed-up
   * companies took is offered to companies of the same trade and country on the outreach list, from the outreach
   * mailbox, inside the same daily limit. At most perProject a run for one project, maxPerProject in all, and one
   * such email per company every spacingDays. Off unless OUTREACH_LEAD_OFFERS=on (Samuel approves the text first).
   */
  leadInHand: { perProject: 5, maxPerProject: 25, spacingDays: 7 },
} as const;

/** The day's limit, `days` after the first email from this sending domain. */
export function outreachQuota(days: number): number {
  const o = OUTREACH;
  const warm =
    days < o.warmupDays ? Math.round(o.warmupFrom + ((o.warmupTo - o.warmupFrom) * days) / (o.warmupDays - 1)) : Math.min(o.maxPerDay, o.warmupTo + o.stepPerDay * (days - o.warmupDays + 1));
  return Math.min(warm, o.dailyCap);
}
