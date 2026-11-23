/**
 * Three short emails to an employer whose vacancy we have seen posted (22 Nov 2026; rewritten 23 Nov 2026 after three
 * reviews of the November campaign, decided by Rockefeller's letters and Musk's interviews). A posting shows the role
 * exists, not that its budget is approved, so the emails ask whether it is still open and never assume a budget;
 * funding is confirmed with the hiring manager before the lead can be Qualified Vacancy (pipeline.ts EMPLOYER_GATES).
 * The site never sends them: the admin shows each one filled in for the lead, and a person reads it, signs it with
 * their own name, sends it from their own mailbox and logs it as sent, naming who approved it. Until Samuel approves
 * these words (EMPLOYER_TEMPLATES=approved in Vercel) they are drafts: shown for review only, with no mail button and
 * nothing can be logged as sent.
 *
 * Rules (Samuel, 23 Nov 2026):
 * - One offer and one question: direct hire for the role they posted; is it still open, and which license and shift
 *   (Rockefeller, letter 31: purpose is everything; Musk, Everyday Astronaut 2021: delete the part, then simplify).
 * - No amount before they answer (Rockefeller, letter 22: never mention the amount first). Until then the money line is
 *   "You pay only if you hire someone we introduce". Never "free" (letter 13). When the terms are stated, they are
 *   stated exactly as approved, conditions included.
 * - No links in the first email or the follow-up: ittsuiworks.com is a new domain and plain replies build its standing
 *   (Musk, Dwarkesh Patel 2026: fix the limiting factor; Rockefeller, letter 26: patience). The terms email carries
 *   one link, to /deal.
 * - Signed by the person who sends it, first and last name, never "team" (Rockefeller, letter 38).
 * - No candidate counts. No "Re:" typed into a subject: the follow-up and the terms go as real replies in the same
 *   thread. Every email says it is a solicitation, gives the postal address and how to stop (CAN-SPAM).
 * Values: {first} {company} {role} {a_role} {city} {people} {deal} {sender}
 */
import "server-only";
import { SITE_URL } from "./site";

export const employerTemplatesApproved = () => process.env.EMPLOYER_TEMPLATES === "approved";

/** Where the sender's own name goes. The admin fills it in the browser, from the name the sender types. */
export const SENDER_TOKEN = "{sender}";

export const EMPLOYER_TEMPLATES = {
  first: {
    label: "Vacancy, first email",
    note: "One person at a time, on a weekday morning their time.",
    subject: "{role} in {city}",
    lines: [
      "Hi {first},",
      "",
      "I saw {company} is hiring {a_role} in {city}.",
      "",
      "Ittsui Works recruits {people} for direct hire. You pay only if you hire someone we introduce.",
      "",
      "Is the role still open? If so, reply with the license and shift it needs, and I will start the search.",
    ],
  },
  followup: {
    label: "Vacancy, follow-up (4 business days later, no reply)",
    note: "Send it as a reply to your first email (open that email in Sent, then Reply), so both stay in one thread.",
    subject: "{role} in {city}",
    lines: [
      "Hi {first},",
      "",
      "Is the {role} role in {city} still open? If so, reply with the license and shift it needs, and I will start the search.",
    ],
  },
  terms: {
    label: "Vacancy, terms (only after they reply)",
    note: "Only after they answer. Send it as your reply in their thread, and answer any question they asked first.",
    subject: "{role} in {city}",
    lines: [
      "Hi {first},",
      "",
      "Thank you. Here are our terms for the {role} role:",
      "",
      // The fee and guarantee exactly as the approved terms state them, conditions included (Samuel, 22 Nov 2026).
      "Fee: 25% of first-year base pay, owed only if you hire someone we introduce.",
      "Replacement: if the hire leaves within 90 days of starting, we provide a replacement at no extra fee, provided the invoice was paid within 15 days (not for layoffs or a changed role).",
      "Candidates: we introduce someone only after checking their identity, work history and the licenses the role needs, and only with their consent.",
      "",
      "The full terms: {deal}",
      "",
      "To begin, reply with the pay range and the start date you have in mind.",
    ],
  },
} as const;
export type EmployerTemplateId = keyof typeof EMPLOYER_TEMPLATES;
export const isEmployerTemplate = (v: string): v is EmployerTemplateId => v in EMPLOYER_TEMPLATES;

const FOOTER = [
  "",
  SENDER_TOKEN,
  "Ittsui Works",
  "--",
  "A business solicitation from Kuchimoto LLC, operator of Ittsui Works, 30 N Gould St, Ste R, Sheridan, WY 82801, USA. Reply STOP and we will not write again.",
];

/** Who we recruit, by the lead's first trade, in the words a hiring manager uses. */
const TRADE_PEOPLE: Record<string, string> = {
  hvac: "commercial HVAC technicians",
  electrical: "commercial electricians",
  datacenter: "data center technicians",
  marine: "marine technicians",
};

type Lead = { company: string; name: string; email: string; place: string; trades: string[]; data: Record<string, string>; checks: Record<string, string> };

/** The posting link recorded for the vacancy ("2026-11-22: https://..."), or null. */
export function vacancyUrl(checks: Record<string, string>): string | null {
  const m = checks.vacancy?.match(/https?:\/\/\S+/);
  return m ? m[0] : null;
}

/** "Miami, FL" -> "Miami": the city as a hiring manager says it, without the state. */
export const cityOf = (place: string) => place.split(",")[0].trim();

/**
 * The email for one lead, filled in except for the sender's name ({sender}), or why it cannot be written yet. The
 * posting link is required although the email does not quote it: no posting, no email.
 */
export function renderEmployerEmail(id: EmployerTemplateId, lead: Lead): { subject: string; text: string } | { missing: string } {
  if (!vacancyUrl(lead.checks)) return { missing: "Record where the vacancy is posted first (the employer's careers page or job post)." };
  if (!lead.email) return { missing: "No email on this lead: add one (call first if they gave only a phone)." };
  const role = lead.data.Role?.trim();
  if (!role) return { missing: "No role title: add it when you record the posting." };
  const city = cityOf(lead.place || "");
  if (!city) return { missing: "No city on this lead: add the city where the role is based." };
  const values: Record<string, string> = {
    first: lead.name.trim().split(/\s+/)[0] || "there",
    company: lead.company || "your company",
    role,
    a_role: `${/^[aeiou]/i.test(role) ? "an" : "a"} ${role}`,
    city,
    people: TRADE_PEOPLE[lead.trades[0] ?? ""] ?? "commercial technicians",
    deal: `${SITE_URL}/deal`,
  };
  const fillIn = (s: string) => s.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
  const t = EMPLOYER_TEMPLATES[id];
  return { subject: fillIn(t.subject), text: [...t.lines, ...FOOTER].map(fillIn).join("\n") };
}
