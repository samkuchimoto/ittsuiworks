/**
 * The deal page (/deal, English only: US clients), its order form and its emails, from one source so the terms a
 * client reads, confirms and receives by email are the same words. "**text**" marks bold on the page; emails drop it.
 * Samuel, 22 Nov 2026. Change TERMS_VERSION whenever a term changes: each order keeps the version and text it confirmed.
 */
export const TERMS_VERSION = "2026-11-22";

export type DealRow = { label: string; text: string; deal?: boolean; list?: string[]; after?: string };
export type DealCard = { key: "hire" | "project"; tag: string; badge: string; big: string; sub: string; rows: DealRow[] };

const CARDS: DealCard[] = [
    {
      key: "hire",
      tag: "Direct-Hire Technician Placement",
      badge: "US hires",
      big: "25%",
      sub: "of first-year base pay, only if you hire",
      // Card copy tightened about 25% (Samuel, 22 Nov 2026). The full terms a client confirms are TERMS below, unchanged.
      rows: [
        { label: "Who it is for", text: "US employers hiring commercial HVAC, electrical, data center or marine technicians." },
        { label: "The value", text: "Identity, work history and licenses checked, with consent, before anyone reaches your calendar." },
        { label: "The deal", text: "**$0** upfront or to submit a role. **25% of first-year base pay**, only if you hire a candidate we introduce.", deal: true },
        {
          label: "Guarantee & term",
          text: "**90-day free replacement** if the hire leaves, valid when the invoice is paid within **15 days** (not for layoffs or changed roles).",
        },
      ],
    },
    {
      key: "project",
      tag: "Commercial Project Sourcing",
      badge: "$10k to $250k+",
      big: "8% to 12%",
      sub: "paid by the licensed trade partner, on paid milestones",
      rows: [
        { label: "Who it is for", text: "Facility owners and GCs with commercial scopes, and licensed, insured trade partners taking subcontracts." },
        {
          label: "The value",
          text: "Every project passes 3 hard gates:",
          list: ["Power secured or not needed", "Budget approved", "Start date set"],
          after: "Partners' state license and insurance are verified first; they contract directly with the client.",
        },
        {
          label: "The deal",
          text: "**$0** for owners and GCs to submit an RFP. Licensed partners pay an **8% to 12%** commission, agreed in writing, only on paid milestones (subject to state licensing rules).",
          deal: true,
        },
      ],
    },
];

export const DEAL = {
  eyebrow: "THE DEAL — WALK IN OR WALK OUT",
  title: "Verified Critical-Infrastructure Talent & Commercial Projects. Paid Strictly on Results.",
  intro:
    "Commercial HVAC, commercial electrical, data center, and marine trades. Zero upfront retainer. Zero charge on this website. Every fee is agreed in writing before the first introduction.",
  cards: CARDS,
  pay: {
    label: "How you pay",
    title: "Three steps. Nothing is charged here.",
    steps: [
      { title: "Place an order", text: "Click **Place an Order** and verify your official business billing details." },
      { title: "Confirm in writing", text: "Receive your pre-filled 1-page written fee agreement (plus Kuchimoto LLC W-9) to confirm before our first introduction." },
      {
        title: "Pay on results",
        text: "Pay via **safe Mercury US ACH/Wire link** to **Kuchimoto LLC**: Net 15 from hire start, or Net 7 from cleared project milestone.",
      },
    ],
  },
  cta: "Place an Order",
  /**
   * The lighter first step beside the order button (22 Nov 2026): an employer who only wants to talk about a vacancy
   * sends the role, with no billing details; the formal order comes once terms are agreed.
   */
  requestFirst: { before: "Not ready to order?", link: "Start with a technician request", after: "no billing details needed." },
  /** The outlined header button on every English page (not on /deal itself). */
  see: "See the Deal",
  formTitle: "Official Business Order & Verification",
  formIntro: "Takes about two minutes. We check every order by hand before anything is released.",
  binding:
    "I confirm I am authorized to bind the company listed above to the exact Ittsui Works deal terms shown on this page, and understand no candidate identities or project contacts are released until written confirmation.",
  // "Operated by Kuchimoto LLC" dropped here (Samuel, 22 Nov 2026): the site footer already says it.
  trust: "Bank transfers settle via Mercury (Column N.A., Member FDIC) using unique virtual account links issued strictly per verified order.",
  safety: "Ittsui Works never sends bank account numbers by email. Pay only through the Mercury link that quotes your order reference.",
  /** Public record (Wyoming Secretary of State), so a client can check who they pay before paying. */
  verify: { text: "Check us on the Wyoming Secretary of State registry: Kuchimoto LLC, filing ID 2026-002122100.", link: "https://wyobiz.wyo.gov/Business/FilingSearch.aspx" },
} as const;

export const ORDER_TYPES = {
  hire: "Direct-Hire Technician Request",
  project: "Commercial Project / Trade Partner",
} as const;

export const PROJECT_SIDES = {
  owner: "Facility owner or GC submitting a scope",
  partner: "Licensed trade partner taking subcontracts",
} as const;

/** The three kinds of order, each with its own terms and its own place in the admin pipeline. */
export type DealKind = "hire" | "project_owner" | "project_partner";
export const DEAL_KINDS: readonly DealKind[] = ["hire", "project_owner", "project_partner"];

export const KIND_LABEL: Record<DealKind, string> = {
  hire: "Direct-Hire Technician Request",
  project_owner: "Commercial Project (facility owner / GC)",
  project_partner: "Trade Partner (licensed subcontractor)",
};

/** The exact terms a client confirms for each kind of order, as shown above the binding box and in the emails. */
export const TERMS: Record<DealKind, string[]> = {
  hire: [
    "**$0** upfront and **$0** to submit a role.",
    "**25% of First-Year Base Pay**, payable only if you hire a candidate we introduce.",
    "**90-day free replacement** if the hire leaves within 90 days of starting, strictly valid when the invoice is paid within **15 days** (excludes layoffs or changed roles).",
    "Payment: **Net 15 from the hire's start date**, by US bank transfer (ACH or wire) to Kuchimoto LLC through a hosted Mercury payment link issued for this order.",
  ],
  project_owner: [
    "**$0** to submit an RFP. Ittsui Works charges facility owners and GCs nothing.",
    "Your project passes 3 gates before matching: power secured or not needed, budget approved, start date set.",
    "Every trade partner's state license and insurance are verified before matching; the partner contracts directly with you.",
  ],
  project_partner: [
    "**$0** to join and **$0** upfront.",
    "**8% to 12%** brokerage/referral commission (the exact rate agreed in writing first), strictly on secured, paid project milestones (subject to state licensing rules).",
    "Your state license and insurance are verified before matching; you contract directly with the client.",
    "Payment: **Net 7 from each cleared milestone**, by US bank transfer (ACH or wire) to Kuchimoto LLC through a hosted Mercury payment link issued for this order.",
  ],
};

/** "**25%** of pay" -> "25% of pay", for emails and the stored terms. */
export const plain = (text: string) => text.replace(/\*\*/g, "");
