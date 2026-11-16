import { EXPERIENCE, SOURCING_TRADES } from "@/lib/config";
import { isToken } from "@/lib/db";
import { fail, readForm, reader, refuse } from "@/lib/guard";
import { confirmInvite, getPartnerByToken } from "@/lib/partners";

export const maxDuration = 30;

/** An invited technician confirms their anonymous profile with their own details (Samuel, 17 November 2026). */
export async function POST(request: Request) {
  const refused = refuse(request, "partner-confirm", 12);
  if (refused) return refused;
  const form = await readForm(request);
  if (form === "bot") return Response.json({ ok: true });
  if (!form) return fail("bad_request", 400);
  const r = reader(form);
  const token = r.text("token", 40);
  if (!isToken(token)) return fail("not_found", 404);
  const partner = await getPartnerByToken(token);
  if (!partner) return fail("not_found", 404);
  if (partner.status !== "invited") return fail("duplicate", 409);

  const invalid: string[] = [];
  const need = <T,>(name: string, value: T, ok = Boolean(value)) => {
    if (!ok) invalid.push(name);
    return value;
  };
  const state = r.text("state", 2).toUpperCase();
  const available = r.text("available", 10);
  const input = {
    name: need("name", r.text("name", 100)),
    email: need("email", r.email("email")) ?? "",
    phone: need("phone", r.text("phone", 40)),
    trade: need("trade", r.oneOf("trade", SOURCING_TRADES)),
    city: need("city", r.text("city", 80)),
    state: need("state", state, /^[A-Z]{2}$/.test(state)),
    certs: r.text("certs", 300),
    years: need("years", r.oneOf("years", EXPERIENCE)) ?? "",
    rate: need("rate", r.text("rate", 60)),
    available: need("available", available, /^\d{4}-\d{2}-\d{2}$/.test(available)),
  };
  if (form.get("consent_directory") !== "yes") invalid.push("consent_directory");
  if (form.get("consent") !== "yes") invalid.push("consent");
  if (invalid.length || !input.trade) return fail("invalid", 400, invalid);
  try {
    const done = await confirmInvite(partner, { ...input, trade: input.trade });
    return done ? Response.json({ ok: true }) : fail("duplicate", 409);
  } catch (error) {
    console.error("[partners] confirm failed:", error instanceof Error ? error.message : "unknown");
    return fail("server", 500);
  }
}
