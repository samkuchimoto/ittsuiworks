import { COUNTRIES, INDUSTRIES, KINDS, NEEDS, TRADES } from "@/lib/forms";
import { EmailNotConfiguredError, sendEmail } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const COUNTRY = { us: "USA", jp: "Japan" } as const;
const INDUSTRY = { hvac: "Commercial HVAC", datacenter: "Data centers", marine: "Marine", other: "Other" } as const;
const NEED = { clients: "Clients and meetings", technicians: "Technicians", both: "Both" } as const;

const fail = (error: string, status: number, fields?: string[]) => Response.json({ ok: false, error, fields }, { status });

/** Consultation requests from companies and profiles from technicians, both emailed to the inbox. */
export async function POST(request: Request) {
  if (!rateLimit(`contact:${clientIp(request)}`)) return fail("rate_limited", 429);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("bad_request", 400);
  }
  // Honeypot: people never see this field. Pretend it worked.
  if (String(form.get("website") ?? "").trim() !== "") return Response.json({ ok: true });

  const text = (name: string, max: number) => String(form.get(name) ?? "").trim().slice(0, max);
  const oneOf = <T extends readonly string[]>(name: string, options: T) => {
    const value = text(name, 40);
    return (options as readonly string[]).includes(value) ? (value as T[number]) : null;
  };

  const kind = oneOf("kind", KINDS);
  const data = {
    lang: text("lang", 5) === "ja" ? "Japanese" : "English",
    company: text("company", 120),
    name: text("name", 100),
    email: text("email", 120),
    country: oneOf("country", COUNTRIES),
    industry: oneOf("industry", INDUSTRIES),
    trade: oneOf("trade", TRADES),
    need: oneOf("need", NEEDS),
    message: text("message", 2000),
  };

  const invalid: string[] = [];
  if (!kind) return fail("invalid", 400, ["kind"]);
  if (!data.name) invalid.push("name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) invalid.push("email");
  if (!data.country) invalid.push("country");
  if (kind === "company") {
    if (!data.company) invalid.push("company");
    if (!data.industry) invalid.push("industry");
    if (!data.need) invalid.push("need");
  } else {
    if (!data.trade) invalid.push("trade");
    if (!data.message) invalid.push("message");
  }
  if (form.get("consent") !== "yes") invalid.push("consent");
  if (invalid.length) return fail("invalid", 400, invalid);

  const country = COUNTRY[data.country!];
  const message =
    kind === "company"
      ? {
          subject: `Consultation request: ${data.company} (${country}, ${INDUSTRY[data.industry!]})`,
          rows: [
            ["Company", data.company],
            ["Name", data.name],
            ["Email", data.email],
            ["Country", country],
            ["Industry", INDUSTRY[data.industry!]],
            ["Needs", NEED[data.need!]],
            ["Message", data.message],
            ["Site language", data.lang],
          ] as [string, string][],
        }
      : {
          subject: `Technician profile: ${data.name} (${INDUSTRY[data.trade!]}, ${country})`,
          rows: [
            ["Name", data.name],
            ["Email", data.email],
            ["Country", country],
            ["Trade", INDUSTRY[data.trade!]],
            ["Certifications and experience", data.message],
            ["Site language", data.lang],
          ] as [string, string][],
        };

  try {
    await sendEmail({ ...message, rows: [...message.rows, ["Consent", "Agreed to the privacy policy"]], replyTo: data.email });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof EmailNotConfiguredError) {
      if (process.env.NODE_ENV !== "production") {
        console.info("[contact] email not configured, logged instead:", message.subject);
        return Response.json({ ok: true });
      }
      console.error("[contact] email env missing");
      return fail("not_configured", 503);
    }
    console.error("[contact] send failed", error instanceof Error ? error.message : "unknown");
    return fail("server", 502);
  }
}
