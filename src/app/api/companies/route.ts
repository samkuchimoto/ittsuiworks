import { isTrade } from "@/lib/config";
import { fail, readForm, reader, refuse } from "@/lib/guard";
import { registerCompany } from "@/lib/market";

/** A company signs up for project leads; the email link confirms it. */
export async function POST(request: Request) {
  const refused = refuse(request, "companies", 4);
  if (refused) return refused;
  const form = await readForm(request);
  if (form === "bot") return Response.json({ ok: true });
  if (!form) return fail("bad_request", 400);
  const r = reader(form);
  const trades = [...new Set(form.getAll("trades").map(String))].filter(isTrade);
  const input = {
    name: r.text("company", 120),
    contact_name: r.text("name", 100),
    email: r.email("email"),
    website: r.website("site"),
    country: r.country("country"),
    lang: r.lang(),
  };
  const invalid: string[] = [];
  if (!input.name) invalid.push("company");
  if (!input.contact_name) invalid.push("name");
  if (!input.email) invalid.push("email");
  if (input.website === null) invalid.push("site");
  if (!input.country) invalid.push("country");
  if (trades.length === 0) invalid.push("trades");
  if (form.get("consent") !== "yes") invalid.push("consent");
  if (invalid.length) return fail("invalid", 400, invalid);
  try {
    await registerCompany({ ...input, email: input.email!, website: input.website ?? "", country: input.country!, trades, abroad: form.get("abroad") === "yes" });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[companies] failed:", error instanceof Error ? error.message : "unknown");
    return fail("server", 500);
  }
}
