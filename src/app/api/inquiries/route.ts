import { getDictionary } from "@/content";
import { CREW_SIZES, DURATIONS, ENGAGEMENTS, EXPERIENCE, HEADCOUNTS, POWER, PROJECT_SIZES, SOURCING_TRADES, STARTS, UPLOAD, collectsSeekers } from "@/lib/config";
import { fail, readForm, reader, refuse } from "@/lib/guard";
import { createInquiry, isKind, type NewInquiry, type Upload } from "@/lib/pipeline";

export const maxDuration = 30;

const FACILITIES = ["datacenter", "industrial", "commercial", "marine", "other"] as const;
const UPLOAD_EXT = /\.(pdf|jpe?g|png|heic|docx?)$/i;

/** Files under one form field: PDF, image or Word only, UPLOAD.maxBytes in total; null when one is refused. */
async function readFiles(form: FormData, name: string, max: number): Promise<Upload[] | null> {
  const files = form.getAll(name).filter((f): f is File => f instanceof File && f.size > 0).slice(0, max);
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > UPLOAD.maxBytes || files.some((f) => !((UPLOAD.types as readonly string[]).includes(f.type) || UPLOAD_EXT.test(f.name)))) return null;
  return Promise.all(files.map(async (f) => ({ name: f.name || "file", type: f.type || "application/octet-stream", bytes: Buffer.from(await f.arrayBuffer()) })));
}

/**
 * The four forms of the sourcing network: technician requests (/request), commercial projects (/post-project),
 * technician and trade partner applications (/join). Stored in the pipeline and sent to the inbox; nothing is charged
 * and nobody is introduced until a person confirms the agreement, the license and the insurance.
 */
export async function POST(request: Request) {
  // 12 tries in 10 minutes per IP: a long form fixed after a refused field counts each try.
  const refused = refuse(request, "inquiries", 12);
  if (refused) return refused;
  const form = await readForm(request);
  if (form === "bot") return Response.json({ ok: true });
  if (!form) return fail("bad_request", 400);
  const r = reader(form);
  const kind = r.text("kind", 20);
  if (!isKind(kind)) return fail("bad_request", 400);
  const lang = r.lang();
  const invalid: string[] = [];
  const need = (name: string, value: unknown, ok = Boolean(value)) => {
    if (!ok) invalid.push(name);
    return value;
  };
  const trades = form.getAll("trades").map(String).filter((t): t is (typeof SOURCING_TRADES)[number] => (SOURCING_TRADES as readonly string[]).includes(t));
  const base = {
    name: need("name", r.text("name", 100)) as string,
    email: (need("email", r.email("email")) as string | null) ?? "",
    phone: r.text("phone", 40),
    country: (need("country", r.country("country")) as string | null) ?? "",
    // A trade partner names its service areas instead of one place.
    place: need(kind === "partner" ? "areas" : "place", r.text(kind === "partner" ? "areas" : "place", 120)) as string,
    lang,
  };
  if (form.get("consent") !== "yes") invalid.push("consent");

  let input: NewInquiry;
  let files: Upload[] = [];
  if (kind === "talent_request") {
    need("trades", trades, trades.length > 0);
    input = {
      ...base,
      kind,
      company: need("company", r.text("company", 120)) as string,
      trades,
      data: {
        Role: need("role", r.text("role", 80)) as string,
        // Optional since 18 Nov 2026 (Samuel: simplify the admin, never the law): asked on the first call instead.
        "Technicians needed": r.oneOf("headcount", HEADCOUNTS) ?? "",
        Engagement: need("engagement", r.oneOf("engagement", ENGAGEMENTS)) as string,
        Start: need("start", r.text("start", 40)) as string,
        "Project duration": r.oneOf("duration", DURATIONS) ?? "",
        "The work": r.text("description", 4000),
        "Licenses or certifications required": r.text("licenses", 400),
        "Pay range": r.text("pay", 80),
      },
    };
    // Paid placement is offered for US hires only (Samuel, 16 Nov 2026); checked here, not only in the form.
    if (base.country && base.country !== "US") invalid.push("country");
  } else if (kind === "project") {
    need("trades", trades, trades.length > 0);
    const approved = r.oneOf("budget_approved", ["yes", "no"] as const);
    need("budget_approved", approved);
    input = {
      ...base,
      kind,
      company: need("company", r.text("company", 120)) as string,
      trades,
      data: {
        Role: need("role", r.text("role", 80)) as string,
        Facility: need("facility", r.oneOf("facility", FACILITIES)) as string,
        Project: need("title", r.text("title", 140), r.text("title", 140).length >= 5) as string,
        "The work": need("scope", r.text("scope", 4000), r.text("scope", 4000).length >= 30) as string,
        Size: need("size", r.oneOf("size", [...PROJECT_SIZES, "unknown"] as const)) as string,
        Start: need("start", r.oneOf("start", STARTS)) as string,
        "Power secured": need("power", r.oneOf("power", POWER)) as string,
        "Budget approved": approved ?? "",
        "Required qualifications": r.text("qualifications", 400),
      },
    };
    const docs = await readFiles(form, "documents", 3);
    if (docs === null) invalid.push("documents");
    else files = docs;
  } else if (kind === "technician") {
    const trade = r.oneOf("trade", SOURCING_TRADES);
    need("trade", trade);
    need("phone", base.phone);
    // Japan: no technician details are collected until the MHLW notification is filed (JAPAN_SEEKER_DATA).
    if (base.country && !collectsSeekers(base.country)) invalid.push("country");
    if (form.get("consent_profile") !== "yes") invalid.push("consent_profile");
    // Since 18 Nov 2026 only who, where and which trade are required: licenses, experience, rate and dates help
    // matching and can come on the first call. Nobody is presented before any license the role needs is checked.
    const available = r.text("available", 10);
    need("available", available, available === "" || /^\d{4}-\d{2}-\d{2}$/.test(available));
    const resume = await readFiles(form, "file", 1);
    if (resume === null) invalid.push("file");
    else files = resume;
    input = {
      ...base,
      kind,
      company: "",
      trades: trade ? [trade] : [],
      consentText: getDictionary(lang).join.tech.consentProfile,
      data: {
        "Licenses and certifications": r.text("licenses", 600),
        "Years of commercial experience": r.oneOf("years", EXPERIENCE) ?? "",
        "Target rate": r.text("rate", 60),
        "Earliest availability": available,
      },
    };
  } else {
    need("trades", trades, trades.length > 0);
    need("phone", base.phone);
    input = {
      ...base,
      kind,
      company: need("company", r.text("company", 120)) as string,
      trades,
      data: {
        // License and insurance are checked before any project that needs them, not at sign-up (18 Nov 2026).
        "State license number": r.text("license", 80),
        "Liability and workers' comp insurance active": r.oneOf("insurance", ["yes", "no"] as const) ?? "",
        "Crew size": r.oneOf("crew", CREW_SIZES) ?? "",
        "Service areas": need("areas", r.text("areas", 300)) as string,
        "Typical project size": r.oneOf("size", PROJECT_SIZES) ?? "",
        "Insurance details": r.text("insurance_details", 200),
      },
    };
  }
  // Record bounded, non-personal campaign labels for employer/project demand generation.
  // Applicant profiles do not inherit marketing attribution.
  if (kind === "talent_request" || kind === "project") {
    for (const key of ["utm_source", "utm_medium", "utm_campaign"] as const) {
      const value = r.text(key, 64).replace(/[^a-zA-Z0-9._-]/g, "");
      if (value) input.data[key] = value;
    }
    if (input.data.utm_source) input.source = `campaign:${input.data.utm_source}`;
  }
  if (invalid.length) return fail("invalid", 400, [...new Set(invalid)]);
  try {
    await createInquiry(input, files);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[inquiries] failed:", error instanceof Error ? error.message : "unknown");
    return fail("server", 500);
  }
}
