import { TRADES, collectsSeekers } from "@/lib/config";
import { fail, readForm, reader, refuse } from "@/lib/guard";
import { subscribeAlert } from "@/lib/market";

/** Job alerts: the email link switches them on (double opt-in). */
export async function POST(request: Request) {
  const refused = refuse(request, "alerts");
  if (refused) return refused;
  const form = await readForm(request);
  if (form === "bot") return Response.json({ ok: true });
  if (!form) return fail("bad_request", 400);
  const r = reader(form);
  const input = { email: r.email("email"), trade: r.oneOf("trade", TRADES), country: r.country("country"), lang: r.lang() };
  const invalid: string[] = [];
  if (!input.email) invalid.push("email");
  if (!input.trade) invalid.push("trade");
  if (!input.country || !collectsSeekers(input.country)) invalid.push("country");
  if (form.get("consent") !== "yes") invalid.push("consent");
  if (invalid.length) return fail("invalid", 400, invalid);
  try {
    await subscribeAlert({ email: input.email!, trade: input.trade!, country: input.country!, lang: input.lang });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[alerts] failed:", error instanceof Error ? error.message : "unknown");
    return fail("server", 500);
  }
}
