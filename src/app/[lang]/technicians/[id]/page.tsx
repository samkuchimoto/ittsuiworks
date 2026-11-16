import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PartnerRequestForm } from "@/components/PartnerForms";
import { Card, Shell } from "@/components/Shell";
import { TechHead, TechnicianCard } from "@/components/TechnicianCards";
import { getDictionary } from "@/content";
import { hasDatabase } from "@/lib/db";
import { getPartner, headline, isPartnerId } from "@/lib/partners";
import { SITE_URL } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/technicians/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  if (lang !== "en" || !isPartnerId(id)) return {};
  return { title: `Technician ${id} | Ittsui Works`, alternates: { canonical: `${SITE_URL}/technicians/${id}` } };
}

/** One anonymous profile and the client's request for it (Samuel, 17 November 2026). */
export default async function TechnicianPage({ params }: PageProps<"/[lang]/technicians/[id]">) {
  const { lang, id } = await params;
  if (lang !== "en" || !isPartnerId(id)) notFound();
  await connection();
  const partner = hasDatabase() ? await getPartner(id) : null;
  if (!partner || partner.status !== "active") notFound();
  const t = getDictionary("en");
  return (
    <Shell lang="en" t={t}>
      <TechHead label={`Technician ${partner.id}`} title={headline(partner)} intro="Tell us about the role. We contact the technician first and reply to you by email." />
      <section className="mx-auto grid max-w-[1280px] gap-8 px-4 py-12 sm:px-8 lg:grid-cols-[1fr_2fr] lg:py-16">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <TechnicianCard partner={partner} />
          <p className="mt-6 text-[14.5px] leading-relaxed text-mute">
            No fee to send a request. A technician is introduced only after they say yes and the terms are agreed in writing.{" "}
            <a href="/technicians" className="font-semibold text-navy underline underline-offset-4">
              All profiles
            </a>
          </p>
        </aside>
        <Card>
          <h2 className="font-display text-[26px] text-navy">Request this technician</h2>
          <div className="mt-6">
            <PartnerRequestForm id={partner.id} form={t.form} />
          </div>
        </Card>
      </section>
    </Shell>
  );
}
