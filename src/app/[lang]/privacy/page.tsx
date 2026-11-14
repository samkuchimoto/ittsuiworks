import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/content";
import { LegalPage } from "@/components/Legal";
import { alternates } from "@/lib/seo";
import { isLocale } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/privacy">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang);
  return { title: t.meta.privacyTitle, alternates: alternates(lang, "/privacy") };
}

export default async function Privacy({ params }: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  return <LegalPage lang={lang} t={t} path="/privacy" doc={t.privacy} />;
}
