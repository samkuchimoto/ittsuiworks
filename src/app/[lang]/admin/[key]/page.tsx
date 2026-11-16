import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { adminAddCandidateAction, adminCloseJobAction, adminEventAction, adminEventDoneAction, adminStageAction, importProspectsAction } from "@/app/actions";
import { Card, Shell } from "@/components/Shell";
import { getDictionary } from "@/content";
import { clicksByEmployer } from "@/lib/clicks";
import { PRICING, SOURCING_TRADES, paymentsOn } from "@/lib/config";
import { hasDatabase, query } from "@/lib/db";
import { listJobs, marketStats } from "@/lib/market";
import { isOperator, outreachConfig, outreachStats, renderLeadOffer, renderOutreach, type Prospect } from "@/lib/outreach";
import { CHECKS, EVENT_KINDS, KIND_LABEL, STAGES, eventsFor, labelFor, listInquiries, openFollowups } from "@/lib/pipeline";
import { privatePage } from "@/lib/seo";

export const metadata: Metadata = privatePage;

/** Samuel's view, at /admin/<ADMIN_KEY> (English only): numbers, switches, the outreach queue and a preview of its emails. */
export default async function Admin({ params, searchParams }: PageProps<"/[lang]/admin/[key]">) {
  const { lang, key } = await params;
  await connection();
  const secret = process.env.ADMIN_KEY;
  if (lang !== "en" || !secret || secret.length < 24 || key !== secret || !hasDatabase()) notFound();
  const t = getDictionary("en");
  const { imported, msg: rawMsg } = await searchParams;
  const msg = typeof rawMsg === "string" ? rawMsg.slice(0, 200) : "";
  const [pipeline, followups, stats, prospects, { jobs }, sample, operator, firstContractor, employers] = await Promise.all([
    listInquiries(),
    openFollowups(),
    marketStats(),
    outreachStats(),
    listJobs({ perPage: 30 }),
    query<Prospect>(`SELECT * FROM prospects WHERE email IS NOT NULL ORDER BY status = 'ready' DESC, created_at DESC LIMIT 15`),
    query<Prospect>(
      `SELECT * FROM prospects WHERE email IS NOT NULL AND status = 'ready' AND (source = 'peeringdb' OR (source = 'osm' AND trade = 'datacenter')) ORDER BY created_at LIMIT 1`,
    ),
    query<Prospect>(
      `SELECT * FROM prospects WHERE email IS NOT NULL AND status = 'ready' AND NOT (source = 'peeringdb' OR (source = 'osm' AND trade = 'datacenter')) ORDER BY created_at LIMIT 1`,
    ),
    clicksByEmployer(30, 30),
  ]);
  const events = await eventsFor(Object.values(pipeline).flat().map((r) => r.id));
  const today = new Date().toISOString().slice(0, 10);
  const cfg = outreachConfig();
  // The next contractor in line (the newest rows are often operators).
  const contractor = firstContractor[0] ?? sample.find((p) => !isOperator(p));
  const preview = contractor ? renderOutreach(contractor, 0) : null;
  // The two emails waiting for Samuel's approval, exactly as they would go out (the lead one with an example project).
  const waiting = [
    {
      label: `Lead in hand (${cfg.leadOffers ? "on" : "waiting for approval"}), example project, as it would go to ${contractor?.company}`,
      mail: contractor
        ? renderLeadOffer(contractor, {
            title: "Chiller replacement for a 4 MW data hall (example)",
            place: "Dallas, TX, United States",
            budget: "250,000 to 1 million USD",
            start: "As soon as possible",
            price: "$49",
            link: "https://ittsuiworks.com/lead/...",
          })
        : null,
    },
    { label: `Operator first email (${cfg.operators ? "on" : "waiting for approval"}), as it would go to ${operator[0]?.company}`, mail: operator[0] ? renderOutreach(operator[0], 0) : null },
  ];
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
            {cfg.sending ? "on" : cfg.paused ? "PAUSED in config.ts (Samuel, 16 Nov 2026: no more lead pitches)" : `off (OUTREACH_LIVE ${cfg.live ? "on" : "off"}, SMTP ${cfg.smtp ? "set" : "missing"}, postal address ${cfg.address ? "set" : "missing"})`}. Replies read: {cfg.imap ? "yes" : "no (no follow-ups)"}.
            Lead in hand: {cfg.leadOffers ? "on" : "off (waits for Samuel's OK, then OUTREACH_LEAD_OFFERS=on)"}. Operators:{" "}
            {cfg.operators ? "on" : "no email until Samuel approves their text (then OUTREACH_OPERATORS=on)"}. Countries: {cfg.countries.join(", ")}.
          </p>
        </Card>

        <Card>
          <div id="pipeline" className="scroll-mt-24" />
          <h2 className="text-[20px] font-bold text-navy">Sales and sourcing pipeline</h2>
          <p className="mt-2 text-[14.5px] text-mute">
            Every request, project and application from the site, plus Indeed candidates you add below. Buyers move New Lead, Contacted, Qualified, Proposal, Provider Matching, Agreement, In Progress, Completed, Repeat Customer; Agreement and later need the signed agreement ticked (and, for a project, the partner&apos;s license and insurance). Applicants move Application Received, Qualification Pending, Verification In Progress, Verified, Available for Matching; Verified and Available need the checks ticked. Nobody is introduced and nothing is charged from here.
          </p>
          {msg && <p className={`mt-4 ${box}`}>{msg}</p>}

          <div className="mt-6 rounded-xl bg-sky p-4">
            <h3 className="text-[15px] font-bold text-navy">Follow-ups due ({followups.length})</h3>
            {followups.length === 0 ? (
              <p className="mt-2 text-[14px] text-mute">None open. Add one with &quot;Log activity&quot; and the kind Follow-up.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line text-[14px]">
                {followups.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                    <span>
                      <b className={e.due && e.due <= today ? "text-orange-deep" : "text-navy"}>{e.due ?? "no date"}</b> · <a href={`#lead-${e.inquiry_id}`} className="font-semibold underline">{e.who}</a> · {e.text}
                      {e.owner ? ` · ${e.owner}` : ""}
                    </span>
                    <form action={adminEventDoneAction}>
                      <input type="hidden" name="key" value={key} />
                      <input type="hidden" name="event" value={e.id} />
                      <button className="rounded-md px-3 py-1.5 text-[13px] font-semibold text-navy ring-1 ring-navy/30">Mark done</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {(["talent_request", "project", "technician", "partner"] as const).map((kind) => {
            const rows = pipeline[kind];
            return (
              <div key={kind} className="mt-8">
                <h3 className="text-[16px] font-bold text-navy">
                  {KIND_LABEL[kind]}: {rows.length}
                  <span className="ml-2 text-[13px] font-normal text-mute">
                    {STAGES[kind]
                      .map((s) => [labelFor(kind, s), rows.filter((r) => r.stage === s).length] as const)
                      .filter(([, n]) => n > 0)
                      .map(([label, n]) => `${label} ${n}`)
                      .join(" · ")}
                  </span>
                </h3>
                {rows.length === 0 ? (
                  <p className={`mt-3 ${box}`}>None yet.</p>
                ) : (
                  <ul className="mt-3 space-y-4">
                    {rows.map((r) => (
                      <li key={r.id} id={`lead-${r.id}`} className="scroll-mt-24 rounded-xl bg-mist p-4 text-[14px]">
                        <p className="flex flex-wrap justify-between gap-2">
                          <b className="text-navy">
                            {r.company ? `${r.company} · ` : ""}
                            {r.name} <span className="font-normal text-mute">({r.id.toUpperCase()})</span>
                          </b>
                          <span className="text-[12.5px] font-bold uppercase tracking-[0.1em] text-orange">{labelFor(kind, r.stage)}</span>
                        </p>
                        <p className="mt-1 text-mute">
                          <a href={`mailto:${r.email}`} className="underline">
                            {r.email}
                          </a>
                          {r.phone ? ` · ${r.phone}` : ""} · {r.place}, {r.country} · {r.trades.join(", ")} · {r.source} · {new Date(r.created_at).toISOString().slice(0, 10)}
                        </p>
                        <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[220px_1fr]">
                          {Object.entries(r.data).map(([k, v]) => (
                            <div key={k} className="contents">
                              <dt className="text-mute">{k}</dt>
                              <dd className="whitespace-pre-wrap">{v || "-"}</dd>
                            </div>
                          ))}
                        </dl>
                        {r.consent_at && (
                          <p className="mt-2 text-[13px] text-mute">
                            Consent {new Date(r.consent_at).toISOString().slice(0, 10)}: {r.consent_text}
                          </p>
                        )}
                        {(r.files ?? []).map((file) => (
                          <a key={file.id} href={`/api/admin/${key}/file/${file.id}`} className="mr-4 mt-2 inline-block font-semibold text-navy underline">
                            Download {file.name} ({Math.round(file.size / 1024)} KB)
                          </a>
                        ))}
                        {Object.keys(r.checks).length > 0 && <p className="mt-2 text-[13px] text-navy">Checked: {Object.entries(r.checks).map(([k, v]) => `${k} (${v})`).join(" · ")}</p>}
                        {r.notes && <p className="mt-2 whitespace-pre-wrap text-[13px] text-mute">{r.notes}</p>}

                        {(events[r.id] ?? []).length > 0 && (
                          <ul className="mt-3 space-y-1 border-l-2 border-navy/20 pl-3 text-[13px]">
                            {(events[r.id] ?? []).map((e) => (
                              <li key={e.id} className={e.kind === "followup" && e.done ? "text-mute line-through" : ""}>
                                <span className="text-mute">{new Date(e.at).toISOString().slice(0, 16).replace("T", " ")}</span> <b className="uppercase">{e.kind}</b>
                                {e.amount ? ` · ${e.amount}` : ""}
                                {e.due ? ` · due ${e.due}` : ""}
                                {e.owner ? ` · ${e.owner}` : ""} · {e.text}
                              </li>
                            ))}
                          </ul>
                        )}

                        <form action={adminStageAction} className="mt-3 flex flex-wrap items-end gap-3 border-t border-line pt-3">
                          <input type="hidden" name="key" value={key} />
                          <input type="hidden" name="id" value={r.id} />
                          <select name="stage" defaultValue={r.stage} className="field w-auto py-2 text-[14px]">
                            {STAGES[kind].map((s) => (
                              <option key={s} value={s}>
                                {labelFor(kind, s)}
                              </option>
                            ))}
                          </select>
                          {CHECKS[kind].map((c) => (
                            <label key={c.key} className="flex max-w-[22rem] items-start gap-2 text-[13px]">
                              <input type="checkbox" name="checks" value={c.key} defaultChecked={Boolean(r.checks[c.key])} className="mt-0.5 accent-navy" />
                              {c.label}
                            </label>
                          ))}
                          <input name="note" maxLength={500} placeholder="Note (lookup URL, who confirmed...)" className="field min-w-[14rem] flex-1 py-2 text-[14px]" />
                          <button className="rounded-md bg-navy px-4 py-2 text-[14px] font-semibold text-white">Save stage</button>
                        </form>

                        <form action={adminEventAction} className="mt-2 flex flex-wrap items-end gap-2">
                          <input type="hidden" name="key" value={key} />
                          <input type="hidden" name="id" value={r.id} />
                          <select name="kind" defaultValue="call" className="field w-auto py-2 text-[14px]" aria-label="Activity">
                            {EVENT_KINDS.map((k) => (
                              <option key={k} value={k}>
                                {{ call: "Call", email: "Email", meeting: "Meeting", note: "Note", followup: "Follow-up", proposal: "Proposal" }[k]}
                              </option>
                            ))}
                          </select>
                          <input name="text" required maxLength={2000} placeholder="What was said, decided or sent" className="field min-w-[16rem] flex-1 py-2 text-[14px]" />
                          <input name="due" type="date" className="field w-auto py-2 text-[14px]" aria-label="Due date (follow-up)" />
                          <input name="owner" maxLength={60} placeholder="Owner" className="field w-[8rem] py-2 text-[14px]" />
                          <input name="amount" inputMode="decimal" maxLength={14} placeholder="Amount (USD)" className="field w-[9rem] py-2 text-[14px]" />
                          <button className="rounded-md px-4 py-2 text-[14px] font-semibold text-navy ring-1 ring-navy/30">Log activity</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          <form action={adminAddCandidateAction} className="mt-10 grid gap-3 rounded-xl bg-sky p-5 sm:grid-cols-2">
            <input type="hidden" name="key" value={key} />
            <p className="text-[15px] font-bold text-navy sm:col-span-2">Add an Indeed candidate who said yes to question 3 (lands at Qualification Pending; no email is sent to them)</p>
            <input name="name" required placeholder="Full name" className="field" />
            <input name="email" type="email" required placeholder="Email they gave" className="field" />
            <input name="phone" placeholder="Phone they gave" className="field" />
            <input name="place" placeholder="City, state (e.g. Miami, FL)" className="field" />
            <select name="trade" required defaultValue="" className="field">
              <option value="" disabled>
                Trade
              </option>
              {SOURCING_TRADES.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <input name="post" placeholder="Indeed post (e.g. Miami HVAC)" className="field" />
            <input name="licenses" placeholder="Q1: licenses and certifications" className="field sm:col-span-2" />
            <input name="license_no" placeholder="License number for verification" className="field" />
            <input name="years" placeholder="Q1: years commercial / residential" className="field" />
            <input name="rate" placeholder="Q2: target rate" className="field" />
            <input name="available" placeholder="Q2: earliest availability" className="field" />
            <label className="flex items-center gap-2 text-[14px]">
              Day they said yes <input name="consent_day" type="date" required className="field w-auto py-2" />
            </label>
            <label className="flex items-start gap-2 text-[14px]">
              <input type="checkbox" name="consent_yes" value="yes" required className="mt-1 accent-navy" />
              They replied yes to question 3 (consent to be presented) in Indeed messages.
            </label>
            <button className="rounded-md bg-navy px-5 py-3 text-[15px] font-semibold text-white sm:col-span-2 sm:justify-self-start">Add at Qualification Pending</button>
          </form>
        </Card>

        <Card>
          <h2 className="text-[20px] font-bold text-navy">Outreach queue</h2>
          <p className="mt-2 text-[14.5px] text-mute">{Object.entries(prospects).map(([k, v]) => `${k}: ${v}`).join(" · ") || "Empty: the daily run fills it."}</p>
          {preview && (
            <div className="mt-5">
              <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-orange">First email, as it would go to {contractor?.company}</p>
              <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-sky p-4 text-[14px] leading-relaxed">{`Subject: ${preview.subject}\n\n${preview.text}`}</pre>
            </div>
          )}
          {waiting.map(
            (w) =>
              w.mail && (
                <div key={w.label} className="mt-5">
                  <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-orange">{w.label}</p>
                  <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-sky p-4 text-[14px] leading-relaxed">{`Subject: ${w.mail.subject}\n\n${w.mail.text}`}</pre>
                </div>
              ),
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
          <h2 className="text-[20px] font-bold text-navy">Apply clicks by employer (30 days)</h2>
          <p className="mt-2 text-[14.5px] text-mute">
            Technicians sent to the employer&apos;s own page, tagged with Ittsui Works as the source (utm_source=ittsuiworks; on Lever boards the application is marked &quot;Ittsui Works&quot;). Crawlers and link checkers are not counted.
          </p>
          {employers.length ? (
            <ul className="mt-4 divide-y divide-line text-[14.5px]">
              {employers.map((e) => (
                <li key={e.company} className="flex justify-between gap-3 py-2">
                  <b>{e.company}</b>
                  <span className="text-mute">
                    {`${e.clicks} ${e.clicks === 1 ? "click" : "clicks"} · ${e.jobs} ${e.jobs === 1 ? "job" : "jobs"}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={`mt-4 ${box}`}>None yet.</p>
          )}
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
