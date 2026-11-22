/**
 * Mercury Accounts Receivable (https://docs.mercury.com/reference/accounts_receivable): the safe way clients pay
 * Kuchimoto LLC. Each invoice gets Mercury's own hosted pay page; with useRealAccountNumber: false that page shows
 * virtual account numbers, never the real checking account. Bank account and routing numbers never appear in this
 * code, on the site or in our emails.
 *
 * Env on Vercel, never printed:
 *  - MERCURY_API_TOKEN: a read-write API token ("secret-token:mercury_production_..."). Mercury only accepts
 *    read-write tokens from allowlisted IP addresses: the server sending invoices needs a fixed IP on that list.
 *  - MERCURY_DESTINATION_ACCOUNT_ID: the id (uuid) of the checking account invoices pay into, from GET /accounts.
 *  - MERCURY_API_URL (optional): https://api-sandbox.mercury.com/api/v1 to try everything against the sandbox.
 *  - MERCURY_PAY_URL_TEMPLATE (optional): the pay page address with "{slug}", once confirmed from a real invoice.
 *    Mercury does not document it, so it is never guessed; Mercury emails the pay link to the client either way.
 *
 * Facts from Mercury's docs (read 22 Nov 2026): amounts in dollars (2400.00 = $2,400); dates YYYY-MM-DD; the virtual
 * account belongs to the Mercury customer (shared by that customer's invoices); a reused invoiceNumber is refused,
 * which is what stops a double click from billing twice; there is no idempotency key.
 */
import "server-only";

const BASE = () => (process.env.MERCURY_API_URL ?? "https://api.mercury.com/api/v1").replace(/\/$/, "");

export const mercuryConfigured = () => Boolean(process.env.MERCURY_API_TOKEN && process.env.MERCURY_DESTINATION_ACCOUNT_ID);

export class MercuryError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MercuryError";
  }
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const token = process.env.MERCURY_API_TOKEN;
  if (!token) throw new MercuryError("MERCURY_API_TOKEN is not set", 0);
  const bearer = token.startsWith("secret-token:") ? token : `secret-token:${token}`;
  const response = await fetch(`${BASE()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${bearer}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  if (!response.ok) throw new MercuryError(`Mercury ${method} ${path} answered ${response.status}: ${text.slice(0, 300)}`, response.status);
  return (text ? JSON.parse(text) : {}) as T;
}

// ------------------------------------------------------------------ customers

/** A billing address the way Mercury wants it: region is the state code for the US ("TX"), country ISO alpha-2. */
export type MercuryAddress = { name: string; address1: string; address2?: string | null; city: string; region: string; postalCode: string; country: string };
export type MercuryCustomer = { id: string; name: string; email: string; address: MercuryAddress | null; deletedAt: string | null };

/** Every customer (Mercury has no search by email). */
export async function listCustomers(): Promise<MercuryCustomer[]> {
  const all: MercuryCustomer[] = [];
  let after: string | null = null;
  for (let page = 0; page < 20; page++) {
    const qs: string = after ? `?limit=1000&start_after=${encodeURIComponent(after)}` : "?limit=1000";
    const res: { customers?: MercuryCustomer[]; page?: { nextPage?: string | null } } = await call("GET", `/ar/customers${qs}`);
    all.push(...(res.customers ?? []));
    after = res.page?.nextPage ?? null;
    if (!after || !res.customers?.length) break;
  }
  return all;
}

export async function createCustomer(input: { name: string; email: string; address?: MercuryAddress | null }): Promise<MercuryCustomer> {
  return call("POST", "/ar/customers", { name: input.name.slice(0, 5000), email: input.email, address: input.address ?? null });
}

/** The customer with this email (not deleted), or a new one. One customer per client keeps one virtual account per client. */
export async function findOrCreateCustomer(input: { name: string; email: string; address?: MercuryAddress | null }): Promise<MercuryCustomer> {
  const email = input.email.toLowerCase();
  const found = (await listCustomers()).find((c) => !c.deletedAt && c.email.toLowerCase() === email);
  return found ?? createCustomer(input);
}

// ------------------------------------------------------------------ invoices

export type MercuryInvoice = {
  id: string;
  status: "Unpaid" | "Paid" | "Cancelled" | "Processing";
  slug: string;
  amount: number;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  customerId: string;
  createdAt: string;
};

export type NewInvoice = {
  customerId: string;
  /** Unique per invoice: Mercury refuses a number it has seen, so a double click never bills twice. */
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  lineItems: { name: string; unitPrice: number; quantity: number }[];
  /** Copies of Mercury's invoice email (our team). */
  ccEmails?: string[];
  /** Shown to the client on the invoice. */
  payerMemo?: string;
  /** Seen only by us in Mercury. */
  internalNote?: string;
  poNumber?: string;
  servicePeriodStartDate?: string;
  /** True: Mercury emails the client the invoice with its pay link now. */
  send?: boolean;
  /** Lets the client authorize an ACH debit on the pay page, besides pushing ACH or wire to the virtual account. */
  achDebit?: boolean;
};

const cut = (v: string | undefined, max: number) => (v ? v.slice(0, max) : null);

export async function createInvoice(input: NewInvoice): Promise<MercuryInvoice> {
  const destinationAccountId = process.env.MERCURY_DESTINATION_ACCOUNT_ID;
  if (!destinationAccountId) throw new MercuryError("MERCURY_DESTINATION_ACCOUNT_ID is not set", 0);
  return call("POST", "/ar/invoices", {
    customerId: input.customerId,
    destinationAccountId,
    invoiceNumber: input.invoiceNumber.slice(0, 299),
    invoiceDate: input.invoiceDate,
    dueDate: input.dueDate,
    currencyCode: "USD",
    lineItems: input.lineItems.map((item) => ({ name: item.name.slice(0, 299), unitPrice: Math.round(item.unitPrice * 100) / 100, quantity: item.quantity })),
    ccEmails: input.ccEmails ?? [],
    payerMemo: cut(input.payerMemo, 5000),
    internalNote: cut(input.internalNote, 5000),
    poNumber: cut(input.poNumber, 299),
    servicePeriodStartDate: input.servicePeriodStartDate ?? null,
    sendEmailOption: input.send === false ? "DontSend" : "SendNow",
    // Never card on this business (nothing is charged by card), never the real account number on the pay page.
    creditCardEnabled: false,
    achDebitEnabled: input.achDebit ?? true,
    useRealAccountNumber: false,
  });
}

export const getInvoice = (id: string) => call<MercuryInvoice>("GET", `/ar/invoices/${encodeURIComponent(id)}`);

/** Unpaid invoices only; cannot be undone. */
export const cancelInvoice = (id: string) => call<Record<string, never>>("POST", `/ar/invoices/${encodeURIComponent(id)}/cancel`);

/** The hosted pay page, only when MERCURY_PAY_URL_TEMPLATE is set (e.g. copied from a real invoice email). */
export function payPageUrl(slug: string): string | null {
  const template = process.env.MERCURY_PAY_URL_TEMPLATE;
  return template?.includes("{slug}") && slug ? template.replace("{slug}", encodeURIComponent(slug)) : null;
}

// ------------------------------------------------------------------ dates

/** "2026-11-22" plus n days, in UTC. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const today = () => new Date().toISOString().slice(0, 10);
