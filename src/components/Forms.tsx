"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Dict } from "@/content";
import { CREW_SIZES, CURRENCIES, DURATIONS, EMPLOYMENT, ENGAGEMENTS, EXPERIENCE, HEADCOUNTS, PAY_UNITS, POWER, PROJECT_SIZES, SOURCING_TRADES, STARTS, TRADES } from "@/lib/config";
import { currencyFor } from "@/lib/countries";
import { pathFor, type Locale } from "@/lib/site";
import { ArrowIcon, CheckIcon } from "./Icons";

type Status = "idle" | "sending" | "done" | "failed" | "invalid" | "busy" | "duplicate";
type Result = { ok?: boolean; error?: string; fields?: string[]; live?: boolean; jobId?: string };

/** Posts a form to an API route and keeps its state: sending, done, which fields were refused. */
function useSubmit(endpoint: string) {
  const [status, setStatus] = useState<Status>("idle");
  const [invalid, setInvalid] = useState<string[]>([]);
  const [result, setResult] = useState<Result>({});
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setInvalid([]);
    try {
      const response = await fetch(endpoint, { method: "POST", body: new FormData(event.currentTarget) });
      const body = (await response.json().catch(() => ({}))) as Result;
      setResult(body);
      if (body.ok) return setStatus("done");
      if (body.error === "invalid") {
        setInvalid(body.fields ?? []);
        return setStatus("invalid");
      }
      setStatus(body.error === "rate_limited" ? "busy" : body.error === "duplicate" ? "duplicate" : "failed");
    } catch {
      setStatus("failed");
    }
  }
  const bad = (name: string) => (invalid.includes(name) ? true : undefined);
  return { status, submit, bad, result, invalid };
}

export function Field({ id, label, wide, children }: { id: string; label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label htmlFor={id} className="mb-1.5 block text-[14px] font-semibold text-navy">
        {label}
      </label>
      {children}
    </div>
  );
}

function Legend({ children }: { children: ReactNode }) {
  return <p className="border-b border-line pb-2 text-[12.5px] font-bold uppercase tracking-[0.16em] text-orange sm:col-span-2">{children}</p>;
}

/** People never see this field; bots fill it in. */
function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
      <label>
        Website <input name="website_url" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}

function Consent({ lang, t, bad }: { lang: Locale; t: Dict["form"]; bad: (n: string) => true | undefined }) {
  return (
    <label className="flex items-start gap-3 text-[14.5px] text-ink sm:col-span-2">
      <input type="checkbox" name="consent" value="yes" required className="mt-1 size-4 accent-navy" aria-invalid={bad("consent")} />
      <span>
        {t.consentBefore}
        <a href={pathFor(lang, "/terms")} className="font-semibold text-navy underline underline-offset-2">
          {t.terms}
        </a>
        {t.and}
        <a href={pathFor(lang, "/privacy")} className="font-semibold text-navy underline underline-offset-2">
          {t.privacy}
        </a>
        {t.consentAfter}
      </span>
    </label>
  );
}

function Submit({ t, label, status }: { t: Dict["form"]; label: string; status: Status }) {
  return (
    <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
      <button
        type="submit"
        disabled={status === "sending"}
        className="group inline-flex items-center justify-center gap-3 rounded-md bg-orange px-7 py-4 text-[16px] font-semibold text-white shadow-[0_10px_30px_-12px_rgb(200_70_27/0.7)] transition hover:bg-orange-deep disabled:opacity-70"
      >
        {status === "sending" ? t.sending : label}
        <ArrowIcon className="size-4 transition group-hover:translate-x-0.5" />
      </button>
      <p aria-live="polite" className="text-[14.5px] font-medium text-orange-deep">
        {status === "invalid" ? t.invalid : status === "failed" ? t.failed : status === "busy" ? t.busy : status === "duplicate" ? t.duplicate : ""}
      </p>
    </div>
  );
}

function Done({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div role="status" className="flex flex-col items-start gap-4 py-6">
      <span className="grid size-12 place-items-center rounded-full bg-navy text-white">
        <CheckIcon className="size-6" />
      </span>
      <p className="font-display text-[28px] leading-tight text-navy">{title}</p>
      <p className="text-[16px] leading-relaxed text-ink/80">{text}</p>
      {children}
    </div>
  );
}

function Select({ id, name, options, bad, defaultValue = "", placeholder, onChange }: { id: string; name: string; options: [string, string][]; bad?: true; defaultValue?: string; placeholder?: string; onChange?: (v: string) => void }) {
  return (
    <select id={id} name={name} required defaultValue={defaultValue} className="field" aria-invalid={bad} onChange={onChange ? (e) => onChange(e.target.value) : undefined}>
      {placeholder !== undefined && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}

const fillIn = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m);
const tradeOptions = (t: Dict["ui"]) => TRADES.map((k) => [k, t.trades[k]] as [string, string]);

// ------------------------------------------------------------------ post a job

export type JobFormText = { form: Dict["form"]; ui: Dict["ui"]; postJob: Dict["postJob"] };

export function JobForm({ lang, t, countries, account, japanDirect }: { lang: Locale; t: JobFormText; countries: [string, string][]; account?: { token: string; name: string; email: string; country: string }; japanDirect: boolean }) {
  const { status, submit, bad, result } = useSubmit("/api/jobs");
  const [country, setCountry] = useState(account?.country ?? (lang === "ja" ? "JP" : ""));
  const [currency, setCurrency] = useState(currencyFor(account?.country ?? (lang === "ja" ? "JP" : "US")));
  const [email, setEmail] = useState(account?.email ?? "");
  const f = t.form;
  const external = japanDirect && country === "JP";

  if (status === "done") {
    return result.live ? (
      <Done title={t.postJob.liveTitle} text={fillIn(t.postJob.live, { email })}>
        <a href={pathFor(lang, `/jobs/${result.jobId}`)} className="font-semibold text-navy underline underline-offset-4">
          {t.postJob.view}
        </a>
      </Done>
    ) : (
      <Done title={t.postJob.sentTitle} text={fillIn(t.postJob.sent, { email })} />
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="lang" value={lang} />
      <Honeypot />
      {account ? (
        <input type="hidden" name="account" value={account.token} />
      ) : (
        <>
          <Legend>{t.postJob.company}</Legend>
          <Field id="job-company" label={f.company}>
            <input id="job-company" name="company" required maxLength={120} autoComplete="organization" className="field" aria-invalid={bad("company")} />
          </Field>
          <Field id="job-website" label={f.website}>
            <input id="job-website" name="site" maxLength={200} inputMode="url" autoComplete="url" className="field" aria-invalid={bad("site")} />
          </Field>
          <Field id="job-name" label={f.name}>
            <input id="job-name" name="name" required maxLength={100} autoComplete="name" className="field" aria-invalid={bad("name")} />
          </Field>
          <Field id="job-email" label={f.workEmail}>
            <input id="job-email" name="email" type="email" required maxLength={120} autoComplete="email" className="field" aria-invalid={bad("email")} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </>
      )}

      <Legend>{t.postJob.job}</Legend>
      <Field id="job-title" label={f.title} wide>
        <input id="job-title" name="title" required maxLength={120} placeholder={f.titleHint} className="field placeholder:text-mute/70" aria-invalid={bad("title")} />
      </Field>
      <Field id="job-trade" label={f.trade}>
        <Select id="job-trade" name="trade" options={tradeOptions(t.ui)} placeholder={f.select} bad={bad("trade")} />
      </Field>
      <Field id="job-employment" label={f.employment}>
        <Select id="job-employment" name="employment" defaultValue="full_time" options={EMPLOYMENT.map((k) => [k, t.ui.employment[k]])} bad={bad("employment")} />
      </Field>
      <Field id="job-country" label={f.country}>
        <Select
          id="job-country"
          name="country"
          options={countries}
          placeholder={f.select}
          defaultValue={country}
          bad={bad("country")}
          onChange={(v) => {
            setCountry(v);
            setCurrency(currencyFor(v));
          }}
        />
      </Field>
      <Field id="job-city" label={f.city}>
        <input id="job-city" name="city" required maxLength={80} autoComplete="address-level2" className="field" aria-invalid={bad("city")} />
      </Field>
      <div className="grid grid-cols-2 gap-4 sm:col-span-2 sm:grid-cols-4">
        <Field id="job-pay-min" label={f.payMin}>
          <input id="job-pay-min" name="pay_min" inputMode="decimal" maxLength={12} className="field" aria-invalid={bad("pay_min")} />
        </Field>
        <Field id="job-pay-max" label={f.payMax}>
          <input id="job-pay-max" name="pay_max" inputMode="decimal" maxLength={12} className="field" aria-invalid={bad("pay_max")} />
        </Field>
        <Field id="job-currency" label={f.currency}>
          <select id="job-currency" name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="field">
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field id="job-unit" label={f.payUnit}>
          <Select id="job-unit" name="pay_unit" defaultValue="hour" options={PAY_UNITS.map((k) => [k, t.ui.payUnit[k]])} />
        </Field>
      </div>
      <Field id="job-description" label={f.description} wide>
        <textarea id="job-description" name="description" required rows={7} maxLength={6000} placeholder={f.descriptionHint} className="field resize-y placeholder:text-mute/70" aria-invalid={bad("description")} />
      </Field>
      <Field id="job-certs" label={f.certifications} wide>
        <input id="job-certs" name="certifications" maxLength={300} placeholder={f.certificationsHint} className="field placeholder:text-mute/70" />
      </Field>

      <Legend>{t.postJob.apply}</Legend>
      {external ? (
        <Field id="job-apply" label={f.applyUrl} wide>
          <input id="job-apply" name="apply_url" required maxLength={300} placeholder={f.applyUrlHint} className="field placeholder:text-mute/70" aria-invalid={bad("apply_url")} />
          <p className="mt-2 text-[13.5px] text-mute">{t.postJob.applyJapan}</p>
        </Field>
      ) : (
        <p className="text-[15px] text-ink/80 sm:col-span-2">{t.postJob.applyHere}</p>
      )}

      <Consent lang={lang} t={f} bad={bad} />
      <Submit t={f} label={t.postJob.submit} status={status} />
    </form>
  );
}

// ------------------------------------------------------------------ apply

export function ApplyForm({ lang, t, jobId, countries }: { lang: Locale; t: { form: Dict["form"]; job: Dict["job"] }; jobId: string; countries: [string, string][] }) {
  const { status, submit, bad } = useSubmit("/api/apply");
  const f = t.form;
  if (status === "done") return <Done title={t.job.applied} text={t.job.appliedText} />;
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="job" value={jobId} />
      <Honeypot />
      <Field id="apply-name" label={f.name}>
        <input id="apply-name" name="name" required maxLength={100} autoComplete="name" className="field" aria-invalid={bad("name")} />
      </Field>
      <Field id="apply-email" label={f.email}>
        <input id="apply-email" name="email" type="email" required maxLength={120} autoComplete="email" className="field" aria-invalid={bad("email")} />
      </Field>
      <Field id="apply-country" label={f.country}>
        <Select id="apply-country" name="country" options={countries} placeholder={f.select} bad={bad("country")} />
      </Field>
      <Field id="apply-years" label={f.years}>
        <Select id="apply-years" name="years" options={["0-1", "1-3", "3-5", "5-10", "10+"].map((y) => [y, y])} placeholder={f.select} bad={bad("years")} />
      </Field>
      <Field id="apply-experience" label={f.experience} wide>
        <textarea id="apply-experience" name="experience" required rows={4} maxLength={2000} placeholder={f.experienceHint} className="field resize-y placeholder:text-mute/70" aria-invalid={bad("experience")} />
      </Field>
      <Field id="apply-message" label={f.message} wide>
        <textarea id="apply-message" name="message" rows={3} maxLength={2000} className="field resize-y" />
      </Field>
      <Consent lang={lang} t={f} bad={bad} />
      <Submit t={f} label={t.job.apply} status={status} />
    </form>
  );
}

// ------------------------------------------------------------------ job alerts

export function AlertForm({ lang, t, countries, trade = "" }: { lang: Locale; t: { form: Dict["form"]; ui: Dict["ui"]; alerts: Dict["alerts"] }; countries: [string, string][]; trade?: string }) {
  const { status, submit, bad } = useSubmit("/api/alerts");
  const [email, setEmail] = useState("");
  const f = t.form;
  if (status === "done") return <Done title={t.alerts.sentTitle} text={fillIn(t.alerts.sent, { email })} />;
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="lang" value={lang} />
      <Honeypot />
      <Field id="alert-trade" label={f.trade}>
        <Select id="alert-trade" name="trade" options={tradeOptions(t.ui)} placeholder={f.select} defaultValue={trade} bad={bad("trade")} />
      </Field>
      <Field id="alert-country" label={f.country}>
        <Select id="alert-country" name="country" options={countries} placeholder={f.select} bad={bad("country")} />
      </Field>
      <Field id="alert-email" label={f.email} wide>
        <input id="alert-email" name="email" type="email" required maxLength={120} autoComplete="email" className="field" aria-invalid={bad("email")} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Consent lang={lang} t={f} bad={bad} />
      <Submit t={f} label={t.alerts.submit} status={status} />
    </form>
  );
}

// ------------------------------------------------------------------ the sourcing network (16 Nov 2026)

const FACILITIES = ["datacenter", "industrial", "commercial", "marine", "other"] as const;
const pill =
  "inline-flex rounded-full border border-line px-4 py-2 text-[14.5px] text-ink transition peer-checked:border-navy peer-checked:bg-navy peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-orange";

/** Pick one or more (checkboxes) or exactly one (radios), shown as pills. */
function Pills({ name, legend, options, multiple, bad, defaults = [] }: { name: string; legend: string; options: [string, string][]; multiple?: boolean; bad?: true; defaults?: string[] }) {
  return (
    <fieldset className="sm:col-span-2">
      <legend className="mb-2 text-[14px] font-semibold text-navy">{legend}</legend>
      <div className="flex flex-wrap gap-2" aria-invalid={bad}>
        {options.map(([value, label]) => (
          <label key={value} className="cursor-pointer">
            <input type={multiple ? "checkbox" : "radio"} name={name} value={value} required={!multiple} defaultChecked={defaults.includes(value)} className="peer sr-only" />
            <span className={pill}>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const sourcingOptions = (t: Dict["ui"]) => SOURCING_TRADES.map((k) => [k, t.sourcingTrades[k]] as [string, string]);
const sizeOptions = (t: Dict["ui"]) => PROJECT_SIZES.map((k) => [k, t.projectSizes[k]] as [string, string]);
const ynOptions = (t: Dict["ui"]): [string, string][] => [
  ["yes", t.yes],
  ["no", t.no],
];

type NetText = { form: Dict["form"]; ui: Dict["ui"] };

/**
 * What the home page's quick selector chose (16 Nov 2026): ?trade= and ?hub=, read in the browser so the form pages stay
 * static. The hub fills the country and the place; the trade is ticked. The visitor can change everything.
 */
type Preset = { trade: string; country: string; place: string } | null;
function usePreset(places: Dict["selector"]["places"]): Preset {
  const [preset, setPreset] = useState<Preset>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const trade = (SOURCING_TRADES as readonly string[]).includes(q.get("trade") ?? "") ? (q.get("trade") as string) : "";
    const hub = q.get("hub") ?? "";
    const hubs: Record<string, { country: string; place: string }> = {
      tx: { country: "US", place: places.tx },
      fl: { country: "US", place: places.fl },
      us: { country: "US", place: places.us },
      jp: { country: "JP", place: places.jp },
    };
    if (trade || hubs[hub]) setPreset({ trade, country: hubs[hub]?.country ?? "", place: hubs[hub]?.place ?? "" });
  }, [places]);
  return preset;
}

/** Two steps instead of one long form: step 1 is checked in the browser before step 2 opens; all fields post together. */
function useTwoSteps(formRef: React.RefObject<HTMLFormElement | null>, stepOne: string[], serverInvalid: string[]) {
  const [step, setStep] = useState<1 | 2>(1);
  const [missing, setMissing] = useState<string[]>([]);
  // A field of step 1 refused by the server: back to step 1.
  useEffect(() => {
    if (serverInvalid.some((f) => stepOne.includes(f))) setStep(1);
  }, [serverInvalid, stepOne]);
  const next = () => {
    const data = formRef.current ? new FormData(formRef.current) : new FormData();
    const empty = stepOne.filter((name) => !data.getAll(name).some((v) => String(v).trim() !== ""));
    setMissing(empty);
    if (empty.length === 0) {
      setStep(2);
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  return { step, setStep, next, missing };
}

function StepHead({ t, n, title }: { t: Dict["form"]; n: 1 | 2; title: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-line pb-2 sm:col-span-2">
      <span className="font-display text-[15px] text-orange">{fillIn(t.step, { n: String(n) })}</span>
      <span className="text-[12.5px] font-bold uppercase tracking-[0.16em] text-navy">{title}</span>
    </div>
  );
}

function NextButton({ t, onClick, missing }: { t: Dict["form"]; onClick: () => void; missing: boolean }) {
  return (
    <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={onClick}
        className="group inline-flex items-center justify-center gap-3 rounded-md bg-navy px-7 py-4 text-[16px] font-semibold text-white transition hover:bg-navy-deep"
      >
        {t.next}
        <ArrowIcon className="size-4 transition group-hover:translate-x-0.5" />
      </button>
      <p aria-live="polite" className="text-[14.5px] font-medium text-orange-deep">
        {missing ? t.invalid : ""}
      </p>
    </div>
  );
}

function BackButton({ t, onClick }: { t: Dict["form"]; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="justify-self-start text-[15px] font-semibold text-navy underline underline-offset-4 hover:text-orange sm:col-span-2">
      {t.back}
    </button>
  );
}

const REQUEST_STEP_ONE = ["trades", "role", "headcount", "country", "place", "start", "duration"];
const PROJECT_STEP_ONE = ["facility", "size", "trades", "country", "place", "start"];

/** Employers: a recruiting and staffing request (/request). */
export function RequestForm({ lang, t, countries }: { lang: Locale; t: NetText & { request: Dict["request"]; selector: Dict["selector"] }; countries: [string, string][] }) {
  const { status, submit, bad, invalid } = useSubmit("/api/inquiries");
  const formRef = useRef<HTMLFormElement>(null);
  const preset = usePreset(t.selector.places);
  const { step, setStep, next, missing } = useTwoSteps(formRef, REQUEST_STEP_ONE, invalid);
  const f = t.form;
  const off = (name: string) => (missing.includes(name) || bad(name) ? true : undefined);
  // Paid placement is for US hires only until the Japanese licence (Samuel, 16 Nov 2026).
  const usOnly = countries.filter(([code]) => code === "US");
  if (status === "done") return <Done title={t.request.sentTitle} text={t.request.sent} />;
  return (
    <form ref={formRef} onSubmit={submit} noValidate className="grid scroll-mt-24 gap-4 sm:grid-cols-2">
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="kind" value="talent_request" />
      <Honeypot />
      {/* Step 1: the role, where and when. Hidden fields still post with the form. */}
      <div key={preset ? "preset" : "plain"} className={step === 1 ? "contents" : "hidden"}>
        <StepHead t={f} n={1} title={t.request.role} />
        <Pills name="trades" legend={f.tradesNeeded} options={sourcingOptions(t.ui)} multiple bad={off("trades")} defaults={preset?.trade ? [preset.trade] : []} />
        <Field id="rq-role" label={f.roleTitle} wide>
          <input id="rq-role" name="role" required maxLength={80} placeholder={f.roleTitleHint} className="field placeholder:text-mute/70" aria-invalid={off("role")} />
        </Field>
        <Field id="rq-headcount" label={f.headcount}>
          <Select id="rq-headcount" name="headcount" options={HEADCOUNTS.map((k) => [k, `${k} ${t.ui.people}`])} placeholder={f.select} bad={off("headcount")} />
        </Field>
        <Field id="rq-country" label={f.country}>
          <Select id="rq-country" name="country" options={usOnly} placeholder={f.select} defaultValue="US" bad={off("country")} />
        </Field>
        <Field id="rq-place" label={f.placeState}>
          <input id="rq-place" name="place" required maxLength={120} defaultValue={preset?.country === "US" ? preset.place : ""} placeholder={f.placeStateHint} className="field placeholder:text-mute/70" aria-invalid={off("place")} />
        </Field>
        <Field id="rq-start" label={f.startDate}>
          <input id="rq-start" name="start" type="date" required className="field" aria-invalid={off("start")} />
        </Field>
        <Field id="rq-duration" label={f.duration}>
          <Select id="rq-duration" name="duration" options={DURATIONS.map((k) => [k, t.ui.durations[k]])} placeholder={f.select} bad={off("duration")} />
        </Field>
        <NextButton t={f} onClick={next} missing={missing.length > 0} />
      </div>
      {/* Step 2: the details, the company and the consent. */}
      <div className={step === 2 ? "contents" : "hidden"}>
      <StepHead t={f} n={2} title={t.request.details} />
      <Field id="rq-engagement" label={f.engagement}>
        <Select id="rq-engagement" name="engagement" options={ENGAGEMENTS.map((k) => [k, t.ui.engagements[k]])} placeholder={f.select} bad={bad("engagement")} />
      </Field>
      <Field id="rq-pay" label={f.pay}>
        <input id="rq-pay" name="pay" maxLength={80} placeholder={f.payHint} className="field placeholder:text-mute/70" />
      </Field>
      <Field id="rq-work" label={f.work} wide>
        <textarea id="rq-work" name="description" required rows={5} maxLength={4000} placeholder={f.workHint} className="field resize-y placeholder:text-mute/70" aria-invalid={bad("description")} />
      </Field>
      <Field id="rq-licenses" label={f.licensesRequired} wide>
        <input id="rq-licenses" name="licenses" maxLength={400} placeholder={f.certificationsHint} className="field placeholder:text-mute/70" />
      </Field>
      <Legend>{t.request.company}</Legend>
      <Field id="rq-company" label={f.company}>
        <input id="rq-company" name="company" required maxLength={120} autoComplete="organization" className="field" aria-invalid={bad("company")} />
      </Field>
      <Field id="rq-name" label={f.name}>
        <input id="rq-name" name="name" required maxLength={100} autoComplete="name" className="field" aria-invalid={bad("name")} />
      </Field>
      <Field id="rq-email" label={f.workEmail}>
        <input id="rq-email" name="email" type="email" required maxLength={120} autoComplete="email" className="field" aria-invalid={bad("email")} />
      </Field>
      <Field id="rq-phone" label={f.phone}>
        <input id="rq-phone" name="phone" type="tel" maxLength={40} autoComplete="tel" className="field" />
      </Field>
      <Consent lang={lang} t={f} bad={bad} />
      <Submit t={f} label={t.request.submit} status={status} />
      <BackButton t={f} onClick={() => setStep(1)} />
      </div>
    </form>
  );
}

/** Facility owners and general contractors: a commercial project for subcontractor sourcing (/post-project). */
export function CommercialProjectForm({ lang, t, countries }: { lang: Locale; t: NetText & { postProject: Dict["postProject"]; selector: Dict["selector"] }; countries: [string, string][] }) {
  const { status, submit, bad, invalid } = useSubmit("/api/inquiries");
  const formRef = useRef<HTMLFormElement>(null);
  const preset = usePreset(t.selector.places);
  const { step, setStep, next, missing } = useTwoSteps(formRef, PROJECT_STEP_ONE, invalid);
  const f = t.form;
  const off = (name: string) => (missing.includes(name) || bad(name) ? true : undefined);
  if (status === "done") return <Done title={t.postProject.sentTitle} text={t.postProject.sent} />;
  return (
    <form ref={formRef} onSubmit={submit} noValidate encType="multipart/form-data" className="grid scroll-mt-24 gap-4 sm:grid-cols-2">
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="kind" value="project" />
      <Honeypot />
      {/* Step 1: what, how big, which trades, where and when. Hidden fields still post with the form. */}
      <div key={preset ? "preset" : "plain"} className={step === 1 ? "contents" : "hidden"}>
        <StepHead t={f} n={1} title={t.postProject.project} />
        <Field id="pj-facility" label={f.facility}>
          <Select id="pj-facility" name="facility" options={FACILITIES.map((k) => [k, t.ui.facilities[k]])} placeholder={f.select} bad={off("facility")} />
        </Field>
        <Field id="pj-size" label={f.size}>
          <Select id="pj-size" name="size" options={[...sizeOptions(t.ui), ["unknown", t.ui.projectSizes.unknown]]} placeholder={f.select} bad={off("size")} />
        </Field>
        <Pills name="trades" legend={f.tradesNeeded} options={sourcingOptions(t.ui)} multiple bad={off("trades")} defaults={preset?.trade ? [preset.trade] : []} />
        <Field id="pj-country" label={f.country}>
          <Select id="pj-country" name="country" options={countries} placeholder={f.select} defaultValue={preset?.country || (lang === "ja" ? "JP" : "US")} bad={off("country")} />
        </Field>
        <Field id="pj-place" label={f.placeState}>
          <input id="pj-place" name="place" required maxLength={120} defaultValue={preset?.place ?? ""} placeholder={f.placeStateHint} className="field placeholder:text-mute/70" aria-invalid={off("place")} />
        </Field>
        <Field id="pj-start" label={f.start}>
          <Select id="pj-start" name="start" options={STARTS.map((k) => [k, t.ui.starts[k]])} placeholder={f.select} bad={off("start")} />
        </Field>
        <NextButton t={f} onClick={next} missing={missing.length > 0} />
      </div>
      {/* Step 2: the scope, readiness, the person and the consent. */}
      <div className={step === 2 ? "contents" : "hidden"}>
      <StepHead t={f} n={2} title={t.postProject.details} />
      <Field id="pj-title" label={f.projectTitle} wide>
        <input id="pj-title" name="title" required maxLength={140} placeholder={f.projectTitleHint} className="field placeholder:text-mute/70" aria-invalid={bad("title")} />
      </Field>
      <Field id="pj-scope" label={f.scope} wide>
        <textarea id="pj-scope" name="scope" required rows={6} maxLength={4000} placeholder={f.scopeHint} className="field resize-y placeholder:text-mute/70" aria-invalid={bad("scope")} />
      </Field>
      <Field id="pj-power" label={f.power}>
        <Select id="pj-power" name="power" options={POWER.map((k) => [k, t.ui.power[k]])} placeholder={f.select} bad={bad("power")} />
      </Field>
      <Pills name="budget_approved" legend={f.budgetApproved} options={ynOptions(t.ui)} bad={bad("budget_approved")} />
      <Field id="pj-qualifications" label={f.qualifications} wide>
        <input id="pj-qualifications" name="qualifications" maxLength={400} placeholder={f.qualificationsHint} className="field placeholder:text-mute/70" />
      </Field>
      <Field id="pj-documents" label={f.documents} wide>
        <input id="pj-documents" name="documents" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.heic,.doc,.docx" className="field file:mr-3 file:rounded file:border-0 file:bg-sky file:px-3 file:py-1.5 file:text-navy" aria-invalid={bad("documents")} />
        <p className="mt-1.5 text-[13px] text-mute">{f.documentsHint}</p>
      </Field>
      <Legend>{t.postProject.you}</Legend>
      <Field id="pj-company" label={f.company}>
        <input id="pj-company" name="company" required maxLength={120} autoComplete="organization" className="field" aria-invalid={bad("company")} />
      </Field>
      <Field id="pj-name" label={f.name}>
        <input id="pj-name" name="name" required maxLength={100} autoComplete="name" className="field" aria-invalid={bad("name")} />
      </Field>
      <Field id="pj-role" label={f.role}>
        <input id="pj-role" name="role" required maxLength={80} placeholder={f.roleHint} autoComplete="organization-title" className="field placeholder:text-mute/70" aria-invalid={bad("role")} />
      </Field>
      <Field id="pj-email" label={f.workEmail}>
        <input id="pj-email" name="email" type="email" required maxLength={120} autoComplete="email" className="field" aria-invalid={bad("email")} />
      </Field>
      <Field id="pj-phone" label={f.phone}>
        <input id="pj-phone" name="phone" type="tel" maxLength={40} autoComplete="tel" className="field" />
      </Field>
      <Consent lang={lang} t={f} bad={bad} />
      <Submit t={f} label={t.postProject.submit} status={status} />
      <BackButton t={f} onClick={() => setStep(1)} />
      </div>
    </form>
  );
}

/** Path A: an individual technician (/join). No Google profile or reviews asked: that rule is for companies only. */
export function TechnicianForm({ lang, t, countries }: { lang: Locale; t: NetText & { join: Dict["join"] }; countries: [string, string][] }) {
  const { status, submit, bad } = useSubmit("/api/inquiries");
  const f = t.form;
  const j = t.join.tech;
  if (status === "done") return <Done title={j.sentTitle} text={j.sent} />;
  return (
    <form onSubmit={submit} noValidate encType="multipart/form-data" className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="kind" value="technician" />
      <Honeypot />
      <Field id="tc-name" label={f.name}>
        <input id="tc-name" name="name" required maxLength={100} autoComplete="name" className="field" aria-invalid={bad("name")} />
      </Field>
      <Field id="tc-email" label={f.email}>
        <input id="tc-email" name="email" type="email" required maxLength={120} autoComplete="email" className="field" aria-invalid={bad("email")} />
      </Field>
      <Field id="tc-phone" label={f.phoneWhatsApp}>
        <input id="tc-phone" name="phone" type="tel" required maxLength={40} autoComplete="tel" className="field" aria-invalid={bad("phone")} />
      </Field>
      <Field id="tc-country" label={f.country}>
        <Select id="tc-country" name="country" options={countries} placeholder={f.select} defaultValue="US" bad={bad("country")} />
      </Field>
      <Field id="tc-place" label={f.placeState} wide>
        <input id="tc-place" name="place" required maxLength={120} placeholder={f.placeStateHint} autoComplete="address-level2" className="field placeholder:text-mute/70" aria-invalid={bad("place")} />
      </Field>
      <Pills name="trade" legend={f.primaryTrade} options={sourcingOptions(t.ui)} bad={bad("trade")} />
      <Field id="tc-licenses" label={f.licensesHeld} wide>
        <textarea id="tc-licenses" name="licenses" required rows={3} maxLength={600} placeholder={f.licensesHeldHint} className="field resize-y placeholder:text-mute/70" aria-invalid={bad("licenses")} />
      </Field>
      <Field id="tc-years" label={f.yearsCommercial}>
        <Select id="tc-years" name="years" options={EXPERIENCE.map((k) => [k, `${k} ${t.ui.yearsSuffix}`])} placeholder={f.select} bad={bad("years")} />
      </Field>
      <Field id="tc-rate" label={f.rate}>
        <input id="tc-rate" name="rate" required maxLength={60} placeholder={f.rateHint} className="field placeholder:text-mute/70" aria-invalid={bad("rate")} />
      </Field>
      <Field id="tc-available" label={f.available}>
        <input id="tc-available" name="available" type="date" required className="field" aria-invalid={bad("available")} />
      </Field>
      <Field id="tc-file" label={f.file}>
        <input id="tc-file" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.doc,.docx" className="field file:mr-3 file:rounded file:border-0 file:bg-sky file:px-3 file:py-1.5 file:text-navy" aria-invalid={bad("file")} />
        <p className="mt-1.5 text-[13px] text-mute">{f.fileHint}</p>
      </Field>
      <label className="flex items-start gap-3 text-[14.5px] text-ink sm:col-span-2">
        <input type="checkbox" name="consent_profile" value="yes" required className="mt-1 size-4 accent-navy" aria-invalid={bad("consent_profile")} />
        <span>{j.consentProfile}</span>
      </label>
      <Consent lang={lang} t={f} bad={bad} />
      <Submit t={f} label={j.submit} status={status} />
    </form>
  );
}

/** Path B: a licensed subcontractor or trade company (/join#partner). */
export function PartnerForm({ lang, t, countries }: { lang: Locale; t: NetText & { join: Dict["join"] }; countries: [string, string][] }) {
  const { status, submit, bad } = useSubmit("/api/inquiries");
  const f = t.form;
  const j = t.join.partner;
  if (status === "done") return <Done title={j.sentTitle} text={j.sent} />;
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="kind" value="partner" />
      <Honeypot />
      <Field id="pt-company" label={f.companyName}>
        <input id="pt-company" name="company" required maxLength={120} autoComplete="organization" className="field" aria-invalid={bad("company")} />
      </Field>
      <Field id="pt-name" label={f.contactName}>
        <input id="pt-name" name="name" required maxLength={100} autoComplete="name" className="field" aria-invalid={bad("name")} />
      </Field>
      <Field id="pt-email" label={f.workEmail}>
        <input id="pt-email" name="email" type="email" required maxLength={120} autoComplete="email" className="field" aria-invalid={bad("email")} />
      </Field>
      <Field id="pt-phone" label={f.phoneRequired}>
        <input id="pt-phone" name="phone" type="tel" required maxLength={40} autoComplete="tel" className="field" aria-invalid={bad("phone")} />
      </Field>
      <Field id="pt-country" label={f.country}>
        <Select id="pt-country" name="country" options={countries} placeholder={f.select} defaultValue={lang === "ja" ? "JP" : "US"} bad={bad("country")} />
      </Field>
      <Field id="pt-license" label={f.stateLicense}>
        <input id="pt-license" name="license" required maxLength={80} className="field" aria-invalid={bad("license")} />
      </Field>
      <Pills name="insurance" legend={f.insurance} options={ynOptions(t.ui)} bad={bad("insurance")} />
      <Field id="pt-insurance-details" label={f.insuranceDetails} wide>
        <input id="pt-insurance-details" name="insurance_details" maxLength={200} placeholder={f.insuranceDetailsHint} className="field placeholder:text-mute/70" />
      </Field>
      <Field id="pt-crew" label={f.crew}>
        <Select id="pt-crew" name="crew" options={CREW_SIZES.map((k) => [k, k])} placeholder={f.select} bad={bad("crew")} />
      </Field>
      <Field id="pt-size" label={f.typicalSize}>
        <Select id="pt-size" name="size" options={sizeOptions(t.ui)} placeholder={f.select} bad={bad("size")} />
      </Field>
      <Pills name="trades" legend={f.coreTrades} options={sourcingOptions(t.ui)} multiple bad={bad("trades")} />
      <Field id="pt-areas" label={f.areas} wide>
        <input id="pt-areas" name="areas" required maxLength={300} placeholder={f.areasHint} className="field placeholder:text-mute/70" aria-invalid={bad("areas")} />
      </Field>
      <Consent lang={lang} t={f} bad={bad} />
      <Submit t={f} label={j.submit} status={status} />
    </form>
  );
}
