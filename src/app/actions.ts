"use server";

/** The buttons on the private pages (account, project, alerts, unsubscribe, admin). lib/market.ts does the work. */
import { redirect } from "next/navigation";
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

const adminOk = (form: FormData) => {
  const key = process.env.ADMIN_KEY;
  return Boolean(key) && key!.length >= 24 && read(form, "key", 100) === key;
};

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
    stage: "qualified",
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
  back("Added at stage 1.");
}
