import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { adminCloseJobAction, importProspectsAction } from "@/app/actions";
import { Card, Shell } from "@/components/Shell";
import { getDictionary } from "@/content";
import { PRICING, paymentsOn } from "@/lib/config";
import { hasDatabase, query } from "@/lib/db";
import { listJobs, marketStats } from "@/lib/market";
import { outreachConfig, outreachStats, renderOutreach, type Prospect } from "@/lib/outreach";
import { privatePage } from "@/lib/seo";

export const metadata: Metadata = privatePage;

/** Samuel's view, at /admin/<ADMIN_KEY> (English only): numbers, switches, the outreach queue and a preview of its emails. */
export default async function Admin({ params, searchParams }: PageProps<"/[lang]/admin/[key]">) {
  const { lang, key } = await params;
  await connection();
  const secret = process.env.ADMIN_KEY;
  if (lang !== "en" || !secret || secret.length < 24 || key !== secret || !hasDatabase()) notFound();
  const t = getDictionary("en");
  const imported = (await searchParams).imported;
  const [stats, prospects, { jobs }, sample] = await Promise.all([
    marketStats(),
    outreachStats(),
    listJobs({ perPage: 30 }),
    query<Prospect>(`SELECT * FROM prospects WHERE email IS NOT NULL ORDER BY status = 'ready' DESC, created_at DESC LIMIT 15`),
  ]);
  const cfg = outreachConfig();
  const preview = sample[0] ? renderOutreach(sample[0], 0) : null;
  const box = "rounded-xl bg-mist px-4 py-3 text-[14.5px]";

  return (
    <Shell lang="en" t={t}>
      <section className="mx-auto max-w-[1280px] space-y-8 px-4 py-12 sm:px-8">
        <h1 className="font-display text-[40px] text-navy">Ittsui Works admin</h1>
        {imported && <p className={box}>Imported: {imported} new companies.</p>}
        <Card>
          <h2 className="text-[20px] font-bold text-navy">Numbers</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Object.entries(stats).map(([k, v]) => (
              <p key={k} className={box}>
                <span className="block text-[12px] uppercase tracking-[0.12em] text-mute">{k}</span>
                <span className="text-[22px] font-bold text-navy">{v}</span>
              </p>
            ))}
          </div>
          <p className="mt-4 text-[14.5px] text-mute">
            Payments: {paymentsOn() ? "on" : `off (prices approved: ${PRICING.approved ? "yes" : "no"}, Stripe: ${process.env.STRIPE_SECRET_KEY ? "yes" : "no"})`}. Outreach sending:{" "}
            {cfg.sending ? "on" : `off (OUTREACH_LIVE ${cfg.live ? "on" : "off"}, SMTP ${cfg.smtp ? "set" : "missing"}, postal address ${cfg.address ? "set" : "missing"})`}. Replies read: {cfg.imap ? "yes" : "no (no follow-ups)"}.
            Countries: {cfg.countries.join(", ")}.
          </p>
        </Card>

        <Card>
          <h2 className="text-[20px] font-bold text-navy">Outreach queue</h2>
          <p className="mt-2 text-[14.5px] text-mute">{Object.entries(prospects).map(([k, v]) => `${k}: ${v}`).join(" · ") || "Empty: the daily run fills it."}</p>
          {preview && (
            <div className="mt-5">
              <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-orange">First email, as it would go to {sample[0].company}</p>
              <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-sky p-4 text-[14px] leading-relaxed">{`Subject: ${preview.subject}\n\n${preview.text}`}</pre>
            </div>
          )}
          <ul className="mt-5 divide-y divide-line text-[14px]">
            {sample.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  <b>{p.company}</b> · {p.email} · {p.country} · {p.trade}
                </span>
                <span className="text-mute">
                  {p.status} (step {p.step}) · {p.source}
                </span>
              </li>
            ))}
          </ul>
          <form action={importProspectsAction} className="mt-6 space-y-3">
            <input type="hidden" name="key" value={key} />
            <label className="block text-[14px] font-semibold text-navy" htmlFor="csv">
              Import companies (one per line: company, email, website, country, trade). Only business addresses the company publishes itself.
            </label>
            <textarea id="csv" name="csv" rows={5} className="field font-mono text-[13px]" placeholder="Acme Mechanical, info@acmemech.com, acmemech.com, US, hvac" />
            <button className="rounded-md bg-navy px-5 py-3 text-[15px] font-semibold text-white">Import</button>
          </form>
        </Card>

        <Card>
          <h2 className="text-[20px] font-bold text-navy">Live jobs</h2>
          <ul className="mt-4 divide-y divide-line text-[14.5px]">
            {jobs.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <a href={`/jobs/${job.id}`} className="font-semibold text-navy underline underline-offset-4">
                  {job.title}
                </a>
                <span className="text-mute">
                  {job.company_name} · {job.city}, {job.country} · {job.applications} applications
                </span>
                <form action={adminCloseJobAction}>
                  <input type="hidden" name="key" value={key} />
                  <input type="hidden" name="job" value={job.id} />
                  <button className="rounded-md px-3 py-1.5 text-[13.5px] font-semibold text-orange-deep ring-1 ring-orange/40">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </Shell>
  );
}
