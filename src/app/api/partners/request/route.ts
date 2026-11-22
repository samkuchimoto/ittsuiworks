import { readAttribution } from "@/lib/attribution";
import { fail, readForm, reader, refuse } from "@/lib/guard";
import { getPartner, notifyRequest } from "@/lib/partners";
import { createInquiry } from "@/lib/pipeline";
import type { SourcingTrade } from "@/lib/config";

export const maxDuration = 30;

/**
 * A client asks for one technician from /technicians (Samuel, 17 November 2026). The request is a technician request
 * in the pipeline (US hires only, "Requested technician" = the profile ID), acknowledged like any other; the inbox is
 * told who the technician is. The client's own page never shows the technician's name or contact.
 */
export async function POST(request: Request) {
  const refused = refuse(request, "partner-request", 8);
  if (refused) return refused;
  const form = await readForm(request);
  if (form === "bot") return Response.json({ ok: true });
  if (!form) return fail("bad_request", 400);
  const r = reader(form);
  const partner = await getPartner(r.text("id", 12).toUpperCase());
  if (!partner || partner.status !== "active") return fail("not_found", 404);

  const invalid: string[] = [];
  const need = <T,>(name: string, value: T, ok = Boolean(value)) => {
    if (!ok) invalid.push(name);
    return value;
  };
  const start = r.text("start", 10);
  const company = need("company", r.text("company", 120));
  const role = need("role", r.text("role", 80));
  const place = need("place", r.text("place", 120));
  const name = need("name", r.text("name", 100));
  const email = need("email", r.email("email")) ?? "";
  need("start", start, /^\d{4}-\d{2}-\d{2}$/.test(start));
  if (form.get("consent") !== "yes") invalid.push("consent");
  if (invalid.length) return fail("invalid", 400, invalid);
  try {
    const reference = await createInquiry({
      kind: "talent_request",
      source: "directory",
      attribution: readAttribution(form),
      name,
      email,
      phone: r.text("phone", 40),
      company,
      country: "US",
      place,
      trades: partner.trade ? [partner.trade as SourcingTrade] : [],
      lang: "en",
      data: {
        "Requested technician": partner.id,
        Role: role,
        "Technicians needed": "1",
        Start: start,
        "The work": r.text("notes", 1000),
      },
    });
    await notifyRequest(partner, { reference, company, role, place });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[partners] request failed:", error instanceof Error ? error.message : "unknown");
    return fail("server", 500);
  }
}
