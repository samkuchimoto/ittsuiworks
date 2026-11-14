import { fail, readForm, reader, refuse } from "@/lib/guard";
import { applyToJob } from "@/lib/market";

/** A technician applies; the application reaches the employer's inbox at once. */
export async function POST(request: Request) {
  const refused = refuse(request, "apply", 8);
  if (refused) return refused;
  const form = await readForm(request);
  if (form === "bot") return Response.json({ ok: true });
  if (!form) return fail("bad_request", 400);
  const r = reader(form);
  const input = {
    name: r.text("name", 100),
    email: r.email("email"),
    country: r.country("country"),
    years: r.oneOf("years", ["0-1", "1-3", "3-5", "5-10", "10+"] as const),
    certifications: r.text("experience", 2000),
    message: r.text("message", 2000),
    lang: r.lang(),
  };
  const invalid: string[] = [];
  if (!input.name) invalid.push("name");
  if (!input.email) invalid.push("email");
  if (!input.country) invalid.push("country");
  if (!input.years) invalid.push("years");
  if (input.certifications.length < 5) invalid.push("experience");
  if (form.get("consent") !== "yes") invalid.push("consent");
  if (invalid.length) return fail("invalid", 400, invalid);
  try {
    const result = await applyToJob(r.text("job", 12), { ...input, email: input.email!, country: input.country!, years: input.years! });
    if (result === "ok") return Response.json({ ok: true });
    return fail(result, result === "duplicate" ? 409 : 410);
  } catch (error) {
    console.error("[apply] failed:", error instanceof Error ? error.message : "unknown");
    return fail("server", 500);
  }
}
