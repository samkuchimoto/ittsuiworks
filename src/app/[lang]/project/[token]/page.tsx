import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { fill, getDictionary } from "@/content";
import { projectAction } from "@/app/actions";
import { Field } from "@/components/Forms";
import { Card, Notice, Shell } from "@/components/Shell";
import { Label } from "@/components/Typo";
import { LEAD_SLOTS, POWER, STARTS } from "@/lib/config";
import { countryName } from "@/lib/countries";
import { openProject } from "@/lib/market";
import { privatePage } from "@/lib/seo";
import { isLocale } from "@/lib/site";

export const metadata: Metadata = privatePage;

/** The buyer's page. The first visit confirms the email; a ready project goes to companies at once. */
export default async function ProjectPage({ params }: PageProps<"/[lang]/project/[token]">) {
  const { lang, token } = await params;
  if (!isLocale(lang)) notFound();
  await connection();
  const opened = await openProject(token);
  if (!opened) notFound();
  const { project: p, confirmed } = opened;
  const t = getDictionary(lang);
  const pr = t.project;
  const editable = p.status === "waiting" || p.status === "open";
  const status = p.status === "closed" ? pr.closed : p.status === "waiting" ? pr.waiting : pr.open;

  return (
    <Shell lang={lang} t={t}>
      <section className="bg-sky">
        <div className="mx-auto max-w-[1080px] px-4 py-10 sm:px-8 lg:py-14">
          <Label>{pr.title}</Label>
          <h1 lang={p.lang} className="font-display mt-4 text-[34px] leading-tight text-navy sm:text-[46px]">
            {p.title}
          </h1>
          <p className="mt-2 text-[15.5px] text-mute">
            {t.ui.trades[p.trade as keyof typeof t.ui.trades]} · {p.city}, {countryName(p.country, lang)}
          </p>
          <div className="mt-6 space-y-3">
            {confirmed && <Notice>{pr.confirmed}</Notice>}
            <Notice tone={p.status === "waiting" ? "orange" : "sky"}>{status}</Notice>
            {p.status !== "closed" && <p className="text-[15.5px] font-semibold text-navy">{fill(pr.taken, { n: Math.min(p.sold, LEAD_SLOTS) })}</p>}
          </div>
        </div>
      </section>
      {editable && (
        <section className="mx-auto max-w-[1080px] px-4 py-12 sm:px-8">
          <Card>
            <form action={projectAction} className="grid gap-4 sm:grid-cols-3">
              <input type="hidden" name="token" value={p.token} />
              <input type="hidden" name="lang" value={lang} />
              <Field id="p-power" label={t.form.power}>
                <select id="p-power" name="power" defaultValue={p.power} className="field">
                  {POWER.map((k) => (
                    <option key={k} value={k}>
                      {t.ui.power[k]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="p-budget" label={t.form.budgetApproved}>
                <select id="p-budget" name="budget_approved" defaultValue={p.budget_approved ? "yes" : "no"} className="field">
                  <option value="yes">{t.ui.yes}</option>
                  <option value="no">{t.ui.no}</option>
                </select>
              </Field>
              <Field id="p-start" label={t.form.start}>
                <select id="p-start" name="start" defaultValue={p.start} className="field">
                  {STARTS.map((k) => (
                    <option key={k} value={k}>
                      {t.ui.starts[k]}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex flex-wrap gap-3 sm:col-span-3">
                <button name="action" value="update" className="rounded-md bg-navy px-6 py-3 text-[15.5px] font-semibold text-white transition hover:bg-navy-deep">
                  {pr.update}
                </button>
                <button name="action" value="close" className="rounded-md px-6 py-3 text-[15.5px] font-semibold text-orange-deep ring-1 ring-orange/40 transition hover:ring-orange">
                  {pr.close}
                </button>
              </div>
            </form>
          </Card>
        </section>
      )}
    </Shell>
  );
}
