import type { ReactNode } from "react";
import { certList, headline, type PublicPartner } from "@/lib/partners";
import { ArrowIcon } from "./Icons";

/** The header of the English-only technician pages (no language switch: there is no Japanese version, US hires only). */
export function TechHead({ label, title, intro, children }: { label: string; title: string; intro?: string; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-sky">
      <div aria-hidden="true" className="blueprint absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black_35%,transparent_80%)]" />
      <div className="relative mx-auto max-w-[1280px] px-4 pb-14 pt-14 sm:px-8 lg:pb-20 lg:pt-20">
        <div className="max-w-[860px]">
          <p className="text-[12.5px] font-bold uppercase tracking-[0.16em] text-orange">{label}</p>
          <h1 className="font-display mt-4 text-[38px] leading-[1.08] text-navy sm:text-[50px] lg:text-[60px]">{title}</h1>
          {intro && <p className="mt-5 max-w-[42rem] text-[17.5px] leading-relaxed text-ink/80">{intro}</p>}
          {children}
        </div>
      </div>
    </section>
  );
}

/** One anonymous profile: ID, trade, place, certifications as stated. Never a name, photo or contact. */
export function TechnicianCard({ partner, action }: { partner: PublicPartner; action?: boolean }) {
  const certs = certList(partner.certs);
  return (
    <article className="flex flex-col rounded-2xl bg-white p-6 shadow-[0_30px_60px_-42px_rgb(15_39_71/0.55)] ring-1 ring-navy/10">
      <p className="font-mono text-[13px] font-semibold tracking-wide text-mute">{partner.id}</p>
      <h2 className="font-display mt-2 text-[26px] leading-tight text-navy">{headline(partner)}</h2>
      {certs.length > 0 ? (
        <>
          <ul className="mt-4 flex flex-wrap gap-2">
            {certs.map((c) => (
              <li key={c} className="rounded-full bg-sky px-3 py-1 text-[13px] font-semibold text-navy ring-1 ring-navy/10">
                {c}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12.5px] text-mute">As stated by the technician. Checked before any introduction.</p>
        </>
      ) : (
        <p className="mt-4 text-[14px] text-mute">Certifications: ask us.</p>
      )}
      {action && (
        <a
          href={`/technicians/${partner.id}`}
          className="group mt-6 inline-flex items-center justify-center gap-2 self-start rounded-md bg-orange px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-orange-deep"
        >
          Request this technician
          <ArrowIcon className="size-4 transition group-hover:translate-x-0.5" />
        </a>
      )}
    </article>
  );
}
