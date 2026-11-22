# Ittsui Works

ittsuiworks.com: technical recruiting and subcontractor sourcing for commercial HVAC, electrical, data center and marine work, in the United States and Japan. English at `/`, Japanese at `/ja`.

## The offers (since 16 November 2026)

- **Direct-hire placement (US hires):** 25% of first-year base pay, owed only on a hire we introduced, 90-day replacement on the written terms. Employers send a role at `/request`; nothing is charged on the site.
- **Commercial project sourcing:** owners and GCs submit at `/post-project` at no charge; the licensed trade partner pays 8% to 12% on paid milestones under a written agreement.
- Every request and application lands in the pipeline (`src/lib/pipeline.ts`, admin page); a person confirms agreements, licenses and insurance before any introduction. The formal order and terms: `/deal`.
- The free job board and job alerts stay (they bring technicians).

## Retired models (kept in the code, switched off by `PRICING.approved = false` and `OUTREACH.paused`)

- **Jobs (Indeed model).** Companies post jobs free; the email link publishes them for 30 days. Technicians apply free; the application reaches the employer's inbox at once. Job alerts email new jobs in a trade and country once a day. Paid option: feature a job for 30 days. Distribution: JobPosting structured data (Google for Jobs), `/sitemap.xml` with every job, `/jobs.xml` feed for job sites, IndexNow pings, `/llms.txt`.
- **Projects (Thumbtack / Angi model).** Buyers post projects free. Only projects with power, an approved budget and a start date go out. Matching companies get them by email without the buyer's contact and pay per lead; three companies at most per lead.

## Switches (`src/lib/config.ts`)

- `PRICING.approved`: prices are shown and charged only when true **and** `STRIPE_SECRET_KEY` is set. Until then the site says "free to post" and shows no price.
- `JAPAN_SEEKER_DATA`: false until the 特定募集情報等提供事業 notification to MHLW is filed. Jobs in Japan send applicants to the employer's own link; no technician data is collected for Japan.
- Outreach (`src/lib/outreach.ts`, texts in `src/lib/outreach-texts.ts`): paused (`OUTREACH.paused`), and its texts still pitch the retired paid leads, so `LEGACY_LEAD_MODEL` in `outreach-texts.ts` blocks every send until approved texts for the current offers replace them. It finds companies (OpenStreetMap, PeeringDB, admin CSV), reads the business email each publishes on its own site, and sends only when `OUTREACH_LIVE=on` plus `OUTREACH_SMTP_URL`, `OUTREACH_FROM`, `OUTREACH_POSTAL_ADDRESS` are set (optional `OUTREACH_IMAP_URL` for reply detection and follow-ups, `OUTREACH_COUNTRIES`). Never through Resend (its policy forbids cold email).

## Environment (Vercel)

`DATABASE_URL` (Neon, tables created on first use), `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`, `CRON_SECRET`, `ADMIN_KEY` (admin page at `/admin/<ADMIN_KEY>`), and when payments go on: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (endpoint `/api/stripe-webhook`).

## The deal page (`/deal`)

English only, for US clients: the two deals, how payment works, and one **Place an Order** button that opens the official order form (`/deal#order` opens it directly). Orders post to `/api/deal-order`, land in the `deal_orders` table and in the admin pipeline (source `deal`), and email the client (reference, terms, next step) and the team. Free webmail, disposable addresses, an email domain that differs from the website, and a billing address outside the US set `needs_manual_review`. Copy and terms: `src/content/deal.ts` (each order keeps the terms version it confirmed).

- Bots: Vercel BotID (`botid` package, Basic mode: free, no keys or env vars). `src/instrumentation-client.ts` lists the protected route; `/api/deal-order` refuses any request BotID marks as a bot (a script, curl, the form copied elsewhere). On a computer it always answers "human"; `BOTID_DEV_BYPASS=BAD-BOT` tries the refusal.
- `ORDER_ALERT_EMAIL`: the team address for new orders (falls back to `CONTACT_TO_EMAIL`); also copied on Mercury invoices.
- `MERCURY_API_TOKEN` (read-write; Mercury accepts it only from allowlisted IPs, so the server needs a fixed outbound IP), `MERCURY_DESTINATION_ACCOUNT_ID` (from `GET /accounts`), optional `MERCURY_API_URL` (sandbox) and `MERCURY_PAY_URL_TEMPLATE` (`...{slug}`, once confirmed from a real invoice). On a result, the admin page's **Create Mercury invoice** button computes the fee (25% Net 15 from the start date, or 8% to 12% Net 7 from the cleared milestone) and Mercury emails the client its hosted pay page with virtual account numbers (`useRealAccountNumber: false`). No bank account or routing number is ever in the code, the site or our emails.

## Distribution (22 November 2026)

- **Campaigns** (`CAMPAIGNS` in `src/lib/config.ts`): Miami electrical and Houston HVAC first, because we have technician supply there; this is a prospecting order, not a limit on where we work. Each campaign has a ready link on the admin page (`/request?trade=…&hub=…&utm_source=email&utm_medium=outbound&utm_campaign=…`), which opens the existing request form with the trade and place chosen. Add a row to open a new market or trade.
- **Attribution:** `utm_source`, `utm_medium`, `utm_campaign` and the referring site's host are kept for the tab's session (`src/lib/attribution.ts`, sessionStorage, no cookie) and saved with any request, project, application or order in `inquiries.attribution`. The admin shows it on each lead and counts buyers per campaign and stage.
- **Employer pipeline:** New Lead, Contacted, Qualified Vacancy, Terms Discussion, Signed Agreement, Authorized Candidate Introduction, Interview, Hire, Invoice. Signed Agreement needs the signed agreement ticked, an introduction each candidate's own yes, Hire and Invoice the hire confirmed in writing. Every employer lead shows its next action and warns when no follow-up is planned.
- **Vacancy emails** (`src/lib/employer-outreach.ts`): two short emails per lead once its vacancy is verified (role and link). The site never sends them: a person sends from their own mailbox and logs it with who approved it. They stay drafts until Samuel approves the words and `EMPLOYER_TEMPLATES=approved` is set in Vercel.

## Daily run

`vercel.json` calls `/api/cron/daily` at 22:00 UTC: jobs end, alerts go out, leads are offered, missed payments are recovered, outreach runs, and one summary email reaches the inbox.

## Code

- Next.js 16 (App Router, `src/app/[lang]`), Tailwind 4. Copy: `src/content/en.ts` and `ja.ts` (same shape).
- Platform: `src/lib/market.ts`; database: `src/lib/db.ts`; email: `src/lib/mail.ts`.
- Photos: `npm run media -- "<folder with the source PNGs>"`. Live check: `npm run check:live`.

Operated by Kuchimoto LLC, a Wyoming limited liability company.
