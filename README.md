# Ittsui Works

ittsuiworks.com: a job board and project leads for commercial HVAC, data center and marine companies, in any country. English at `/`, Japanese at `/ja`. It runs by itself.

## The two models

- **Jobs (Indeed model).** Companies post jobs free; the email link publishes them for 30 days. Technicians apply free; the application reaches the employer's inbox at once. Job alerts email new jobs in a trade and country once a day. Paid option: feature a job for 30 days. Distribution: JobPosting structured data (Google for Jobs), `/sitemap.xml` with every job, `/jobs.xml` feed for job sites, IndexNow pings, `/llms.txt`.
- **Projects (Thumbtack / Angi model).** Buyers post projects free. Only projects with power, an approved budget and a start date go out. Matching companies get them by email without the buyer's contact and pay per lead; three companies at most per lead.

## Switches (`src/lib/config.ts`)

- `PRICING.approved`: prices are shown and charged only when true **and** `STRIPE_SECRET_KEY` is set. Until then the site says "free to post" and shows no price.
- `JAPAN_SEEKER_DATA`: false until the 特定募集情報等提供事業 notification to MHLW is filed. Jobs in Japan send applicants to the employer's own link; no technician data is collected for Japan.
- Outreach (`src/lib/outreach.ts`, texts in `src/lib/outreach-texts.ts`): finds companies (OpenStreetMap, PeeringDB, admin CSV), reads the business email each publishes on its own site, and sends only when `OUTREACH_LIVE=on` plus `OUTREACH_SMTP_URL`, `OUTREACH_FROM`, `OUTREACH_POSTAL_ADDRESS` are set (optional `OUTREACH_IMAP_URL` for reply detection and follow-ups, `OUTREACH_COUNTRIES`). Never through Resend (its policy forbids cold email).

## Environment (Vercel)

`DATABASE_URL` (Neon, tables created on first use), `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`, `CRON_SECRET`, `ADMIN_KEY` (admin page at `/admin/<ADMIN_KEY>`), and when payments go on: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (endpoint `/api/stripe-webhook`).

## Daily run

`vercel.json` calls `/api/cron/daily` at 22:00 UTC: jobs end, alerts go out, leads are offered, missed payments are recovered, outreach runs, and one summary email reaches the inbox.

## Code

- Next.js 16 (App Router, `src/app/[lang]`), Tailwind 4. Copy: `src/content/en.ts` and `ja.ts` (same shape).
- Platform: `src/lib/market.ts`; database: `src/lib/db.ts`; email: `src/lib/mail.ts`.
- Photos: `npm run media -- "<folder with the source PNGs>"`. Live check: `npm run check:live`.

Operated by Kuchimoto LLC, a Wyoming limited liability company.
