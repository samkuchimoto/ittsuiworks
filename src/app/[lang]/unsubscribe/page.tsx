import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { fill, getDictionary } from "@/content";
import { unsubscribeAction } from "@/app/actions";
import { Notice, Shell } from "@/components/Shell";
import { Label } from "@/components/Typo";
import { alertByToken } from "@/lib/market";
import { prospectById } from "@/lib/outreach";
import { privatePage } from "@/lib/seo";
import { isLocale } from "@/lib/site";

export const metadata: Metadata = privatePage;

/** The page behind every "stop these emails" link: one button, so link scanners never unsubscribe anyone. */
export default async function Unsubscribe({ params, searchParams }: PageProps<"/[lang]/unsubscribe">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await connection();
  const t = getDictionary(lang);
  const sp = await searchParams;
  const kind = String(sp.k ?? "");
  const token = String(sp.t ?? "").slice(0, 40);
  const done = sp.done === "1";
  const email = done ? null : kind === "alert" ? (await alertByToken(token))?.email : kind === "prospect" ? (await prospectById(token))?.email : null;

  return (
    <Shell lang={lang} t={t}>
      <section className="mx-auto max-w-[820px] px-4 py-16 sm:px-8 lg:py-24">
        <Label>{t.unsubscribe.title}</Label>
        <div className="mt-6">
          {done ? (
            <Notice>{t.unsubscribe.done}</Notice>
          ) : email ? (
            <form action={unsubscribeAction} className="space-y-6">
              <input type="hidden" name="k" value={kind} />
              <input type="hidden" name="t" value={token} />
              <input type="hidden" name="lang" value={lang} />
              <p className="font-display text-[28px] leading-tight text-navy">{fill(t.unsubscribe.text, { email })}</p>
              <button className="rounded-md bg-navy px-7 py-4 text-[16px] font-semibold text-white transition hover:bg-navy-deep">{t.unsubscribe.confirm}</button>
            </form>
          ) : (
            <Notice>{t.unsubscribe.done}</Notice>
          )}
        </div>
      </section>
    </Shell>
  );
}
