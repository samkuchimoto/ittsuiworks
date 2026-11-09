# Ittsui Works

Site for ittsuiworks.com: lead generation, appointment setting and recruiting for commercial HVAC, data center and marine companies in the USA and Japan. English at `/`, Japanese at `/ja`.

- Next.js 16 (App Router, `src/app/[lang]`), Tailwind 4, static pages.
- Copy: `src/content/en.ts` and `src/content/ja.ts` (same shape).
- Photos: `npm run media -- "<folder with the source PNGs>"` writes WebP files to `public/media`.
- Forms post to `/api/contact`, which emails the inbox through Resend. Set `RESEND_API_KEY`, `CONTACT_TO_EMAIL` and `CONTACT_FROM_EMAIL` in Vercel.

Operated by Kuchimoto LLC, a Wyoming limited liability company.
