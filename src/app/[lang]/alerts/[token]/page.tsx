import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { fill, getDictionary } from "@/content";
import { alertAction } from "@/app/actions";
import { Notice, Shell } from "@/components/Shell";
import { Cta, Label } from "@/components/Typo";
import { countryName } from "@/lib/countries";
import { openAlert } from "@/lib/market";
import { privatePage } from "@/lib/seo";
import { isLocale, pathFor } from "@/lib/site";

export const metadata: Metadata = privatePage;

/** A technician's job alert. The first visit confirms it (double opt-in). */
export default async function AlertPage({ params }: PageProps<"/[lang]/alerts/[token]">) {
  const { lang, token } = await params;
  if (!isLocale(lang)) notFound();
  await connection();
  const alert = await openAlert(token);
  if (!alert) notFound();
  const t = getDictionary(lang);
  const on = alert.status === "active";
  const trade = t.ui.trades[alert.trade as keyof typeof t.ui.trades] ?? alert.trade;
  return (
    <Shell lang={lang} t={t}>
      <section className="mx-auto max-w-[820px] px-4 py-16 sm:px-8 lg:py-24">
        <Label>{t.alerts.title}</Label>
        <div className="mt-6">
          <Notice tone={on ? "sky" : "orange"}>{on ? fill(t.alerts.on, { trade, country: countryName(alert.country, lang), email: alert.email }) : t.alerts.off}</Notice>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Cta href={`${pathFor(lang, "/jobs")}?trade=${alert.trade}&country=${alert.country}`} tone="navy">
            {t.technicians.browse}
          </Cta>
          <form action={alertAction}>
            <input type="hidden" name="token" value={alert.token} />
            <input type="hidden" name="lang" value={lang} />
            <button name="action" value={on ? "off" : "on"} className="rounded-md px-5 py-3.5 text-[15.5px] font-semibold text-navy ring-1 ring-navy/25 transition hover:ring-navy">
              {on ? t.alerts.stop : t.alerts.restart}
            </button>
          </form>
        </div>
      </section>
    </Shell>
  );
}
