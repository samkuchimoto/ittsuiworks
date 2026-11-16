"use client";

import type { Dict } from "@/content";
import { EXPERIENCE, SOURCING_TRADES } from "@/lib/config";
import { Consent, Done, Field, Honeypot, Select, Submit, useSubmit } from "./Forms";

const TRADES: [string, string][] = SOURCING_TRADES.map((k) => [k, { hvac: "HVAC technician", electrical: "Electrician", datacenter: "Data center technician", marine: "Marine technician" }[k]]);

/** The invited technician confirms the profile with their own details (/partner/<token>). */
export function PartnerConfirmForm({ token, form, consent, defaults }: { token: string; form: Dict["form"]; consent: string; defaults: { trade: string; city: string; state: string; certs: string } }) {
  const { status, submit, bad } = useSubmit("/api/partners/confirm");
  if (status === "done") return <Done title="Your profile is confirmed" text="It is now listed anonymously at ittsuiworks.com/technicians. When an employer asks for it, we contact you first. A confirmation with your private link is in your inbox." />;
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="lang" value="en" />
      <Honeypot />
      <Field id="pc-name" label="Full name (never shown publicly)">
        <input id="pc-name" name="name" required maxLength={100} autoComplete="name" className="field" aria-invalid={bad("name")} />
      </Field>
      <Field id="pc-email" label="Email (never shown publicly)">
        <input id="pc-email" name="email" type="email" required maxLength={120} autoComplete="email" className="field" aria-invalid={bad("email")} />
      </Field>
      <Field id="pc-phone" label="Phone (never shown publicly)">
        <input id="pc-phone" name="phone" type="tel" required maxLength={40} autoComplete="tel" className="field" aria-invalid={bad("phone")} />
      </Field>
      <Field id="pc-trade" label="Main trade">
        <Select id="pc-trade" name="trade" options={TRADES} defaultValue={defaults.trade} placeholder={form.select} bad={bad("trade")} />
      </Field>
      <Field id="pc-city" label="City">
        <input id="pc-city" name="city" required maxLength={80} defaultValue={defaults.city} autoComplete="address-level2" className="field" aria-invalid={bad("city")} />
      </Field>
      <Field id="pc-state" label="State (2 letters, e.g. TX)">
        <input id="pc-state" name="state" required maxLength={2} defaultValue={defaults.state} className="field uppercase" aria-invalid={bad("state")} />
      </Field>
      <Field id="pc-certs" label="Licenses and certifications (shown on your profile)" wide>
        <textarea id="pc-certs" name="certs" rows={2} maxLength={300} defaultValue={defaults.certs} placeholder="e.g. EPA 608 Universal, OSHA 30, Journeyman license" className="field resize-y placeholder:text-mute/70" aria-invalid={bad("certs")} />
      </Field>
      <Field id="pc-years" label={form.yearsCommercial}>
        <Select id="pc-years" name="years" options={EXPERIENCE.map((k) => [k, `${k} years`])} placeholder={form.select} bad={bad("years")} />
      </Field>
      <Field id="pc-rate" label={form.rate}>
        <input id="pc-rate" name="rate" required maxLength={60} placeholder={form.rateHint} className="field placeholder:text-mute/70" aria-invalid={bad("rate")} />
      </Field>
      <Field id="pc-available" label={form.available}>
        <input id="pc-available" name="available" type="date" required className="field" aria-invalid={bad("available")} />
      </Field>
      <label className="flex items-start gap-3 text-[14.5px] text-ink sm:col-span-2">
        <input type="checkbox" name="consent_directory" value="yes" required className="mt-1 size-4 accent-navy" aria-invalid={bad("consent_directory")} />
        <span>{consent}</span>
      </label>
      <Consent lang="en" t={form} bad={bad} />
      <Submit t={form} label="Confirm my profile" status={status} />
    </form>
  );
}

/** A client asks for one technician from the directory (/technicians/<id>). */
export function PartnerRequestForm({ id, form }: { id: string; form: Dict["form"] }) {
  const { status, submit, bad } = useSubmit("/api/partners/request");
  if (status === "done")
    return (
      <Done
        title="Request received"
        text={`Your request for ${id} is in. A confirmation with your reference and a private link is in your inbox. We contact the technician first; nobody is introduced before the technician says yes and the terms are agreed in writing.`}
      />
    );
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="lang" value="en" />
      <Honeypot />
      <Field id="pr-company" label={form.company}>
        <input id="pr-company" name="company" required maxLength={120} autoComplete="organization" className="field" aria-invalid={bad("company")} />
      </Field>
      <Field id="pr-name" label={form.name}>
        <input id="pr-name" name="name" required maxLength={100} autoComplete="name" className="field" aria-invalid={bad("name")} />
      </Field>
      <Field id="pr-email" label="Work email">
        <input id="pr-email" name="email" type="email" required maxLength={120} autoComplete="email" className="field" aria-invalid={bad("email")} />
      </Field>
      <Field id="pr-phone" label={form.phone}>
        <input id="pr-phone" name="phone" type="tel" maxLength={40} autoComplete="tel" className="field" aria-invalid={bad("phone")} />
      </Field>
      <Field id="pr-place" label="Site city and state">
        <input id="pr-place" name="place" required maxLength={120} placeholder="e.g. Houston, TX" className="field placeholder:text-mute/70" aria-invalid={bad("place")} />
      </Field>
      <Field id="pr-start" label={form.startDate}>
        <input id="pr-start" name="start" type="date" required className="field" aria-invalid={bad("start")} />
      </Field>
      <Field id="pr-role" label="Role" wide>
        <input id="pr-role" name="role" required maxLength={80} placeholder="e.g. Commercial HVAC service technician, night shift" className="field placeholder:text-mute/70" aria-invalid={bad("role")} />
      </Field>
      <Field id="pr-notes" label="Anything else (optional)" wide>
        <textarea id="pr-notes" name="notes" rows={3} maxLength={1000} className="field resize-y" aria-invalid={bad("notes")} />
      </Field>
      <Consent lang="en" t={form} bad={bad} />
      <Submit t={form} label="Request this technician" status={status} />
    </form>
  );
}
