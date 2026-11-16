import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Shell } from "@/components/Shell";
import { TechHead, TechnicianCard } from "@/components/TechnicianCards";
import { getDictionary } from "@/content";
import { hasDatabase } from "@/lib/db";
import { TRADE_LABEL, activeStates, listActive, type PublicPartner } from "@/lib/partners";
import { SITE_URL } from "@/lib/site";

const DESCRIPTION = "Anonymous profiles of HVAC technicians and electricians who confirmed their own profile with Ittsui Works. US hires only. Ask for one, and we contact the technician first.";

export async function generateMetadata({ params }: PageProps<"/[lang]/technicians">): Promise<Metadata> {
  const { lang } = await params;
  if (lang !== "en") return {};
  return { title: "Technician profiles | Ittsui Works", description: DESCRIPTION, alternates: { canonical: `${SITE_URL}/technicians` } };
}

/**
 * The technician directory (Samuel, 17 November 2026: "list all active partners, hide their names"). Only profiles
 * whose owners confirmed them; no name, photo or contact. English only: placement is for US hires.
 */
export default async function Technicians({ params, searchParams }: PageProps<"/[lang]/technicians">) {
  const { lang } = await params;
  if (lang !== "en") notFound();
  await connection();
  const sp = await searchParams;
  const trade = typeof sp.trade === "string" && TRADE_LABEL[sp.trade] ? sp.trade : "";
  const state = typeof sp.state === "string" && /^[A-Z]{2}$/.test(sp.state) ? sp.state : "";
  const [partners, states]: [PublicPartner[], string[]] = hasDatabase() ? await Promise.all([listActive({ trade, state }), activeStates()]) : [[], []];
  const t = getDictionary("en");
  const select = "field w-auto py-2.5 text-[15px]";
  return (
    <Shell lang="en" t={t}>
      <TechHead
        label="Technician profiles"
        title="Technicians who confirmed their profile"
        intro="HVAC technicians and electricians in the US who confirmed their own profile with us. Names and contact details stay private. Ask for a technician and we contact them first."
      />
      <section className="mx-auto max-w-[1280px] px-4 py-12 sm:px-8 lg:py-16">
        <form method="get" action="/technicians" className="flex flex-wrap items-end gap-3">
          <label className="text-[14px] font-semibold text-navy">
            Trade
            <select name="trade" defaultValue={trade} className={`${select} mt-1.5 block`}>
              <option value="">All trades</option>
              {Object.entries(TRADE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[14px] font-semibold text-navy">
            State
            <select name="state" defaultValue={state} className={`${select} mt-1.5 block`}>
              <option value="">All states</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-md bg-navy px-5 py-2.5 text-[15px] font-semibold text-white">Show</button>
          <p className="ml-auto text-[14.5px] text-mute">
            {partners.length} profile{partners.length === 1 ? "" : "s"}
          </p>
        </form>

        {partners.length === 0 ? (
          <div className="mt-10 rounded-2xl bg-mist p-8">
            <p className="font-display text-[26px] text-navy">No profiles listed{trade || state ? " for this filter" : " yet"}.</p>
            <p className="mt-3 max-w-[40rem] text-[16px] leading-relaxed text-ink/80">
              Technicians appear here once they confirm their own profile. You can still send us the role:{" "}
              <a href="/request" className="font-semibold text-navy underline underline-offset-4">
                request technicians
              </a>
              .
            </p>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {partners.map((p) => (
              <TechnicianCard key={p.id} partner={p} action />
            ))}
          </div>
        )}

        <p className="mt-12 max-w-[52rem] text-[14.5px] leading-relaxed text-mute">
          Profiles are anonymous: no names, photos or contact details. Certifications are as stated by each technician; we check license,
          identity and work history before any introduction, and a technician is introduced only after they say yes and the terms are agreed
          in writing. US hires only. Ittsui Works is a private personnel service.
        </p>
      </section>
    </Shell>
  );
}
