import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/content";
import { LegalPage } from "@/components/Legal";
import { alternates } from "@/lib/seo";
import { isLocale } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/terms">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang);
  return { title: t.meta.termsTitle, description: t.terms.sections[1].p.slice(0, 155), alternates: alternates(lang, "/terms") };
}

export default async function Terms({ params }: PageProps<"/[lang]/terms">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  return <LegalPage lang={lang} t={t} path="/terms" doc={t.terms} />;
}
