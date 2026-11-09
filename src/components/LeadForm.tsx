"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { Dict } from "@/content";
import { COUNTRIES, INDUSTRIES, NEEDS, TRADES } from "@/lib/forms";
import type { Locale } from "@/lib/site";
import { ArrowIcon, CheckIcon } from "./Icons";

type Status = "idle" | "sending" | "sent" | "failed" | "invalid" | "busy";

/** One form, two entrances: companies book a consultation, technicians send a profile. Both go to /api/contact. */
export function LeadForm({ kind, lang, t, privacyHref }: { kind: "company" | "technician"; lang: Locale; t: Dict["form"]; privacyHref: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [invalid, setInvalid] = useState<string[]>([]);
  const id = (name: string) => `${kind}-${name}`;
  const bad = (name: string) => (invalid.includes(name) ? true : undefined);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setInvalid([]);
    try {
      const response = await fetch("/api/contact", { method: "POST", body: new FormData(event.currentTarget) });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; fields?: string[] };
      if (result.ok) return setStatus("sent");
      if (result.error === "invalid") {
        setInvalid(result.fields ?? []);
        return setStatus("invalid");
      }
      setStatus(result.error === "rate_limited" ? "busy" : "failed");
    } catch {
      setStatus("failed");
    }
  }

  if (status === "sent") {
    return (
      <div role="status" className="flex flex-col items-start gap-4 py-6">
        <span className="grid size-12 place-items-center rounded-full bg-navy text-white">
          <CheckIcon className="size-6" />
        </span>
        <p className="font-display text-[26px] leading-tight text-navy">{kind === "company" ? t.sentCompany : t.sentTechnician}</p>
      </div>
    );
  }

  const company = kind === "company";
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="lang" value={lang} />
      {/* People never see this field; bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {company && (
        <Field id={id("company")} label={t.company} wide>
          <input id={id("company")} name="company" required maxLength={120} autoComplete="organization" className="field" aria-invalid={bad("company")} />
        </Field>
      )}
      <Field id={id("name")} label={t.name}>
        <input id={id("name")} name="name" required maxLength={100} autoComplete="name" className="field" aria-invalid={bad("name")} />
      </Field>
      <Field id={id("email")} label={company ? t.email : t.techEmail}>
        <input id={id("email")} name="email" type="email" required maxLength={120} autoComplete="email" className="field" aria-invalid={bad("email")} />
      </Field>
      <Field id={id("country")} label={t.country}>
        <select id={id("country")} name="country" required defaultValue={lang === "ja" ? "jp" : ""} className="field" aria-invalid={bad("country")}>
          <option value="" disabled>
            {t.select}
          </option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {t.countries[c]}
            </option>
          ))}
        </select>
      </Field>
      {company ? (
        <Field id={id("industry")} label={t.industry}>
          <select id={id("industry")} name="industry" required defaultValue="" className="field" aria-invalid={bad("industry")}>
            <option value="" disabled>
              {t.select}
            </option>
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>
                {t.industries[i]}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <Field id={id("trade")} label={t.trade}>
          <select id={id("trade")} name="trade" required defaultValue="" className="field" aria-invalid={bad("trade")}>
            <option value="" disabled>
              {t.select}
            </option>
            {TRADES.map((i) => (
              <option key={i} value={i}>
                {t.trades[i]}
              </option>
            ))}
          </select>
        </Field>
      )}
      {company && (
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-[14px] font-semibold text-navy">{t.need}</legend>
          <div className="flex flex-wrap gap-2" aria-invalid={bad("need")}>
            {NEEDS.map((n, i) => (
              <label key={n} className="cursor-pointer">
                <input type="radio" name="need" value={n} defaultChecked={i === 2} className="peer sr-only" />
                <span className="inline-flex rounded-full border border-line px-4 py-2 text-[14.5px] text-ink transition peer-checked:border-navy peer-checked:bg-navy peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-orange">
                  {t.needs[n]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <Field id={id("message")} label={company ? t.message : t.details} wide>
        <textarea
          id={id("message")}
          name="message"
          rows={4}
          maxLength={2000}
          required={!company}
          placeholder={company ? t.messageHint : t.detailsHint}
          className="field resize-y placeholder:text-mute/70"
          aria-invalid={bad("message")}
        />
      </Field>

      <label className="flex items-start gap-3 text-[14.5px] text-ink sm:col-span-2">
        <input type="checkbox" name="consent" value="yes" required className="mt-1 size-4 accent-navy" aria-invalid={bad("consent")} />
        <span>
          {t.consentBefore}
          <a href={privacyHref} className="font-semibold text-navy underline underline-offset-2">
            {t.consentLink}
          </a>
          {t.consentAfter}
        </span>
      </label>

      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={status === "sending"}
          className="group inline-flex items-center justify-center gap-3 rounded-md bg-orange px-7 py-4 text-[16px] font-semibold text-white shadow-[0_10px_30px_-12px_rgb(200_70_27/0.7)] transition hover:bg-orange-deep disabled:opacity-70"
        >
          {status === "sending" ? t.sending : company ? t.sendCompany : t.sendTechnician}
          <ArrowIcon className="size-4 transition group-hover:translate-x-0.5" />
        </button>
        <p aria-live="polite" className="text-[14.5px] font-medium text-orange-deep">
          {status === "invalid" ? t.invalid : status === "failed" ? t.failed : status === "busy" ? t.busy : ""}
        </p>
      </div>
    </form>
  );
}

function Field({ id, label, wide, children }: { id: string; label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label htmlFor={id} className="mb-1.5 block text-[14px] font-semibold text-navy">
        {label}
      </label>
      {children}
    </div>
  );
}
