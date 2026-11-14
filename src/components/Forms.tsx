"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { Dict } from "@/content";
import { BUDGETS, CURRENCIES, EMPLOYMENT, PAY_UNITS, POWER, STARTS, TRADES } from "@/lib/config";
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
  return { status, submit, bad, result };
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

// ------------------------------------------------------------------ post a project

export function ProjectForm({ lang, t, countries }: { lang: Locale; t: { form: Dict["form"]; ui: Dict["ui"]; postProject: Dict["postProject"] }; countries: [string, string][] }) {
  const { status, submit, bad } = useSubmit("/api/projects");
  const [email, setEmail] = useState("");
  const f = t.form;
  if (status === "done") return <Done title={t.postProject.sentTitle} text={fillIn(t.postProject.sent, { email })} />;
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="lang" value={lang} />
      <Honeypot />
      <Legend>{t.postProject.project}</Legend>
      <Field id="project-trade" label={f.trade}>
        <Select id="project-trade" name="trade" options={tradeOptions(t.ui)} placeholder={f.select} bad={bad("trade")} />
      </Field>
      <Field id="project-budget" label={f.budget}>
        <Select id="project-budget" name="budget" options={BUDGETS.map((k) => [k, t.ui.budgets[k]])} placeholder={f.select} bad={bad("budget")} />
      </Field>
      <Field id="project-title" label={f.projectTitle} wide>
        <input id="project-title" name="title" required maxLength={140} placeholder={f.projectTitleHint} className="field placeholder:text-mute/70" aria-invalid={bad("title")} />
      </Field>
      <Field id="project-scope" label={f.scope} wide>
        <textarea id="project-scope" name="scope" required rows={6} maxLength={4000} placeholder={f.scopeHint} className="field resize-y placeholder:text-mute/70" aria-invalid={bad("scope")} />
      </Field>
      <Field id="project-country" label={f.country}>
        <Select id="project-country" name="country" options={countries} placeholder={f.select} defaultValue={lang === "ja" ? "JP" : ""} bad={bad("country")} />
      </Field>
      <Field id="project-city" label={f.city}>
        <input id="project-city" name="city" required maxLength={80} className="field" aria-invalid={bad("city")} />
      </Field>
      <Field id="project-start" label={f.start}>
        <Select id="project-start" name="start" options={STARTS.map((k) => [k, t.ui.starts[k]])} placeholder={f.select} bad={bad("start")} />
      </Field>
      <Field id="project-power" label={f.power}>
        <Select id="project-power" name="power" options={POWER.map((k) => [k, t.ui.power[k]])} placeholder={f.select} bad={bad("power")} />
      </Field>
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-[14px] font-semibold text-navy">{f.budgetApproved}</legend>
        <div className="flex flex-wrap gap-2" aria-invalid={bad("budget_approved")}>
          {[
            ["yes", t.ui.yes],
            ["no", t.ui.no],
          ].map(([value, label]) => (
            <label key={value} className="cursor-pointer">
              <input type="radio" name="budget_approved" value={value} required className="peer sr-only" />
              <span className="inline-flex rounded-full border border-line px-5 py-2 text-[14.5px] text-ink transition peer-checked:border-navy peer-checked:bg-navy peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-orange">
                {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Legend>{t.postProject.you}</Legend>
      <Field id="project-name" label={f.name}>
        <input id="project-name" name="name" required maxLength={100} autoComplete="name" className="field" aria-invalid={bad("name")} />
      </Field>
      <Field id="project-role" label={f.role}>
        <input id="project-role" name="role" required maxLength={80} placeholder={f.roleHint} autoComplete="organization-title" className="field placeholder:text-mute/70" aria-invalid={bad("role")} />
      </Field>
      <Field id="project-company" label={f.company}>
        <input id="project-company" name="company" required maxLength={120} autoComplete="organization" className="field" aria-invalid={bad("company")} />
      </Field>
      <Field id="project-email" label={f.workEmail}>
        <input id="project-email" name="email" type="email" required maxLength={120} autoComplete="email" className="field" aria-invalid={bad("email")} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field id="project-phone" label={f.phone}>
        <input id="project-phone" name="phone" type="tel" maxLength={40} autoComplete="tel" className="field" />
      </Field>
      <Consent lang={lang} t={f} bad={bad} />
      <Submit t={f} label={t.postProject.submit} status={status} />
    </form>
  );
}

// ------------------------------------------------------------------ company sign-up

export function CompanyForm({ lang, t, countries }: { lang: Locale; t: { form: Dict["form"]; ui: Dict["ui"]; companies: Dict["companies"] }; countries: [string, string][] }) {
  const { status, submit, bad } = useSubmit("/api/companies");
  const [email, setEmail] = useState("");
  const f = t.form;
  if (status === "done") return <Done title={t.companies.sentTitle} text={fillIn(t.companies.sent, { email })} />;
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="lang" value={lang} />
      <Honeypot />
      <Field id="co-company" label={f.company}>
        <input id="co-company" name="company" required maxLength={120} autoComplete="organization" className="field" aria-invalid={bad("company")} />
      </Field>
      <Field id="co-website" label={f.website}>
        <input id="co-website" name="site" maxLength={200} inputMode="url" autoComplete="url" className="field" aria-invalid={bad("site")} />
      </Field>
      <Field id="co-name" label={f.name}>
        <input id="co-name" name="name" required maxLength={100} autoComplete="name" className="field" aria-invalid={bad("name")} />
      </Field>
      <Field id="co-email" label={f.workEmail}>
        <input id="co-email" name="email" type="email" required maxLength={120} autoComplete="email" className="field" aria-invalid={bad("email")} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field id="co-country" label={f.country}>
        <Select id="co-country" name="country" options={countries} placeholder={f.select} defaultValue={lang === "ja" ? "JP" : ""} bad={bad("country")} />
      </Field>
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-[14px] font-semibold text-navy">{f.trades}</legend>
        <div className="flex flex-wrap gap-2" aria-invalid={bad("trades")}>
          {TRADES.map((k) => (
            <label key={k} className="cursor-pointer">
              <input type="checkbox" name="trades" value={k} className="peer sr-only" />
              <span className="inline-flex rounded-full border border-line px-4 py-2 text-[14.5px] text-ink transition peer-checked:border-navy peer-checked:bg-navy peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-orange">
                {t.ui.trades[k]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-start gap-3 text-[14.5px] text-ink sm:col-span-2">
        <input type="checkbox" name="abroad" value="yes" className="mt-1 size-4 accent-navy" />
        <span>{f.abroad}</span>
      </label>
      <Consent lang={lang} t={f} bad={bad} />
      <Submit t={f} label={t.companies.submit} status={status} />
    </form>
  );
}
