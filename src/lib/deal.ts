/**
 * Deal orders from /deal (Samuel, 22 Nov 2026): a US client confirms the exact terms on the page and gives official
 * billing details. Each order is stored with its reference (IW-YYYYMMDD-XXXX), the terms it confirmed, the IP and
 * browser it came from and the reasons it needs a person's review; it also lands in the sales pipeline (admin) and
 * both sides get an email. Nothing is charged and nobody is introduced from here: a person verifies the company,
 * sends the 1-page written agreement and the W-9, and only on a result does the admin send a Mercury invoice.
 */
import "server-only";
import { randomInt } from "node:crypto";
import { DEAL, KIND_LABEL, TERMS, TERMS_VERSION, plain, type DealKind } from "@/content/deal";
import { countryName, isCountry } from "./countries";
import { query } from "./db";
import { EMAIL as EMAIL_SYNTAX, reader } from "./guard";
import { trySendMail } from "./mail";
import { addDays, createInvoice, findOrCreateCustomer, mercuryConfigured, payPageUrl, today, type MercuryInvoice } from "./mercury";
import { addEvent, createInquiry, type Kind } from "./pipeline";
import { EMAIL as CONTACT } from "./site";

export type DealAddress = { street: string; city: string; state: string; postal: string; country: string };
export type DealScope = { role: string; place: string; start: string };

export type DealOrderInput = {
  kind: DealKind;
  scope: DealScope;
  company: string;
  signerName: string;
  signerTitle: string;
  email: string;
  phone: string;
  address: DealAddress;
  website: string;
  ein: string;
  poNumber: string;
};

export type StoredInvoice = { id: string; number: string; amount: number; status: string; slug: string; dueDate: string; createdAt: string; basis: string };

export type DealOrder = {
  reference: string;
  created_at: Date;
  kind: DealKind;
  scope: DealScope;
  company: string;
  signer_name: string;
  signer_title: string;
  email: string;
  phone: string;
  address: DealAddress;
  website: string;
  ein: string;
  po_number: string;
  terms_version: string;
  terms_text: string;
  ip: string;
  user_agent: string;
  needs_manual_review: boolean;
  review_reasons: string[];
  status: string;
  inquiry_id: string | null;
  client_emailed: boolean;
  mercury_customer_id: string | null;
  mercury_invoices: StoredInvoice[];
};

// ------------------------------------------------------------------ reading the form

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const US_STATES = new Set(
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA PR RI SC SD TN TX UT VT VA WA WV WI WY GU VI AS MP".split(" "),
);

/** The order as typed, or the names of the fields to fix. */
export function parseDealOrder(form: FormData): { order: DealOrderInput } | { invalid: string[] } {
  const r = reader(form);
  const invalid: string[] = [];
  const need = <T,>(name: string, value: T, ok: boolean) => {
    if (!ok) invalid.push(name);
    return value;
  };
  const length = (name: string, max: number, min = 2) => {
    const value = r.text(name, max);
    return need(name, value, value.length >= min);
  };

  const type = need("type", r.oneOf("type", ["hire", "project"] as const), Boolean(r.oneOf("type", ["hire", "project"] as const)));
  const side = r.oneOf("side", ["owner", "partner"] as const);
  if (type === "project" && !side) invalid.push("side");
  const kind: DealKind = type === "project" ? (side === "partner" ? "project_partner" : "project_owner") : "hire";

  const start = r.text("start", 10);
  const now = Date.now();
  const startOk = DATE.test(start) && !Number.isNaN(Date.parse(start)) && Date.parse(start) > now - 31 * 864e5 && Date.parse(start) < now + 3 * 365 * 864e5;
  need("start", start, startOk);

  const country = r.text("country", 2).toUpperCase();
  need("country", country, isCountry(country));
  const us = country === "US";
  const state = r.text("state", 60);
  const stateCode = us ? state.toUpperCase() : state;
  need("state", stateCode, us ? US_STATES.has(stateCode) : stateCode.length >= 2);
  const postal = r.text("postal", 20).toUpperCase();
  need("postal", postal, us ? /^\d{5}(-\d{4})?$/.test(postal) : postal.length >= 2);

  const phone = r.text("phone", 40);
  need("phone", phone, phone.replace(/\D/g, "").length >= 7 && /^[\d\s()+.\-]+$/.test(phone));
  const email = r.email("email");
  need("email", email, Boolean(email) && EMAIL_SYNTAX.test(email ?? ""));
  const website = r.website("website");
  need("website", website, Boolean(website));
  if (form.get("bind") !== "yes") invalid.push("bind");

  const order: DealOrderInput = {
    kind,
    scope: { role: length("role", 120), place: length("place", 120), start },
    company: length("company", 160),
    signerName: length("signer", 100, 3),
    signerTitle: length("title", 100),
    email: email ?? "",
    phone,
    address: { street: length("street", 200, 4), city: length("city", 100), state: stateCode, postal, country },
    website: website ?? "",
    ein: r.text("ein", 40),
    poNumber: r.text("po", 60),
  };
  return invalid.length ? { invalid: [...new Set(invalid)] } : { order };
}

// ------------------------------------------------------------------ fraud checks

/** Free webmail: a real company may use one, but an official order from one is checked by a person first. */
const WEBMAIL = new Set(
  (
    "gmail.com googlemail.com yahoo.com ymail.com rocketmail.com hotmail.com outlook.com live.com msn.com aol.com icloud.com me.com mac.com " +
    "proton.me protonmail.com pm.me gmx.com gmx.net gmx.us mail.com zoho.com zohomail.com yandex.com yandex.ru mail.ru inbox.com fastmail.com " +
    "hey.com tutanota.com tuta.io hushmail.com comcast.net att.net sbcglobal.net verizon.net cox.net charter.net bellsouth.net earthlink.net " +
    "optonline.net frontier.com windstream.net qq.com 163.com 126.com naver.com"
  ).split(" "),
);
/** Regional variants: yahoo.co.uk, hotmail.fr, outlook.jp... */
const WEBMAIL_FAMILY = /^(yahoo|hotmail|outlook|live|gmx|yandex)\.[a-z.]{2,6}$/;
const DISPOSABLE = new Set(
  "mailinator.com guerrillamail.com guerrillamail.net sharklasers.com 10minutemail.com tempmail.com temp-mail.org yopmail.com trashmail.com getnada.com dispostable.com maildrop.cc throwawaymail.com mintemail.com fakeinbox.com".split(
    " ",
  ),
);

export const isWebmail = (domain: string) => WEBMAIL.has(domain) || WEBMAIL_FAMILY.test(domain);
const bareHost = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
};
/** acme.com and mail.acme.com belong together; acme.com and acme-hvac.com do not. */
const sameOrg = (a: string, b: string) => a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);

/** Why a person must look at this order before anything else happens (empty: nothing unusual). */
export function reviewReasons(order: Pick<DealOrderInput, "email" | "website" | "address">): string[] {
  const reasons: string[] = [];
  const domain = order.email.split("@")[1] ?? "";
  if (DISPOSABLE.has(domain)) reasons.push(`disposable email domain (${domain})`);
  else if (isWebmail(domain)) reasons.push(`free webmail domain (${domain})`);
  else {
    const site = bareHost(order.website);
    if (site && !sameOrg(domain, site)) reasons.push(`email domain ${domain} differs from website ${site}`);
  }
  if (order.address.country !== "US") reasons.push(`billing address outside the US (${order.address.country})`);
  return reasons;
}

// ------------------------------------------------------------------ storing an order

const REF_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
/** IW-20261122-7KQ3: the day (UTC) and four characters that cannot be misread (no 0/O, 1/I). */
export const newReference = () => `IW-${today().replace(/-/g, "")}-${Array.from({ length: 4 }, () => REF_CHARS[randomInt(REF_CHARS.length)]).join("")}`;
export const isReference = (v: string) => /^IW-\d{8}-[2-9A-HJ-NP-Z]{4}$/.test(v);

const PIPELINE_KIND: Record<DealKind, Kind> = { hire: "talent_request", project_owner: "project", project_partner: "partner" };

export const formatAddress = (a: DealAddress) => `${a.street}, ${a.city}, ${a.state} ${a.postal}, ${countryName(a.country)}`;
const alertTo = () => process.env.ORDER_ALERT_EMAIL?.trim() || undefined;

/**
 * Stores the order, puts it in the sales pipeline and sends both emails. Returns the reference.
 * An email that fails never loses the order: it is stored first, and the inbox alert says if the client's email failed.
 */
export async function createDealOrder(order: DealOrderInput, meta: { ip: string; userAgent: string }): Promise<{ reference: string; review: string[] }> {
  const review = reviewReasons(order);
  const terms = TERMS[order.kind].map(plain);
  let reference = "";
  for (let attempt = 0; attempt < 5 && !reference; attempt++) {
    const candidate = newReference();
    const rows = await query(
      `INSERT INTO deal_orders (reference, kind, scope, company, signer_name, signer_title, email, phone, address, website, ein, po_number,
                                terms_version, terms_text, binding_text, ip, user_agent, needs_manual_review, review_reasons)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       ON CONFLICT (reference) DO NOTHING RETURNING reference`,
      [
        candidate,
        order.kind,
        JSON.stringify(order.scope),
        order.company,
        order.signerName,
        order.signerTitle,
        order.email,
        order.phone,
        JSON.stringify(order.address),
        order.website,
        order.ein,
        order.poNumber,
        TERMS_VERSION,
        terms.join("\n"),
        DEAL.binding,
        meta.ip.slice(0, 64),
        meta.userAgent.slice(0, 400),
        review.length > 0,
        review,
      ],
    );
    if (rows.length) reference = candidate;
  }
  if (!reference) throw new Error("could not allocate an order reference");

  // The sales pipeline (admin), without its own emails: this order sends its own below.
  try {
    const inquiryId = await createInquiry({
      kind: PIPELINE_KIND[order.kind],
      source: "deal",
      name: order.signerName,
      email: order.email,
      phone: order.phone,
      company: order.company,
      country: "US",
      place: order.scope.place,
      trades: [],
      lang: "en",
      consentText: DEAL.binding,
      acknowledge: false,
      notify: false,
      data: {
        "Order reference": reference,
        Order: KIND_LABEL[order.kind],
        "Role / trade": order.scope.role,
        "Target start": order.scope.start,
        Signer: `${order.signerName}, ${order.signerTitle}`,
        "Billing address": formatAddress(order.address),
        Website: order.website,
        "EIN / Tax ID": order.ein,
        "PO number": order.poNumber,
        Terms: `/deal, version ${TERMS_VERSION}`,
        "Needs manual review": review.length ? `YES: ${review.join("; ")}` : "no",
      },
    });
    await query(`UPDATE deal_orders SET inquiry_id = $2 WHERE reference = $1`, [reference, inquiryId]);
  } catch (error) {
    console.error("[deal] pipeline entry failed:", error instanceof Error ? error.message : "unknown");
  }

  const clientEmailed = await trySendMail({ to: order.email, subject: `Order ${reference} received: Ittsui Works`, lines: clientEmail(reference, order, terms) });
  if (clientEmailed) await query(`UPDATE deal_orders SET client_emailed = true WHERE reference = $1`, [reference]);
  await trySendMail({
    to: alertTo(),
    replyTo: order.email,
    subject: `${review.length ? "REVIEW " : ""}DEAL ORDER ${reference}: ${order.company}, ${KIND_LABEL[order.kind]}`.slice(0, 180),
    lines: teamEmail(reference, order, review, meta, clientEmailed),
  });
  return { reference, review };
}

function clientEmail(reference: string, order: DealOrderInput, terms: string[]): string[] {
  const next =
    order.kind === "project_owner"
      ? "Next step: a person verifies your company details, then sends you a 1-page written confirmation pre-filled with the details below. No trade partner contacts are released until you confirm it in writing."
      : "Next step: a person verifies your company details, then sends you a 1-page written fee agreement pre-filled with the details below, plus the Kuchimoto LLC W-9. No candidate identities or project contacts are released until you confirm it in writing.";
  return [
    `Hello ${order.signerName},`,
    "",
    "Thank you. Ittsui Works received your official order.",
    "",
    `Order reference: ${reference}`,
    `Company: ${order.company}`,
    `Order: ${KIND_LABEL[order.kind]}`,
    `Role / trade: ${order.scope.role}`,
    `City and state: ${order.scope.place}`,
    `Target start date: ${order.scope.start}`,
    "",
    "The terms you confirmed:",
    ...terms.map((t) => `- ${t}`),
    "",
    next,
    "",
    `Security: Ittsui Works never charges on its website and never sends bank account numbers by email. Pay only through the Mercury payment link that quotes your order reference ${reference}. If anything looks different, write to ${CONTACT} before paying.`,
    "",
    "Ittsui Works is operated by Kuchimoto LLC (Sheridan, WY).",
  ];
}

function teamEmail(reference: string, order: DealOrderInput, review: string[], meta: { ip: string; userAgent: string }, clientEmailed: boolean): string[] {
  return [
    review.length ? `NEEDS MANUAL REVIEW: ${review.join("; ")}` : "Nothing unusual found (still verify before the written agreement).",
    "",
    `Order reference: ${reference}`,
    `Order: ${KIND_LABEL[order.kind]}`,
    `Role / trade: ${order.scope.role}`,
    `City and state: ${order.scope.place}`,
    `Target start: ${order.scope.start}`,
    "",
    `Legal company name: ${order.company}`,
    `Authorized signer: ${order.signerName}, ${order.signerTitle}`,
    `Business email: ${order.email}`,
    `Phone / WhatsApp: ${order.phone}`,
    `Billing address: ${formatAddress(order.address)}`,
    `Website: ${order.website}`,
    `EIN / Tax ID: ${order.ein || "not given"}`,
    `PO number: ${order.poNumber || "not given"}`,
    "",
    `Terms confirmed: /deal version ${TERMS_VERSION}, with the binding box ticked.`,
    `IP: ${meta.ip} · Browser: ${meta.userAgent.slice(0, 160) || "unknown"}`,
    `Client confirmation email: ${clientEmailed ? "sent" : "FAILED, write to them yourself"}`,
    "",
    "Next: check the company (state registry, website, signer), then send the 1-page agreement and the W-9. On a result, send the Mercury invoice from the admin page (Deal orders).",
    "Reply to this email to answer the client directly.",
  ];
}

export async function listDealOrders(limit = 50): Promise<DealOrder[]> {
  return query<DealOrder>(`SELECT * FROM deal_orders ORDER BY created_at DESC LIMIT $1`, [limit]);
}

export async function getDealOrder(reference: string): Promise<DealOrder | null> {
  const [row] = await query<DealOrder>(`SELECT * FROM deal_orders WHERE reference = $1`, [reference]);
  return row ?? null;
}

// ------------------------------------------------------------------ getting paid (Mercury)

export const PLACEMENT_RATE = 25;
export const COMMISSION = { min: 8, max: 12 } as const;
/** Net 15 from the hire's start date; Net 7 from a cleared milestone. */
export const NET_DAYS = { hire: 15, milestone: 7 } as const;

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The one click on the day a hire starts or a milestone clears: the fee from the agreed terms, then a Mercury invoice
 * that Mercury emails to the client with its hosted pay page (virtual account numbers only). Facility owners and GCs
 * are never invoiced. Throws with a readable message when something is missing.
 */
export async function invoiceDealOrder(input: {
  reference: string;
  /** First-year base pay (hire), or the paid milestone amount (trade partner), in USD. */
  base: number;
  /** Trade partner commission in percent, 8 to 12, as agreed in writing. */
  rate?: number;
  /** The hire's start date, or the day the milestone payment cleared. */
  eventDate: string;
  send: boolean;
}): Promise<{ invoice: MercuryInvoice; amount: number; payUrl: string | null }> {
  if (!mercuryConfigured()) throw new Error("Mercury is not connected: set MERCURY_API_TOKEN and MERCURY_DESTINATION_ACCOUNT_ID.");
  const order = await getDealOrder(input.reference);
  if (!order) throw new Error(`No order ${input.reference}.`);
  if (order.kind === "project_owner") throw new Error("Facility owners and GCs pay nothing. Invoice the trade partner's order instead.");
  if (!(input.base > 0 && input.base < 1e8)) throw new Error("Enter the amount in US dollars.");
  if (!DATE.test(input.eventDate)) throw new Error("Enter the date as YYYY-MM-DD.");

  const hire = order.kind === "hire";
  const rate = hire ? PLACEMENT_RATE : (input.rate ?? Number.NaN);
  if (!hire && !(rate >= COMMISSION.min && rate <= COMMISSION.max)) throw new Error(`The commission must be ${COMMISSION.min}% to ${COMMISSION.max}%, as agreed in writing.`);
  const amount = Math.round(input.base * rate) / 100;
  const due = addDays(input.eventDate, hire ? NET_DAYS.hire : NET_DAYS.milestone);
  const dueDate = due < today() ? today() : due;
  const line = hire
    ? `Direct-hire placement fee: ${rate}% of first-year base pay of ${usd(input.base)} (order ${order.reference})`
    : `Referral commission: ${rate}% of paid milestone of ${usd(input.base)} (order ${order.reference})`;

  const customerId =
    order.mercury_customer_id ??
    (
      await findOrCreateCustomer({
        name: order.company,
        email: order.email,
        address: {
          name: order.company,
          address1: order.address.street,
          city: order.address.city,
          region: order.address.state,
          postalCode: order.address.postal,
          country: order.address.country,
        },
      })
    ).id;

  const number = `${order.reference}-${order.mercury_invoices.length + 1}`;
  const cc = (process.env.ORDER_ALERT_EMAIL ?? process.env.CONTACT_TO_EMAIL ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const invoice = await createInvoice({
    customerId,
    invoiceNumber: number,
    invoiceDate: today(),
    dueDate,
    lineItems: [{ name: line, unitPrice: amount, quantity: 1 }],
    ccEmails: cc,
    payerMemo: `Order ${order.reference}. ${hire ? "Net 15 from the hire's start date" : "Net 7 from the cleared milestone"}. ${DEAL.safety}`,
    internalNote: `deal_orders ${order.reference}: ${hire ? "hire started" : "milestone cleared"} ${input.eventDate}`,
    poNumber: order.po_number || undefined,
    servicePeriodStartDate: input.eventDate,
    send: input.send,
  });

  const stored: StoredInvoice = {
    id: invoice.id,
    number: invoice.invoiceNumber ?? number,
    amount: invoice.amount ?? amount,
    status: invoice.status ?? "Unpaid",
    slug: invoice.slug ?? "",
    dueDate: invoice.dueDate ?? dueDate,
    createdAt: new Date().toISOString(),
    basis: hire ? `hire started ${input.eventDate}` : `milestone cleared ${input.eventDate}`,
  };
  await query(`UPDATE deal_orders SET mercury_customer_id = $2, mercury_invoices = mercury_invoices || $3::jsonb, status = 'invoiced' WHERE reference = $1`, [
    order.reference,
    customerId,
    JSON.stringify([stored]),
  ]);
  if (order.inquiry_id) {
    await addEvent(order.inquiry_id, {
      kind: "note",
      text: `Mercury invoice ${stored.number}: ${usd(amount)}, due ${stored.dueDate}${input.send ? ", emailed by Mercury" : ", not emailed yet"}.`,
      amount,
    }).catch(() => undefined);
  }
  return { invoice, amount, payUrl: payPageUrl(stored.slug) };
}
