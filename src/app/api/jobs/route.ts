import { CURRENCIES, EMPLOYMENT, PAY_UNITS, TRADES, collectsSeekers } from "@/lib/config";
import { EMAIL, fail, readForm, reader, refuse } from "@/lib/guard";
import { postJob } from "@/lib/market";

/** Posts a job. From an account link it goes live at once; otherwise the email link publishes it. */
export async function POST(request: Request) {
  const refused = refuse(request, "jobs", 15);
  if (refused) return refused;
  const form = await readForm(request);
  if (form === "bot") return Response.json({ ok: true });
  if (!form) return fail("bad_request", 400);
  const r = reader(form);
  const account = r.text("account", 40);

  const job = {
    title: r.text("title", 120),
    trade: r.oneOf("trade", TRADES),
    employment: r.oneOf("employment", EMPLOYMENT),
    country: r.country("country"),
    city: r.text("city", 80),
    pay_min: r.amount("pay_min"),
    pay_max: r.amount("pay_max"),
    pay_currency: r.oneOf("currency", CURRENCIES) ?? "USD",
    pay_unit: r.oneOf("pay_unit", PAY_UNITS) ?? "hour",
    description: r.text("description", 6000),
    certifications: r.text("certifications", 300),
    apply_url: r.text("apply_url", 300),
    lang: r.lang(),
  };
  const company = { name: r.text("company", 120), contact_name: r.text("name", 100), email: r.email("email") ?? "", website: r.website("site"), country: job.country ?? "US", lang: job.lang };

  const invalid: string[] = [];
  if (!account) {
    if (!company.name) invalid.push("company");
    if (!company.contact_name) invalid.push("name");
    if (!company.email) invalid.push("email");
    if (company.website === null) invalid.push("site");
  }
  if (job.title.length < 3) invalid.push("title");
  if (!job.trade) invalid.push("trade");
  if (!job.employment) invalid.push("employment");
  if (!job.country) invalid.push("country");
  if (!job.city) invalid.push("city");
  if (Number.isNaN(job.pay_min)) invalid.push("pay_min");
  if (Number.isNaN(job.pay_max) || (job.pay_min && job.pay_max && job.pay_max < job.pay_min)) invalid.push("pay_max");
  if (job.description.length < 40) invalid.push("description");
  // Jobs in Japan take applications through the employer's own link or email (see JAPAN_SEEKER_DATA).
  const external = job.country !== null && !collectsSeekers(job.country);
  if (external) {
    const link = job.apply_url;
    if (!(EMAIL.test(link) || /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(link))) invalid.push("apply_url");
  } else {
    job.apply_url = "";
  }
  if (form.get("consent") !== "yes") invalid.push("consent");
  if (invalid.length) return fail("invalid", 400, invalid);

  try {
    const result = await postJob({ ...company, website: company.website ?? "" }, { ...job, trade: job.trade!, employment: job.employment!, country: job.country! }, account || undefined);
    return Response.json({ ok: true, live: result.live, jobId: result.live ? result.jobId : undefined });
  } catch (error) {
    console.error("[jobs] failed:", error instanceof Error ? error.message : "unknown");
    return fail("server", 500);
  }
}
