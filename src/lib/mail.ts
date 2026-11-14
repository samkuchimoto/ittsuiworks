/**
 * Emails people asked for (confirmations, applications, job alerts, leads) through Resend (https://resend.com).
 * Env on Vercel, never printed: RESEND_API_KEY, CONTACT_TO_EMAIL (the inbox), CONTACT_FROM_EMAIL
 * ("Ittsui Works <forms@kuchimoto.com>": kuchimoto.com is the verified domain; Kuchimoto LLC operates Ittsui Works).
 * Replies reach contact@ittsuiworks.com unless a message names someone else.
 * Without the env (on a computer) emails are printed to the console instead, so every flow can be tried.
 * Cold outreach never goes through here: see lib/outreach.ts.
 */
import "server-only";
import { EMAIL, SITE_URL } from "./site";

export type Mail = {
  /** Omitted: the Ittsui Works inbox. */
  to?: string;
  subject: string;
  lines: string[];
  replyTo?: string;
  /** One-click unsubscribe URL (job alerts). */
  unsubscribe?: string;
};

const escape = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const linkify = (v: string) => escape(v).replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0f2747">$1</a>');

/** Test hook: the local end-to-end script reads the last emails from here. */
declare global {
  var ittsuiOutbox: { to: string; subject: string; text: string }[] | undefined;
}

export async function sendMail({ to, subject, lines, replyTo, unsubscribe }: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const owner = process.env.CONTACT_TO_EMAIL;
  const signature = ["", "Ittsui Works (一対ワークス)", `${EMAIL} · ${SITE_URL.replace("https://", "")}`];
  const text = [...lines, ...signature].join("\n");
  if (!key || !owner) {
    if (process.env.NODE_ENV === "production" && !process.env.ITTSUI_TEST) throw new Error("RESEND_API_KEY or CONTACT_TO_EMAIL is not set");
    (globalThis.ittsuiOutbox ??= []).push({ to: to ?? "inbox", subject, text });
    // Local end-to-end tests read the emails from this file (never set on Vercel).
    if (process.env.ITTSUI_OUTBOX) (await import("node:fs")).appendFileSync(process.env.ITTSUI_OUTBOX, `${JSON.stringify({ to: to ?? "inbox", subject, text })}\n`);
    if (globalThis.ittsuiOutbox.length > 200) globalThis.ittsuiOutbox.shift();
    console.info(`[mail] to ${to ?? "inbox"} | ${subject}`);
    return;
  }
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0d2140;max-width:600px">${text
    .split("\n")
    .map((l) => (l ? `<p style="margin:0 0 8px">${linkify(l)}</p>` : "<br>"))
    .join("")}</div>`;
  const from = process.env.CONTACT_FROM_EMAIL ?? "Ittsui Works <onboarding@resend.dev>";
  const address = from.match(/<([^>]+)>/)?.[1] ?? from;
  const headers: Record<string, string> = {};
  if (unsubscribe) {
    headers["List-Unsubscribe"] = `<${unsubscribe}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `Ittsui Works <${address}>`,
      to: (to ?? owner).split(",").map((a) => a.trim()),
      subject,
      text,
      html,
      reply_to: replyTo ?? EMAIL,
      headers,
    }),
  });
  if (!response.ok) throw new Error(`Resend responded ${response.status}`);
}

/** Sends, and logs instead of failing: used where one failed email must not stop the rest. */
export async function trySendMail(mail: Mail): Promise<boolean> {
  try {
    await sendMail(mail);
    return true;
  } catch (error) {
    console.error("[mail] failed:", error instanceof Error ? error.message : "unknown");
    return false;
  }
}

export const mailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.CONTACT_TO_EMAIL);
