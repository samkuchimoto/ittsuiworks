"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { DEAL, ORDER_TYPES, PROJECT_SIDES, TERMS, type DealKind } from "@/content/deal";
import { EMAIL } from "@/lib/site";
import { Done, Field, Honeypot, Select, useSubmit } from "./Forms";
import { ArrowIcon, CheckIcon } from "./Icons";
import { Rich } from "./Rich";

/**
 * The single "Place an Order" button and the inline checkout it opens (/deal). /deal#order opens it straight away,
 * so the team can send that link on a call. Bots are stopped by Vercel BotID (src/instrumentation-client.ts), which
 * shows nothing to visitors.
 */
export function DealOrder({ countries }: { countries: [string, string][] }) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  const reveal = () => {
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panel.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    panel.current?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  };
  // "#order" in the address opens the form: on arrival (/deal#order) and from the hero's Place an Order link.
  useEffect(() => {
    const fromHash = () => {
      if (window.location.hash === "#order") setOpen(true);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);
  useEffect(() => {
    if (open) reveal();
  }, [open]);

  return (
    <div className="mt-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="order"
          onClick={() => {
            if (open) reveal();
            else setOpen(true);
            window.history.replaceState(null, "", "#order");
          }}
          className="group inline-flex items-center justify-center gap-3 rounded-lg bg-orange px-8 py-4 text-[17px] font-semibold text-white shadow-[0_14px_32px_-14px_rgb(200_70_27/0.85)] transition hover:bg-orange-deep"
        >
          {DEAL.cta}
          <ArrowIcon className="size-4 transition group-hover:translate-x-0.5" />
        </button>
        <p className="text-[14.5px] text-white/70">No card, no retainer. Nothing is charged on this site.</p>
      </div>
      <div id="order" ref={panel} hidden={!open} className="mt-8 scroll-mt-24">
        {open && (
          <div className="rounded-2xl bg-white p-6 text-ink shadow-[0_40px_80px_-40px_rgb(0_0_0/0.6)] sm:p-9">
            {/* Focused by script when the form opens (screen readers land here); no ring, it is not a control. */}
            <h2 tabIndex={-1} style={{ outline: "none" }} className="font-display text-[28px] leading-tight text-navy sm:text-[34px]">
              {DEAL.formTitle}
            </h2>
            <p className="mt-2 text-[15.5px] text-mute">{DEAL.formIntro}</p>
            <div className="mt-7">
              <OrderForm countries={countries} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const PLACEHOLDER: Record<DealKind | "none", string> = {
  none: "e.g. Commercial HVAC service technician",
  hire: "e.g. Commercial HVAC service technician, night shift",
  project_owner: "e.g. Chiller replacement, 4 MW data hall",
  project_partner: "e.g. Commercial electrical, TX licensed",
};

const MESSAGE: Record<string, string> = {
  invalid: "Please check the highlighted fields.",
  bot: `Our automatic security check did not pass. Please reload the page and try again, or write to ${EMAIL}.`,
  not_configured: `Online ordering is not open yet. Write to ${EMAIL} and we send your agreement directly.`,
  rate_limited: "Too many attempts from this connection. Please wait a few minutes and try again.",
};

function OrderForm({ countries }: { countries: [string, string][] }) {
  const { status, submit, bad, result } = useSubmit("/api/deal-order");
  const [type, setType] = useState<"hire" | "project" | "">("");
  const [side, setSide] = useState<"owner" | "partner" | "">("");
  const [country, setCountry] = useState("US");

  const kind: DealKind | null = type === "hire" ? "hire" : type === "project" && side ? (side === "partner" ? "project_partner" : "project_owner") : null;

  if (status === "done") {
    return (
      <Done
        title="Order received"
        text={
          kind === "project_owner"
            ? "A confirmation with the terms you confirmed is on its way to your inbox. Next: we verify your company, then send your 1-page written confirmation. You pay nothing."
            : "A confirmation with the terms you confirmed is on its way to your inbox. Next: we verify your company, then send your 1-page written fee agreement and the Kuchimoto LLC W-9. Nothing is due until a result."
        }
      >
        {result.reference && (
          <p className="rounded-xl bg-sky px-5 py-4 text-[15px] text-navy ring-1 ring-navy/10">
            Your order reference
            <b className="mt-1 block whitespace-nowrap font-mono text-[20px] tracking-wider">{result.reference}</b>
            <span className="mt-1 block text-[14px] text-mute">Every document and payment link from us quotes it. {DEAL.safety}</span>
          </p>
        )}
      </Done>
    );
  }

  const ring = (on: true | undefined) => (on ? "rounded-xl ring-2 ring-orange/60" : "");
  const us = country === "US";

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Honeypot />

      <Legend n={1}>Your order</Legend>
      <fieldset className={`grid gap-3 sm:col-span-2 sm:grid-cols-2 ${ring(bad("type"))}`}>
        <legend className="sr-only">Order type</legend>
        <Choice name="type" value="hire" checked={type === "hire"} onChange={() => setType("hire")} title={ORDER_TYPES.hire} text="25% of first-year base pay, only if you hire." />
        <Choice
          name="type"
          value="project"
          checked={type === "project"}
          onChange={() => setType("project")}
          title={ORDER_TYPES.project}
          text="$0 for owners and GCs. Partners pay 8% to 12% on paid milestones."
        />
      </fieldset>
      {type === "project" && (
        <fieldset className={`grid gap-2 sm:col-span-2 sm:grid-cols-2 ${ring(bad("side"))}`}>
          <legend className="mb-1.5 text-[14px] font-semibold text-navy">I am a</legend>
          {(Object.entries(PROJECT_SIDES) as ["owner" | "partner", string][]).map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-[15px] ring-1 ring-line transition hover:ring-navy/40 has-[:checked]:bg-sky has-[:checked]:ring-navy">
              <input type="radio" name="side" value={value} checked={side === value} onChange={() => setSide(value)} required className="size-4 accent-navy" />
              {label}
            </label>
          ))}
        </fieldset>
      )}
      <Field id="d-role" label="Role / Trade" wide>
        <input id="d-role" name="role" required maxLength={120} placeholder={PLACEHOLDER[kind ?? "none"]} className="field placeholder:text-mute/70" aria-invalid={bad("role")} />
      </Field>
      <Field id="d-place" label="City & State">
        <input id="d-place" name="place" required maxLength={120} placeholder="e.g. Dallas, TX" className="field placeholder:text-mute/70" aria-invalid={bad("place")} />
      </Field>
      <Field id="d-start" label="Target Start Date">
        <input id="d-start" name="start" type="date" required className="field" aria-invalid={bad("start")} />
      </Field>

      <Legend n={2}>Official billing details</Legend>
      <Field id="d-company" label="Legal Company Name" wide>
        <input id="d-company" name="company" required maxLength={160} autoComplete="organization" placeholder="As registered with your state" className="field placeholder:text-mute/70" aria-invalid={bad("company")} />
      </Field>
      <Field id="d-signer" label="Authorized Signer Full Name">
        <input id="d-signer" name="signer" required maxLength={100} autoComplete="name" className="field" aria-invalid={bad("signer")} />
      </Field>
      <Field id="d-title" label="Job Title">
        <input id="d-title" name="title" required maxLength={100} autoComplete="organization-title" placeholder="e.g. Operations Director" className="field placeholder:text-mute/70" aria-invalid={bad("title")} />
      </Field>
      <Field id="d-email" label="Official Business Email">
        <input id="d-email" name="email" type="email" required maxLength={120} autoComplete="email" placeholder="you@yourcompany.com" className="field placeholder:text-mute/70" aria-invalid={bad("email")} aria-describedby="d-email-hint" />
        <span id="d-email-hint" className="mt-1.5 block text-[13px] text-mute">
          Your company domain. Free webmail orders are checked by hand first.
        </span>
      </Field>
      <Field id="d-phone" label="Direct Phone / WhatsApp">
        <input id="d-phone" name="phone" type="tel" required maxLength={40} autoComplete="tel" placeholder="+1 214 555 0100" className="field placeholder:text-mute/70" aria-invalid={bad("phone")} />
      </Field>
      <Field id="d-website" label="Company Website URL" wide>
        <input id="d-website" name="website" type="url" inputMode="url" required maxLength={200} autoComplete="url" placeholder="yourcompany.com" className="field placeholder:text-mute/70" aria-invalid={bad("website")} />
      </Field>
      <Field id="d-street" label="Registered Billing Address: Street" wide>
        <input id="d-street" name="street" required maxLength={200} autoComplete="street-address" className="field" aria-invalid={bad("street")} />
      </Field>
      <Field id="d-city" label="City">
        <input id="d-city" name="city" required maxLength={100} autoComplete="address-level2" className="field" aria-invalid={bad("city")} />
      </Field>
      <Field id="d-state" label={us ? "State (2 letters, e.g. TX)" : "State / Region"}>
        <input id="d-state" name="state" required maxLength={us ? 2 : 60} autoComplete="address-level1" className={`field ${us ? "uppercase" : ""}`} aria-invalid={bad("state")} />
      </Field>
      <Field id="d-postal" label="Postal Code">
        <input id="d-postal" name="postal" required maxLength={20} autoComplete="postal-code" inputMode={us ? "numeric" : "text"} className="field" aria-invalid={bad("postal")} />
      </Field>
      <Field id="d-country" label="Country">
        <Select id="d-country" name="country" options={countries} defaultValue="US" onChange={setCountry} bad={bad("country")} />
      </Field>
      <Field id="d-ein" label="EIN / Tax ID (optional)">
        <input id="d-ein" name="ein" maxLength={40} placeholder="12-3456789" className="field placeholder:text-mute/70" aria-invalid={bad("ein")} />
      </Field>
      <Field id="d-po" label="PO Number (optional)">
        <input id="d-po" name="po" maxLength={60} className="field" aria-invalid={bad("po")} />
      </Field>

      <Legend n={3}>Confirm</Legend>
      <div className="rounded-xl bg-sky p-5 ring-1 ring-navy/10 sm:col-span-2">
        <p className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-navy">The terms you are confirming</p>
        {kind ? (
          <ul className="mt-3 space-y-2">
            {TERMS[kind].map((term) => (
              <li key={term} className="flex gap-2.5 text-[15px] leading-relaxed text-ink/85">
                <CheckIcon className="mt-1 size-4 shrink-0 text-navy" />
                <span>
                  <Rich text={term} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[15px] text-mute">Choose your order above to see its exact terms.</p>
        )}
      </div>
      <label className={`flex items-start gap-3 p-1 text-[15px] leading-relaxed text-ink sm:col-span-2 ${ring(bad("bind"))}`}>
        <input type="checkbox" name="bind" value="yes" required className="mt-1 size-4 shrink-0 accent-navy" aria-invalid={bad("bind")} />
        <span>{DEAL.binding}</span>
      </label>
      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={status === "sending"}
          className="group inline-flex items-center justify-center gap-3 rounded-md bg-orange px-7 py-4 text-[16px] font-semibold text-white shadow-[0_10px_30px_-12px_rgb(200_70_27/0.7)] transition hover:bg-orange-deep disabled:opacity-70"
        >
          {status === "sending" ? "Sending..." : "Submit Order for Verification"}
          <ArrowIcon className="size-4 transition group-hover:translate-x-0.5" />
        </button>
        <p aria-live="polite" className="text-[14.5px] font-medium text-orange-deep">
          {status === "invalid"
            ? MESSAGE.invalid
            : status === "busy"
              ? MESSAGE.rate_limited
              : status === "failed"
                ? (MESSAGE[result.error ?? ""] ?? `Your order was not sent. Please try again, or write to ${EMAIL}.`)
                : ""}
        </p>
      </div>
      <p className="text-[13.5px] leading-relaxed text-mute sm:col-span-2">
        By submitting you also accept our{" "}
        <a href="/terms" className="font-semibold text-navy underline underline-offset-2">
          Terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="font-semibold text-navy underline underline-offset-2">
          Privacy policy
        </a>
        . We record this order with your IP address to prevent fraud.
      </p>
    </form>
  );
}

function Legend({ n, children }: { n: number; children: ReactNode }) {
  return (
    <p className="mt-2 flex items-center gap-3 border-b border-line pb-2 text-[12.5px] font-bold uppercase tracking-[0.16em] text-orange first:mt-0 sm:col-span-2">
      <span className="grid size-6 place-items-center rounded-full bg-orange text-[12px] tracking-normal text-white">{n}</span>
      {children}
    </p>
  );
}

function Choice({ name, value, checked, onChange, title, text }: { name: string; value: string; checked: boolean; onChange: () => void; title: string; text: string }) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-xl p-4 ring-1 ring-line transition hover:ring-navy/40 has-[:checked]:bg-sky has-[:checked]:ring-2 has-[:checked]:ring-navy">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} required className="mt-1 size-4 shrink-0 accent-navy" />
      <span>
        <span className="block text-[16px] font-semibold text-navy">{title}</span>
        <span className="mt-1 block text-[14px] leading-snug text-mute">{text}</span>
      </span>
    </label>
  );
}
