import { getDictionary } from "@/content";
import { CREW_SIZES, ENGAGEMENTS, EXPERIENCE, HEADCOUNTS, POWER, PROJECT_SIZES, SOURCING_TRADES, STARTS, UPLOAD, collectsSeekers } from "@/lib/config";
import { fail, readForm, reader, refuse } from "@/lib/guard";
import { createInquiry, isKind, type NewInquiry, type Upload } from "@/lib/pipeline";

export const maxDuration = 30;

const FACILITIES = ["datacenter", "industrial", "commercial", "marine", "other"] as const;
const UPLOAD_EXT = /\.(pdf|jpe?g|png|heic|docx?)$/i;

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
  let file: Upload | null = null;
  if (kind === "talent_request") {
    need("trades", trades, trades.length > 0);
    input = {
      ...base,
      kind,
      company: need("company", r.text("company", 120)) as string,
      trades,
      data: {
        Role: need("role", r.text("role", 80)) as string,
        "Technicians needed": need("headcount", r.oneOf("headcount", HEADCOUNTS)) as string,
        Engagement: need("engagement", r.oneOf("engagement", ENGAGEMENTS)) as string,
        Start: need("start", r.text("start", 40)) as string,
        "The work": need("description", r.text("description", 4000), r.text("description", 4000).length >= 20) as string,
        "Licenses or certifications required": r.text("licenses", 400),
        "Pay range": r.text("pay", 80),
      },
    };
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
      },
    };
  } else if (kind === "technician") {
    const trade = r.oneOf("trade", SOURCING_TRADES);
    need("trade", trade);
    need("phone", base.phone);
    // Japan: no technician details are collected until the MHLW notification is filed (JAPAN_SEEKER_DATA).
    if (base.country && !collectsSeekers(base.country)) invalid.push("country");
    if (form.get("consent_profile") !== "yes") invalid.push("consent_profile");
    const available = r.text("available", 10);
    need("available", available, /^\d{4}-\d{2}-\d{2}$/.test(available));
    const upload = form.get("file");
    if (upload instanceof File && upload.size > 0) {
      const okType = (UPLOAD.types as readonly string[]).includes(upload.type) || UPLOAD_EXT.test(upload.name);
      if (upload.size > UPLOAD.maxBytes || !okType) invalid.push("file");
      else file = { name: upload.name || "file", type: upload.type || "application/octet-stream", bytes: Buffer.from(await upload.arrayBuffer()) };
    }
    input = {
      ...base,
      kind,
      company: "",
      trades: trade ? [trade] : [],
      consentText: getDictionary(lang).join.tech.consentProfile,
      data: {
        "Licenses and certifications": need("licenses", r.text("licenses", 600)) as string,
        "Years of commercial experience": need("years", r.oneOf("years", EXPERIENCE)) as string,
        "Target rate": need("rate", r.text("rate", 60)) as string,
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
        "State license number": need("license", r.text("license", 80)) as string,
        "Liability and workers' comp insurance active": need("insurance", r.oneOf("insurance", ["yes", "no"] as const)) as string,
        "Crew size": need("crew", r.oneOf("crew", CREW_SIZES)) as string,
        "Service areas": need("areas", r.text("areas", 300)) as string,
        "Typical project size": need("size", r.oneOf("size", PROJECT_SIZES)) as string,
      },
    };
  }
  if (invalid.length) return fail("invalid", 400, [...new Set(invalid)]);
  try {
    await createInquiry(input, file);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[inquiries] failed:", error instanceof Error ? error.message : "unknown");
    return fail("server", 500);
  }
}
