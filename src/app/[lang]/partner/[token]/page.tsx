import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PartnerConfirmForm } from "@/components/PartnerForms";
import { Card, Shell } from "@/components/Shell";
import { TechHead, TechnicianCard } from "@/components/TechnicianCards";
import { getDictionary } from "@/content";
import { hasDatabase, isToken } from "@/lib/db";
import { DIRECTORY_CONSENT, getPartnerByToken } from "@/lib/partners";
import { privatePage } from "@/lib/seo";

export const metadata: Metadata = { ...privatePage, title: "Confirm your profile | Ittsui Works" };

/**
 * The personal link an invited technician gets (sent by hand in Indeed Messages). Nothing is public until they confirm
 * here with their own details; the link works once.
 */
export default async function ConfirmProfile({ params }: PageProps<"/[lang]/partner/[token]">) {
  const { lang, token } = await params;
  if (lang !== "en" || !isToken(token)) notFound();
  await connection();
  const partner = hasDatabase() ? await getPartnerByToken(token) : null;
  if (!partner) notFound();
  const t = getDictionary("en");
  if (partner.status !== "invited")
    return (
      <Shell lang="en" t={t}>
        <TechHead label={`Profile ${partner.id}`} title="This profile is already confirmed" intro="Nothing more to do. To change a detail, reply to your confirmation email or write to contact@ittsuiworks.com." />
      </Shell>
    );
  return (
    <Shell lang="en" t={t}>
      <TechHead
        label={`Profile ${partner.id}`}
        title="Confirm your technician profile"
        intro="Commercial employers can ask for technicians on Ittsui Works. Your profile is listed without your name, photo or contact details, and we contact you before any introduction."
      />
      <section className="mx-auto grid max-w-[1280px] gap-8 px-4 py-12 sm:px-8 lg:grid-cols-[1fr_2fr] lg:py-16">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 text-[12.5px] font-bold uppercase tracking-[0.16em] text-orange">What employers will see</p>
          <TechnicianCard partner={partner} />
          <p className="mt-6 text-[14.5px] leading-relaxed text-mute">Nothing is shown until you confirm. Correct anything below that is wrong.</p>
        </aside>
        <Card>
          <PartnerConfirmForm token={token} form={t.form} consent={DIRECTORY_CONSENT} defaults={{ trade: partner.trade, city: partner.city, state: partner.state, certs: partner.certs }} />
        </Card>
      </section>
    </Shell>
  );
}
