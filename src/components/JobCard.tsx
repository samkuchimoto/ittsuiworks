import type { Dict } from "@/content";
import { countryName } from "@/lib/countries";
import { dateText, payText } from "@/lib/format";
import { pathFor, type Locale } from "@/lib/site";

export type CardJob = {
  id: string;
  title: string;
  trade: string;
  employment: string;
  country: string;
  city: string;
  pay_min: string | number | null;
  pay_max: string | number | null;
  pay_currency: string;
  pay_unit: string;
  published_at: string | Date | null;
  sponsored_until: string | Date | null;
  company_name?: string;
};

/** One job in a list: title, employer, place, pay, trade. Works on the server and in the browser. */
export function JobCard({ job, lang, t }: { job: CardJob; lang: Locale; t: Dict["ui"] }) {
  const featured = job.sponsored_until !== null && new Date(job.sponsored_until) > new Date();
  const pay = payText({ ...job, pay_min: job.pay_min === null ? null : String(job.pay_min), pay_max: job.pay_max === null ? null : String(job.pay_max) }, t, lang);
  return (
    <a
      href={pathFor(lang, `/jobs/${job.id}`)}
      className={`group flex h-full flex-col rounded-2xl bg-white p-6 ring-1 transition hover:-translate-y-0.5 hover:shadow-[0_30px_60px_-40px_rgb(15_39_71/0.6)] ${featured ? "ring-2 ring-amber" : "ring-navy/10 hover:ring-navy/30"}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] font-bold uppercase tracking-[0.12em]">
        <span className="text-orange">{t.tradeShort[job.trade as keyof Dict["ui"]["tradeShort"]] ?? job.trade}</span>
        <span className="text-line" aria-hidden="true">/</span>
        <span className="text-mute">{t.employment[job.employment as keyof Dict["ui"]["employment"]] ?? job.employment}</span>
        {featured && <span className="ml-auto rounded-full bg-amber/15 px-2.5 py-1 text-[11.5px] text-orange-deep">{t.featured}</span>}
      </div>
      <h3 className="font-display mt-3 text-[23px] leading-snug text-navy group-hover:underline group-hover:underline-offset-4">{job.title}</h3>
      {job.company_name && <p className="mt-1 text-[15px] font-semibold text-ink/85">{job.company_name}</p>}
      <p className="mt-1 text-[15px] text-mute">
        {job.city}, {countryName(job.country, lang)}
      </p>
      <div className="mt-auto flex items-end justify-between gap-3 pt-5">
        <p className="text-[15px] font-semibold text-navy">{pay || t.payNotListed}</p>
        {job.published_at && <p className="shrink-0 text-[13px] text-mute">{t.posted.replace("{date}", dateText(job.published_at, lang))}</p>}
      </div>
    </a>
  );
}
