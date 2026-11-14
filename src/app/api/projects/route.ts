import { BUDGETS, POWER, STARTS, TRADES } from "@/lib/config";
import { fail, readForm, reader, refuse } from "@/lib/guard";
import { postProject } from "@/lib/market";

/** A buyer posts a project; the email link confirms it and sends it to companies in the trade. */
export async function POST(request: Request) {
  const refused = refuse(request, "projects", 4);
  if (refused) return refused;
  const form = await readForm(request);
  if (form === "bot") return Response.json({ ok: true });
  if (!form) return fail("bad_request", 400);
  const r = reader(form);
  const approved = r.oneOf("budget_approved", ["yes", "no"] as const);
  const input = {
    trade: r.oneOf("trade", TRADES),
    title: r.text("title", 140),
    scope: r.text("scope", 4000),
    country: r.country("country"),
    city: r.text("city", 80),
    budget: r.oneOf("budget", BUDGETS),
    start: r.oneOf("start", STARTS),
    power: r.oneOf("power", POWER),
    lang: r.lang(),
    buyer: { name: r.text("name", 100), role: r.text("role", 80), company: r.text("company", 120), email: r.email("email") ?? "", phone: r.text("phone", 40) },
  };
  const invalid: string[] = [];
  if (!input.trade) invalid.push("trade");
  if (input.title.length < 5) invalid.push("title");
  if (input.scope.length < 30) invalid.push("scope");
  if (!input.country) invalid.push("country");
  if (!input.city) invalid.push("city");
  if (!input.budget) invalid.push("budget");
  if (!input.start) invalid.push("start");
  if (!input.power) invalid.push("power");
  if (!approved) invalid.push("budget_approved");
  if (!input.buyer.name) invalid.push("name");
  if (!input.buyer.role) invalid.push("role");
  if (!input.buyer.company) invalid.push("company");
  if (!input.buyer.email) invalid.push("email");
  if (form.get("consent") !== "yes") invalid.push("consent");
  if (invalid.length) return fail("invalid", 400, invalid);
  try {
    await postProject({
      ...input,
      trade: input.trade!,
      country: input.country!,
      budget: input.budget!,
      start: input.start!,
      power: input.power!,
      budget_approved: approved === "yes",
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[projects] failed:", error instanceof Error ? error.message : "unknown");
    return fail("server", 500);
  }
}
