import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/content";
import { RequestForm } from "@/components/Forms";
import { CheckIcon } from "@/components/Icons";
import { Card, PageHead, Shell } from "@/components/Shell";
import { countryOptions } from "@/lib/countries";
import { alternates } from "@/lib/seo";
import { isLocale } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/request">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang);
  return { title: t.meta.requestTitle, description: t.meta.requestDescription, alternates: alternates(lang, "/request") };
}

/** Employers: the B2B recruiting and staffing request. It goes to the pipeline and the inbox; nothing is charged here. */
export default async function Request({ params }: PageProps<"/[lang]/request">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  return (
    <Shell lang={lang} t={t} current="/request">
      <PageHead lang={lang} t={t} path="/request" label={t.request.label} title={t.request.title} intro={t.request.intro} />
      <section className="mx-auto grid max-w-[1280px] gap-10 px-4 py-12 sm:px-8 lg:grid-cols-[1fr_1.6fr] lg:gap-14 lg:py-16">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ul className="space-y-4">
            {t.request.points.map((point) => (
              <li key={point} className="flex gap-3 text-[16.5px] font-semibold leading-relaxed text-navy">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-sky ring-1 ring-navy/10">
                  <CheckIcon className="size-4" />
                </span>
                {point}
              </li>
            ))}
          </ul>
          <p className="mt-8 border-t border-line pt-5 text-[14px] leading-relaxed text-mute">{t.footer.service}</p>
        </aside>
        <Card>
          <RequestForm lang={lang} t={{ form: t.form, ui: t.ui, request: t.request, selector: t.selector }} countries={countryOptions(lang)} />
        </Card>
      </section>
    </Shell>
  );
}
