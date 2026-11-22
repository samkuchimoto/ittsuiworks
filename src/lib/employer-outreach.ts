/**
 * Two short emails to an employer with a verified open vacancy (22 Nov 2026). The site never sends them: the admin
 * shows each one filled in for the lead, and a person reads it, sends it from their own mailbox and logs it as sent,
 * naming who approved it. Until Samuel approves these words (EMPLOYER_TEMPLATES=approved in Vercel) they are drafts:
 * shown for review only, with no mail button and nothing can be logged as sent.
 *
 * Rules: only facts we can stand behind. No candidate count, no "verified candidates" (a candidate is verified only
 * once their checks are ticked), no "Re:" subject, the approved fee in plain words with the full terms one click
 * away, who we are with a postal address and how to stop (CAN-SPAM), one email address per send, one person at a time.
 * Values: {first} {company} {role} {a_role} {place} {where} {trade} {link} {deal}
 */
import "server-only";
import { campaignLink, type Attribution } from "./attribution";
import { CAMPAIGNS, SOURCING_TRADES, type Hub, type SourcingTrade } from "./config";
import { SITE_URL } from "./site";

export const employerTemplatesApproved = () => process.env.EMPLOYER_TEMPLATES === "approved";

export const EMPLOYER_TEMPLATES = {
  first: {
    label: "Vacancy, first email",
    subject: "{role} in {place}",
    lines: [
      "Hello {first},",
      "",
      "I saw that {company} is hiring {a_role} in {place} ({where}).",
      "",
      "Ittsui Works recruits commercial {trade} technicians for direct hire. We present a candidate only after checking their identity, work history and the licenses the role needs, and only with the candidate's consent.",
      "",
      "Our fee is 25% of first-year base pay, owed only if you hire someone we introduce, with a free replacement if the hire leaves within 90 days. Sending us the role costs nothing.",
      "",
      "If the role is still open, reply here or send the details in two minutes:",
      "{link}",
    ],
  },
  followup: {
    label: "Vacancy, follow-up (4 business days later, no reply)",
    subject: "{role} in {place}: still open?",
    lines: [
      "Hello {first},",
      "",
      "Following up on your {role} opening in {place}. If it is still open, send the role and we start sourcing today:",
      "{link}",
      "",
      "The exact terms, including the 90-day replacement: {deal}",
    ],
  },
} as const;
export type EmployerTemplateId = keyof typeof EMPLOYER_TEMPLATES;
export const isEmployerTemplate = (v: string): v is EmployerTemplateId => v in EMPLOYER_TEMPLATES;

const FOOTER = [
  "",
  "Ittsui Works recruiting team",
  "--",
  "Ittsui Works is operated by Kuchimoto LLC, 30 N Gould St, Ste R, Sheridan, WY 82801, USA. Reply STOP and we will not write again.",
];

const TRADE_WORDS: Record<string, string> = { hvac: "HVAC", electrical: "electrical", datacenter: "data center", marine: "marine" };

/** The hub a place belongs to, for the request link: Florida and Texas have their own, any other US site is "us". */
export function hubOf(place: string): Hub {
  if (/\b(FL|Fla\.?|Florida)\b/i.test(place)) return "fl";
  if (/\b(TX|Tex\.?|Texas)\b/i.test(place)) return "tx";
  return "us";
}

type Lead = { company: string; name: string; email: string; place: string; trades: string[]; data: Record<string, string>; checks: Record<string, string>; attribution: Attribution };

/** The vacancy link recorded when it was verified ("2026-11-22: https://..."), or null. */
export function vacancyUrl(checks: Record<string, string>): string | null {
  const m = checks.vacancy?.match(/https?:\/\/\S+/);
  return m ? m[0] : null;
}

/**
 * The email for one lead, filled in, or why it cannot be written yet. The link is the request form with the lead's
 * trade and hub chosen and its campaign named (the lead's own campaign, else the configured campaign for that trade
 * and hub, else "outbound-employer").
 */
export function renderEmployerEmail(id: EmployerTemplateId, lead: Lead): { subject: string; text: string } | { missing: string } {
  const url = vacancyUrl(lead.checks);
  if (!url) return { missing: "Verify the vacancy first (its link on the employer's careers page or job post)." };
  if (!lead.email) return { missing: "No email on this lead: add one (call first if they gave only a phone)." };
  const role = lead.data.Role?.trim();
  if (!role) return { missing: "No role title: add it when you verify the vacancy." };
  const trade = lead.trades[0] ?? "";
  const sourcing = (SOURCING_TRADES as readonly string[]).includes(trade) ? (trade as SourcingTrade) : undefined;
  const hub = hubOf(lead.place);
  const campaign = lead.attribution.campaign ?? CAMPAIGNS.find((c) => c.trade === trade && c.hub === hub)?.id ?? "outbound-employer";
  const known = CAMPAIGNS.find((c) => c.id === campaign);
  let where = "your job post";
  try {
    where = `posted on ${new URL(url).hostname.replace(/^www\./, "")}`;
  } catch {
    // keep the generic words
  }
  const values: Record<string, string> = {
    first: lead.name.trim().split(/\s+/)[0] || "there",
    company: lead.company || "your company",
    role,
    a_role: `${/^[aeiou]/i.test(role) ? "an" : "a"} ${role}`,
    place: lead.place || "your site",
    where,
    trade: TRADE_WORDS[trade] ?? "trade",
    link: campaignLink({ id: campaign, label: known?.label ?? campaign, trade: known?.trade ?? sourcing, hub: known?.hub ?? hub }, "email"),
    deal: `${SITE_URL}/deal`,
  };
  const fillIn = (s: string) => s.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
  const t = EMPLOYER_TEMPLATES[id];
  return { subject: fillIn(t.subject), text: [...t.lines, ...FOOTER].map(fillIn).join("\n") };
}
