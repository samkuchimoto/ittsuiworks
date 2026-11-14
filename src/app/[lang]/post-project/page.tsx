import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/content";
import { ProjectForm } from "@/components/Forms";
import { Card, PageHead, Shell } from "@/components/Shell";
import { countryOptions } from "@/lib/countries";
import { alternates } from "@/lib/seo";
import { isLocale } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/post-project">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang);
  return { title: t.meta.postProjectTitle, description: t.meta.postProjectDescription, alternates: alternates(lang, "/post-project") };
}

export default async function PostProject({ params }: PageProps<"/[lang]/post-project">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  return (
    <Shell lang={lang} t={t} current="/post-project">
      <PageHead lang={lang} t={t} path="/post-project" label={t.postProject.label} title={t.postProject.title} intro={t.postProject.intro} />
      <section className="mx-auto grid max-w-[1280px] gap-10 px-4 py-12 sm:px-8 lg:grid-cols-[1fr_2fr] lg:gap-14 lg:py-16">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl bg-navy p-8 text-white">
            <p className="font-display text-[26px] leading-tight">{t.postProject.checksTitle}</p>
            <ol className="mt-6 space-y-4">
              {t.postProject.checks.map((check, i) => (
                <li key={check} className="flex gap-3 text-[16px] leading-relaxed">
                  <span className="font-display grid size-8 shrink-0 place-items-center rounded-full bg-orange text-[16px]">{i + 1}</span>
                  {check}
                </li>
              ))}
            </ol>
            <p className="mt-6 border-t border-white/15 pt-5 text-[14.5px] leading-relaxed text-white/75">{t.postProject.checksText}</p>
          </div>
        </aside>
        <Card>
          <ProjectForm lang={lang} t={{ form: t.form, ui: t.ui, postProject: t.postProject }} countries={countryOptions(lang)} />
        </Card>
      </section>
    </Shell>
  );
}
