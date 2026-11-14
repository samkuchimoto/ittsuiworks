import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDictionary } from "@/content";
import { JobForm } from "@/components/Forms";
import { CheckIcon } from "@/components/Icons";
import { Card, PageHead, Shell } from "@/components/Shell";
import { JAPAN_SEEKER_DATA } from "@/lib/config";
import { countryOptions } from "@/lib/countries";
import { companyByToken } from "@/lib/market";
import { alternates } from "@/lib/seo";
import { isLocale } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/post-job">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang);
  return { title: t.meta.postJobTitle, description: t.meta.postJobDescription, alternates: alternates(lang, "/post-job") };
}

export default async function PostJob({ params, searchParams }: PageProps<"/[lang]/post-job">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await connection();
  const t = getDictionary(lang);
  const token = String((await searchParams).account ?? "");
  // From the account page: the company is known and confirmed, so the job goes live at once.
  const company = token ? await companyByToken(token) : null;
  const account = company?.status === "active" ? { token: company.token, name: company.name, email: company.email, country: company.country } : undefined;

  return (
    <Shell lang={lang} t={t} current="/post-job">
      <PageHead lang={lang} t={t} path="/post-job" label={t.postJob.label} title={t.postJob.title} intro={t.postJob.intro}>
        <ul className="mt-7 flex flex-wrap gap-x-7 gap-y-3">
          {t.postJob.points.map((point) => (
            <li key={point} className="flex items-center gap-2.5 text-[15.5px] font-semibold text-navy">
              <span className="grid size-7 place-items-center rounded-full bg-white text-navy ring-1 ring-navy/10">
                <CheckIcon className="size-4" />
              </span>
              {point}
            </li>
          ))}
        </ul>
      </PageHead>
      <section className="mx-auto max-w-[920px] px-4 py-12 sm:px-8 lg:py-16">
        <Card>
          {account && <p className="mb-6 text-[15.5px] font-semibold text-navy">{account.name}</p>}
          <JobForm lang={lang} t={{ form: t.form, ui: t.ui, postJob: t.postJob }} countries={countryOptions(lang)} account={account} japanDirect={!JAPAN_SEEKER_DATA} />
        </Card>
      </section>
    </Shell>
  );
}
