/**
 * Where a lead came from (22 Nov 2026): the outbound link's utm_source, utm_medium and utm_campaign, and the website
 * that sent the visitor (its host name only). Nothing about the person: no cookie, no id, no full URL. The browser
 * keeps it for the tab's session only (sessionStorage), so a visitor who opens a campaign link, reads /deal and then
 * sends the request form still carries the campaign; the server cleans every value again before saving it.
 * Shared by the browser (capture, attach to forms) and the server (clean, links).
 */
import { campaignById, type Campaign } from "./config";
import { SITE_URL } from "./site";

export const ATTRIBUTION_KEYS = ["source", "medium", "campaign", "referrer"] as const;
export type Attribution = Partial<Record<(typeof ATTRIBUTION_KEYS)[number], string>>;

const STORE = "iw_attribution";
/** Lowercase letters, digits, dot, dash, underscore; 48 characters at most (utm values like "miami-electrical"). */
const SLUG = /^[a-z0-9][a-z0-9._-]{0,47}$/;
const HOST = /^(?=.{3,100}$)[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** Keeps only well-formed values; anything else is dropped, never repaired into something we did not receive. */
export function cleanAttribution(raw: Partial<Record<string, unknown>>): Attribution {
  const out: Attribution = {};
  for (const key of ["source", "medium", "campaign"] as const) {
    const v = typeof raw[key] === "string" ? (raw[key] as string).trim().toLowerCase() : "";
    if (SLUG.test(v)) out[key] = v;
  }
  const host = typeof raw.referrer === "string" ? raw.referrer.trim().toLowerCase().replace(/^www\./, "") : "";
  if (HOST.test(host) && !host.endsWith("ittsuiworks.com")) out.referrer = host;
  return out;
}

/** The form fields a submission carries it in (read by readAttribution on the server). */
export const attributionField = (key: (typeof ATTRIBUTION_KEYS)[number]) => `attr_${key}`;

export function readAttribution(form: FormData): Attribution {
  return cleanAttribution(Object.fromEntries(ATTRIBUTION_KEYS.map((k) => [k, form.get(attributionField(k))])));
}

// ------------------------------------------------------------------ browser

/**
 * Runs on every page load. A link with utm_source or utm_campaign replaces what the tab had (the latest outreach
 * wins); otherwise the first outside website that sent the visitor is kept. Storage can be off: then nothing is kept.
 */
export function captureAttribution(): void {
  try {
    const q = new URLSearchParams(window.location.search);
    const stored = storedAttribution();
    let referrer = stored.referrer;
    if (!referrer && document.referrer) {
      const host = new URL(document.referrer).hostname;
      if (host !== window.location.hostname) referrer = host;
    }
    const fromLink = q.get("utm_source") || q.get("utm_campaign");
    const next = fromLink
      ? cleanAttribution({ source: q.get("utm_source"), medium: q.get("utm_medium"), campaign: q.get("utm_campaign"), referrer })
      : cleanAttribution({ ...stored, referrer });
    window.sessionStorage.setItem(STORE, JSON.stringify(next));
  } catch {
    // Private mode or storage blocked: the form still works, without attribution.
  }
}

export function storedAttribution(): Attribution {
  try {
    return cleanAttribution(JSON.parse(window.sessionStorage.getItem(STORE) ?? "{}") as Record<string, unknown>);
  } catch {
    return {};
  }
}

/** Adds the tab's attribution to a form submission (useSubmit in components/Forms.tsx). */
export function attachAttribution(body: FormData): void {
  for (const [key, value] of Object.entries(storedAttribution())) if (value) body.set(attributionField(key as keyof Attribution), value);
}

// ------------------------------------------------------------------ links

/** The campaign's outbound link: the request form with its trade and hub chosen, and the campaign named. */
export function campaignLink(campaign: Campaign | string, source = "email"): string {
  const c = typeof campaign === "string" ? (campaignById(campaign) ?? { id: campaign, label: campaign }) : campaign;
  const q = new URLSearchParams();
  if (c.trade) q.set("trade", c.trade);
  if (c.hub) q.set("hub", c.hub);
  q.set("utm_source", source);
  q.set("utm_medium", "outbound");
  q.set("utm_campaign", c.id);
  return `${SITE_URL}/request?${q}`;
}
