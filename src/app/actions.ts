"use server";

/** The buttons on the private pages (account, project, alerts, unsubscribe, admin). lib/market.ts does the work. */
import { redirect } from "next/navigation";
import { isAdminKey } from "@/lib/admin-key";
import { POWER, STARTS, isTrade } from "@/lib/config";
import { isToken, query } from "@/lib/db";
import { refreshJobPages } from "@/lib/job-cache";
import { closeProject, leaveAccount, setAlert, setJobStatus, setLeadSettings, updateProject } from "@/lib/market";
import { addProspects, unsubscribeProspect } from "@/lib/outreach";
import { pathFor, type Locale } from "@/lib/site";

const read = (form: FormData, key: string, max = 60) => String(form.get(key) ?? "").trim().slice(0, max);
const langOf = (form: FormData): Locale => (read(form, "lang", 5) === "ja" ? "ja" : "en");
const tokenOf = (form: FormData) => {
  const t = read(form, "token");
  return isToken(t) ? t : "";
};

export async function jobAction(form: FormData) {
  const token = tokenOf(form);
  const action = read(form, "action");
  if (token && (action === "close" || action === "renew")) await setJobStatus(token, read(form, "job", 12), action);
  redirect(pathFor(langOf(form), `/account/${token}`));
}

export async function leadSettingsAction(form: FormData) {
  const token = tokenOf(form);
  const trades = form.getAll("trades").map(String).filter(isTrade);
  if (token) await setLeadSettings(token, { leads: read(form, "leads") === "on" && trades.length > 0, trades, abroad: read(form, "abroad") === "yes" });
  redirect(pathFor(langOf(form), `/account/${token}`));
}

export async function leaveAction(form: FormData) {
  const token = tokenOf(form);
  if (token) await leaveAccount(token);
  redirect(pathFor(langOf(form), `/account/${token}`));
}

export async function projectAction(form: FormData) {
  const token = tokenOf(form);
  if (token && read(form, "action") === "close") await closeProject(token);
  else if (token) {
    const power = read(form, "power");
    const start = read(form, "start");
    if ((POWER as readonly string[]).includes(power) && (STARTS as readonly string[]).includes(start)) {
      await updateProject(token, { power, start, budget_approved: read(form, "budget_approved") === "yes" });
    }
  }
  redirect(pathFor(langOf(form), `/project/${token}`));
}

export async function alertAction(form: FormData) {
  const token = tokenOf(form);
  if (token) await setAlert(token, read(form, "action") === "on");
  redirect(pathFor(langOf(form), `/alerts/${token}`));
}

export async function unsubscribeAction(form: FormData) {
  const kind = read(form, "k");
  const token = read(form, "t", 40);
  if (kind === "alert" && isToken(token)) await setAlert(token, false);
  if (kind === "prospect") await unsubscribeProspect(token);
  redirect(`${pathFor(langOf(form), "/unsubscribe")}?done=1`);
}

// ------------------------------------------------------------------ admin (ADMIN_KEY)

/** Every admin button checks the key itself, on the server, in constant time (lib/admin-key.ts). */
const adminOk = (form: FormData) => isAdminKey(read(form, "key", 100));

/** CSV lines: company, email, website, country (2 letters), trade (hvac | datacenter | marine). */
export async function importProspectsAction(form: FormData) {
  if (!adminOk(form)) redirect("/");
  const rows = String(form.get("csv") ?? "")
    .split(/\r?\n/)
    .map((line) => line.split(",").map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 5 && !/^company$/i.test(cells[0]));
  const added = await addProspects(rows.map(([company, email, website, country, trade]) => ({ company, email, website, country: country.toUpperCase(), trade, source: "import" })));
  redirect(`/admin/${read(form, "key", 100)}?imported=${added}`);
}

export async function adminCloseJobAction(form: FormData) {
  if (!adminOk(form)) redirect("/");
  await query(`UPDATE jobs SET status = 'closed' WHERE id = $1`, [read(form, "job", 12)]);
  refreshJobPages([read(form, "job", 12)]);
  redirect(`/admin/${read(form, "key", 100)}`);
}

// ------------------------------------------------------------------ sourcing pipeline (admin)

/** Moves a request, project or application to a stage; lib/pipeline.ts refuses it until every check is ticked. */
export async function adminStageAction(form: FormData) {
  if (!adminOk(form)) redirect("/");
  const { setStage } = await import("@/lib/pipeline");
  const error = await setStage(read(form, "id", 12), read(form, "stage", 20), form.getAll("checks").map(String), read(form, "note", 500));
  redirect(`/admin/${read(form, "key", 100)}?msg=${encodeURIComponent(error ?? "Saved.")}#pipeline`);
}

/**
 * A technician who answered the three Indeed questions and said yes to question 3 (consent), typed in by Samuel.
 * Nothing is imported from Indeed automatically. Lands at stage 1 (qualified, verification pending).
 */
export async function adminAddCandidateAction(form: FormData) {
  if (!adminOk(form)) redirect("/");
  const key = read(form, "key", 100);
  const back = (msg: string) => redirect(`/admin/${key}?msg=${encodeURIComponent(msg)}#pipeline`);
  const { createInquiry } = await import("@/lib/pipeline");
  const { SOURCING_TRADES } = await import("@/lib/config");
  const email = read(form, "email", 120).toLowerCase();
  const trade = read(form, "trade", 20);
  const consentDay = read(form, "consent_day", 10);
  if (read(form, "consent_yes", 5) !== "yes" || !/^\d{4}-\d{2}-\d{2}$/.test(consentDay)) back("Not added: tick that they said yes to question 3 and give the day they said it.");
  if (!read(form, "name", 100) || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !(SOURCING_TRADES as readonly string[]).includes(trade)) back("Not added: name, a valid email and a trade are needed.");
  await createInquiry({
    kind: "technician",
    source: "indeed",
    // Qualification Pending: they answered the questions; answering never makes anyone verified (16 Nov 2026).
    stage: "qualified",
    // Typed in from Indeed messages: the site sends them nothing (Indeed's terms; Samuel writes to them himself).
    acknowledge: false,
    name: read(form, "name", 100),
    email,
    phone: read(form, "phone", 40),
    company: "",
    country: "US",
    place: read(form, "place", 120),
    trades: [trade],
    lang: "en",
    consentText: `Said yes in Indeed messages on ${consentDay} to: "Would you like our recruiting team to present your profile to commercial contractors and facility employers hiring in ${read(form, "place", 120) || "your city"}?"`,
    consentAt: new Date(`${consentDay}T12:00:00Z`),
    data: {
      "Licenses and certifications": read(form, "licenses", 600),
      "License number for verification": read(form, "license_no", 80),
      "Years commercial / residential": read(form, "years", 80),
      "Target rate": read(form, "rate", 60),
      "Earliest availability": read(form, "available", 40),
      "Indeed post": read(form, "post", 120),
    },
  });
  back("Added at Qualification Pending.");
}

/**
 * A buyer Samuel found himself (a call, an email reply, an event), typed in at New Lead so outbound work has the same
 * pipeline (16 Nov 2026). Nobody is emailed: not the buyer (they never filled the form) and not the inbox (Samuel
 * typed it). Technician placement is for US hires only; a Japan buyer goes in as a commercial project.
 */
export async function adminAddLeadAction(form: FormData) {
  if (!adminOk(form)) redirect("/");
  const key = read(form, "key", 100);
  const back = (msg: string, id?: string) => redirect(`/admin/${key}?msg=${encodeURIComponent(msg)}#${id ? `lead-${id}` : "pipeline"}`);
  const { addEvent, createInquiry } = await import("@/lib/pipeline");
  const { SOURCING_TRADES } = await import("@/lib/config");
  const kind = read(form, "kind", 20);
  const email = read(form, "email", 120).toLowerCase();
  const trade = read(form, "trade", 20);
  const country = read(form, "country", 2).toUpperCase();
  const due = read(form, "followup", 10);
  if (kind !== "talent_request" && kind !== "project") back("Not added: choose Technician request or Commercial project.");
  if (!read(form, "company", 120) || !read(form, "name", 100) || !(SOURCING_TRADES as readonly string[]).includes(trade)) back("Not added: company, contact name and a trade are needed.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) back("Not added: the email is not valid.");
  if (country !== "US" && country !== "JP") back("Not added: the country is US or JP.");
  if (kind === "talent_request" && country !== "US") back("Not added: technician placement is for US hires only; enter a Japan buyer as a commercial project.");
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) back("Not added: the follow-up date is not a date.");
  // The outbound campaign this buyer belongs to (lib/config.ts CAMPAIGNS), so manual and link leads count together.
  const { cleanAttribution } = await import("@/lib/attribution");
  const id = await createInquiry({
    kind: kind as "talent_request" | "project",
    source: "outbound",
    attribution: cleanAttribution({ campaign: read(form, "campaign", 48), medium: "outbound" }),
    stage: "received",
    acknowledge: false,
    notify: false,
    name: read(form, "name", 100),
    email,
    phone: read(form, "phone", 40),
    company: read(form, "company", 120),
    country,
    place: read(form, "place", 120),
    trades: [trade],
    lang: country === "JP" ? "ja" : "en",
    data: {
      "Contact role": read(form, "role", 100),
      "Found via": read(form, "found", 300),
      "What they told us": read(form, "need", 600),
    },
  });
  if (due) await addEvent(id, { kind: "followup", text: read(form, "next", 300) || "First contact", due, owner: read(form, "owner", 60), amount: null });
  back("Added at New Lead. Nobody was emailed.", id);
}

// ------------------------------------------------------------------ technician profiles (admin, 17 Nov 2026)

const toTechnicians = (form: FormData, msg: string) => redirect(`/admin/${read(form, "key", 100)}?msg=${encodeURIComponent(msg)}#technicians`);

/** Pastes the anonymous preview CSV: one invited profile per row (ID, trade, city, state, certifications only). */
export async function adminLoadPartnersAction(form: FormData) {
  if (!adminOk(form)) redirect("/");
  const { loadInvited } = await import("@/lib/partners");
  const { added, skipped } = await loadInvited(String(form.get("csv") ?? "").slice(0, 200_000));
  toTechnicians(form, `Profiles loaded: ${added} added, ${skipped} skipped (already loaded or no valid ID). None is public until its owner confirms.`);
}

/** Takes a confirmed profile off the directory, or lists it again. */
export async function adminPartnerStatusAction(form: FormData) {
  if (!adminOk(form)) redirect("/");
  const { setPartnerStatus } = await import("@/lib/partners");
  const status = read(form, "status", 10) === "active" ? "active" : "hidden";
  const ok = await setPartnerStatus(read(form, "id", 12).toUpperCase(), status);
  toTechnicians(form, ok ? (status === "active" ? "Listed again." : "Hidden from the directory.") : "Not changed: only a profile its owner confirmed can be listed or hidden.");
}

/** An Indeed lead said YES in Indeed Messages: consent recorded, Qualification Pending, anonymous card on. No email. */
export async function adminSaidYesAction(form: FormData) {
  if (!adminOk(form)) redirect("/");
  const { saidYes } = await import("@/lib/partners");
  const id = read(form, "id", 12);
  const day = read(form, "day", 10) || new Date().toISOString().slice(0, 10);
  const listed = await saidYes(id, day);
  redirect(`/admin/${read(form, "key", 100)}?msg=${encodeURIComponent(listed ? `YES recorded. Listed as ${listed}. Nobody was emailed.` : "Not changed: only an Indeed lead without a recorded YES can be marked.")}#lead-${id}`);
}

/** Lists a /join technician who gave consent, anonymously, in the directory. */
export async function adminListTechnicianAction(form: FormData) {
  if (!adminOk(form)) redirect("/");
  const { listFromInquiry } = await import("@/lib/partners");
  const id = await listFromInquiry(read(form, "id", 12));
  toTechnicians(form, id ? `Listed as ${id}.` : "Not listed: only a technician application with consent can be listed.");
}

/** The sales activity log (16 Nov 2026): a call, email, meeting, note, follow-up (with a due date and owner) or proposal. */
export async function adminEventAction(form: FormData) {
  if (!adminOk(form)) redirect("/");
  const key = read(form, "key", 100);
  const { EVENT_KINDS, addEvent } = await import("@/lib/pipeline");
  const kind = read(form, "kind", 12);
  const text = String(form.get("text") ?? "").trim().slice(0, 2000);
  const due = read(form, "due", 10);
  const amountText = read(form, "amount", 14).replace(/[,\s$]/g, "");
  const amount = amountText ? Number(amountText) : null;
  const id = read(form, "id", 12);
  let msg = "Logged.";
  if (!(EVENT_KINDS as readonly string[]).includes(kind) || !text) msg = "Not logged: choose a kind and write what happened.";
  else if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) msg = "Not logged: the due date is not a date.";
  else if (amount !== null && !(Number.isFinite(amount) && amount >= 0 && amount < 1e9)) msg = "Not logged: the amount is not a number.";
  else await addEvent(id, { kind: kind as (typeof EVENT_KINDS)[number], text, due: due || null, owner: read(form, "owner", 60), amount });
  redirect(`/admin/${key}?msg=${encodeURIComponent(msg)}#lead-${id}`);
}

// ------------------------------------------------------------------ employer outreach (admin, 22 Nov 2026)

/**
 * A person confirms the employer's vacancy is real: the role title and the link where it is posted (their careers
 * page or a job board). Recorded as the "vacancy" check with the day; it opens the two email drafts for this lead.
 * Employers only. Nothing is emailed.
 */
export async function adminVacancyAction(form: FormData) {
  if (!adminOk(form)) redirect("/");
  const key = read(form, "key", 100);
  const id = read(form, "id", 12);
  const back = (msg: string) => redirect(`/admin/${key}?msg=${encodeURIComponent(msg)}#lead-${id}`);
  const url = read(form, "url", 300);
  const role = read(form, "role", 80);
  let ok = false;
  try {
    const parsed = new URL(url);
    ok = (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.hostname.includes(".");
  } catch {
    ok = false;
  }
  if (!ok) back("Not saved: paste the vacancy's link (https://...).");
  if (!role) back("Not saved: give the role title as the employer posted it.");
  const { addEvent } = await import("@/lib/pipeline");
  const day = new Date().toISOString().slice(0, 10);
  const rows = await query<{ id: string }>(
    `UPDATE inquiries SET checks = checks || jsonb_build_object('vacancy', $2::text),
            data = CASE WHEN COALESCE(data->>'Role', '') = '' THEN data || jsonb_build_object('Role', $3::text) ELSE data END
     WHERE id = $1 AND kind = 'talent_request' RETURNING id`,
    [id, `${day}: ${url}`, role],
  );
  if (!rows.length) back("Not saved: only an employer request can have a vacancy.");
  await addEvent(id, { kind: "note", text: `Vacancy verified: ${role}, ${url}`, owner: read(form, "owner", 60) });
  back("Vacancy verified. The email drafts are open below.");
}

/**
 * A person sent one of the two vacancy emails from their own mailbox: log it, with who approved it. Refused until
 * Samuel approves the words (EMPLOYER_TEMPLATES=approved), without a verified vacancy, an email or an approver, and
 * for a lead that is Lost. After the first email, a follow-up is planned four business days later.
 */
export async function adminTemplateSentAction(form: FormData) {
  if (!adminOk(form)) redirect("/");
  const key = read(form, "key", 100);
  const id = read(form, "id", 12);
  const back = (msg: string) => redirect(`/admin/${key}?msg=${encodeURIComponent(msg)}#lead-${id}`);
  const { EMPLOYER_TEMPLATES, employerTemplatesApproved, isEmployerTemplate, renderEmployerEmail } = await import("@/lib/employer-outreach");
  const { addEvent } = await import("@/lib/pipeline");
  const template = read(form, "template", 20);
  const approver = read(form, "approver", 60);
  if (!employerTemplatesApproved()) back("Not logged: these emails wait for Samuel's approval of their words (EMPLOYER_TEMPLATES=approved in Vercel).");
  if (!isEmployerTemplate(template)) back("Not logged: unknown email.");
  if (!approver || read(form, "sent", 3) !== "yes") back("Not logged: name who approved it, and tick that you sent it yourself.");
  const [lead] = await query<{ kind: string; stage: string; company: string; name: string; email: string; place: string; trades: string[]; data: Record<string, string>; checks: Record<string, string>; attribution: Record<string, string> }>(
    `SELECT kind, stage, company, name, email, place, trades, data, checks, attribution FROM inquiries WHERE id = $1`,
    [id],
  );
  if (!lead || lead.kind !== "talent_request") back("Not logged: only an employer request.");
  if (lead.stage === "lost") back("Not logged: this lead is Lost.");
  const mail = renderEmployerEmail(template as keyof typeof EMPLOYER_TEMPLATES, lead);
  if ("missing" in mail) back(`Not logged: ${mail.missing}`);
  await addEvent(id, { kind: "email", text: `Sent "${EMPLOYER_TEMPLATES[template as keyof typeof EMPLOYER_TEMPLATES].label}" to ${lead.email} by hand, approved by ${approver}`, owner: read(form, "owner", 60) || approver });
  if (template === "first") {
    const due = new Date();
    for (let added = 0; added < 4; ) {
      due.setUTCDate(due.getUTCDate() + 1);
      if (due.getUTCDay() !== 0 && due.getUTCDay() !== 6) added++;
    }
    await addEvent(id, { kind: "followup", text: "No reply? Send the follow-up email", due: due.toISOString().slice(0, 10), owner: read(form, "owner", 60) || approver });
  }
  back(template === "first" ? "Logged. Follow-up planned in 4 business days." : "Logged.");
}

export async function adminEventDoneAction(form: FormData) {
  if (!adminOk(form)) redirect("/");
  const { completeEvent } = await import("@/lib/pipeline");
  await completeEvent(read(form, "event", 12));
  redirect(`/admin/${read(form, "key", 100)}?msg=${encodeURIComponent("Follow-up done.")}#pipeline`);
}

// ------------------------------------------------------------------ deal orders (admin): getting paid through Mercury

/**
 * The one click on the day a hire starts or a milestone clears (22 Nov 2026): the fee from the agreed terms, then a
 * Mercury invoice that Mercury emails to the client with its hosted pay page. Mercury refuses a second invoice with
 * the same number, so a double click never bills twice.
 */
export async function adminDealInvoiceAction(form: FormData) {
  if (!adminOk(form)) redirect("/");
  const key = read(form, "key", 100);
  const { invoiceDealOrder } = await import("@/lib/deal");
  const money = (name: string) => Number(read(form, name, 20).replace(/[,\s$%]/g, ""));
  let msg: string;
  try {
    const { invoice, amount, payUrl } = await invoiceDealOrder({
      reference: read(form, "reference", 20),
      base: money("base"),
      rate: form.get("rate") ? money("rate") : undefined,
      eventDate: read(form, "date", 10),
      send: read(form, "send", 3) === "yes",
    });
    msg = `Mercury invoice ${invoice.invoiceNumber} created: $${amount.toFixed(2)}, due ${invoice.dueDate}${read(form, "send", 3) === "yes" ? ", emailed to the client by Mercury" : ", NOT emailed (send it from Mercury)"}.${payUrl ? ` Pay page: ${payUrl}` : ""}`;
  } catch (error) {
    msg = `Not invoiced. ${error instanceof Error ? error.message : "Unknown error."}`;
  }
  redirect(`/admin/${key}?deal=${encodeURIComponent(msg.slice(0, 300))}#deal-orders`);
}
