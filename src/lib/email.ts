/**
 * Sends form messages to the inbox through Resend (https://resend.com).
 *
 * Environment variables (set in Vercel, never in the code):
 *   RESEND_API_KEY      API key from the Resend dashboard
 *   CONTACT_TO_EMAIL    where messages go, e.g. contact@ittsuiworks.com
 *   CONTACT_FROM_EMAIL  sender on a domain verified in Resend
 */
import "server-only";
import { BRAND } from "./site";

export class EmailNotConfiguredError extends Error {}

export async function sendEmail({ subject, rows, replyTo }: { subject: string; rows: [string, string][]; replyTo: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL;
  if (!apiKey || !to || !from) throw new EmailNotConfiguredError("RESEND_API_KEY, CONTACT_TO_EMAIL or CONTACT_FROM_EMAIL is not set");

  const filled = rows.filter(([, value]) => value.trim() !== "");
  const text = [subject, "", ...filled.map(([label, value]) => `${label}: ${value}`)].join("\n");
  const html = `<h2 style="font-family:sans-serif;color:#0f2747">${escape(subject)}</h2><table style="font-family:sans-serif;border-collapse:collapse">${filled
    .map(([label, value]) => `<tr><td style="padding:6px 14px 6px 0;color:#4b5e79;vertical-align:top">${escape(label)}</td><td style="padding:6px 0;white-space:pre-wrap">${escape(value)}</td></tr>`)
    .join("")}</table>`;

  const address = from.match(/<([^>]+)>/)?.[1] ?? from;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `${BRAND} <${address}>`, to: to.split(",").map((a) => a.trim()), subject, text, html, reply_to: replyTo }),
  });
  if (!response.ok) throw new Error(`Resend responded ${response.status}`);
}

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
