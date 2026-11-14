/**
 * Job import, the way Indeed began: technician jobs that employers publish on their own careers pages are listed
 * here, each on its own page, with a link back to the employer's page to apply. The sources are public job-board
 * feeds made to be read by anyone (Greenhouse, Lever, Ashby). Only technician jobs in our three trades, with a real
 * place, are kept. A job leaves the site the day it leaves the employer's page.
 *
 * No imports on purpose: this file runs on the server and in local tests (node --experimental-strip-types).
 */

export type FeedTrade = "hvac" | "datacenter" | "marine";
export type Feed = {
  ats: "greenhouse" | "lever" | "ashby";
  slug: string;
  name: string;
  website: string;
  trade: FeedTrade;
  /** Extra title filter for employers that hire far beyond our trades (AI labs, defence). */
  only?: RegExp;
};

const DC = /data ?cent(er|re)|datacenter|critical (facilit|environment)|facilit(y|ies)|stargate/i;

/** Employers whose public feeds carry technician jobs in our trades (checked 14 November 2026). */
export const FEEDS: Feed[] = [
  // Data centers
  { ats: "greenhouse", slug: "xai", name: "xAI", website: "https://x.ai", trade: "datacenter", only: /data ?cent|facilit|critical|commissioning|electric|mechanic|controls|\bbms\b|technician|operator/i },
  { ats: "greenhouse", slug: "nebius", name: "Nebius", website: "https://nebius.com", trade: "datacenter", only: /data ?cent|facilit|critical|technician|power|commissioning|electric|mechanic/i },
  { ats: "greenhouse", slug: "coreweave", name: "CoreWeave", website: "https://www.coreweave.com", trade: "datacenter", only: DC },
  { ats: "ashby", slug: "crusoe", name: "Crusoe", website: "https://www.crusoe.ai", trade: "datacenter" },
  { ats: "ashby", slug: "fluidstack", name: "Fluidstack", website: "https://www.fluidstack.io", trade: "datacenter" },
  { ats: "ashby", slug: "openai", name: "OpenAI", website: "https://openai.com", trade: "datacenter", only: DC },
  { ats: "ashby", slug: "cerebras", name: "Cerebras", website: "https://www.cerebras.ai", trade: "datacenter", only: DC },
  { ats: "ashby", slug: "lambda", name: "Lambda", website: "https://lambda.ai", trade: "datacenter", only: DC },
  { ats: "greenhouse", slug: "anthropic", name: "Anthropic", website: "https://www.anthropic.com", trade: "datacenter", only: DC },
  { ats: "greenhouse", slug: "togetherai", name: "Together AI", website: "https://www.together.ai", trade: "datacenter", only: DC },
  { ats: "greenhouse", slug: "firmus", name: "Firmus", website: "https://firmus.co", trade: "datacenter" },
  { ats: "lever", slug: "cologix", name: "Cologix", website: "https://cologix.com", trade: "datacenter" },
  { ats: "greenhouse", slug: "yondrgroup", name: "Yondr", website: "https://www.yondrgroup.com", trade: "datacenter" },
  { ats: "greenhouse", slug: "airtrunk", name: "AirTrunk", website: "https://airtrunk.com", trade: "datacenter" },
  { ats: "greenhouse", slug: "edgeconnex", name: "EdgeConneX", website: "https://www.edgeconnex.com", trade: "datacenter" },
  { ats: "greenhouse", slug: "elementcritical", name: "Element Critical", website: "https://www.elementcritical.com", trade: "datacenter" },
  { ats: "greenhouse", slug: "hut8", name: "Hut 8", website: "https://hut8.com", trade: "datacenter" },
  { ats: "lever", slug: "cleanspark", name: "CleanSpark", website: "https://www.cleanspark.com", trade: "datacenter", only: /facilit|electric|technician|maintenance/i },
  // HVAC
  { ats: "lever", slug: "sila", name: "Sila", website: "https://www.silaservices.com", trade: "hvac", only: /hvac|heating|cooling|air condition|boiler|furnace|refrigerat|heat pump|geothermal|sheet metal|duct|comfort/i },
  { ats: "greenhouse", slug: "jetsonhome", name: "Jetson", website: "https://www.jetsonhome.com", trade: "hvac" },
  { ats: "ashby", slug: "zerohomes", name: "Zero Homes", website: "https://www.zerohomes.io", trade: "hvac" },
  { ats: "greenhouse", slug: "quilt", name: "Quilt", website: "https://www.quilt.com", trade: "hvac" },
  { ats: "ashby", slug: "dandelion", name: "Dandelion Energy", website: "https://dandelionenergy.com", trade: "hvac" },
  // Marine
  { ats: "ashby", slug: "saronic", name: "Saronic", website: "https://www.saronic.com", trade: "marine" },
  { ats: "greenhouse", slug: "arcboatcompany", name: "Arc Boats", website: "https://arcboats.com", trade: "marine" },
  { ats: "ashby", slug: "havocai", name: "HavocAI", website: "https://www.havocai.com", trade: "marine" },
  { ats: "greenhouse", slug: "andurilindustries", name: "Anduril", website: "https://www.anduril.com", trade: "marine", only: /marine|maritime|vessel|boat|\bship|subsea|undersea|\bdive|\bmate\b|captain|deckhand|seaman/i },
];

/** Technician work: the trades, not the office. */
const TECH =
  /technician|hvac tech\b|service tech\b|installer|electrician|mechanic\b|mechanics\b|plumber|pipefitter|steamfitter|fitter|welder|operator|foreman|apprentice|helper|journeyman|critical (facilit|environment)|facilit(y|ies) (engineer|technician|operator|specialist)|operations engineer|shift (engineer|technician|lead|supervisor)|commissioning|\bbms\b|\bbas\b|controls (technician|engineer|specialist)|chief engineer|stationary engineer|building engineer|data ?cent(er|re) (technician|engineer|operations|ops)|deckhand|\bmate\b|captain|able seaman|boatswain|marine (engineer|technician|electrician|mechanic)|service engineer|field (service|systems)|maintenance/i;
const OFFICE =
  /\bintern\b|internship|co-op|software|recruit|sales|marketing|account (executive|manager)|financ|legal|counsel|product (manager|lead)|designer|scien|analyst|machine learning|research|director|president|\bvp\b|head of|architect|sourcing|procurement|buyer|cost engineer|scheduler|manager|coordinator|people|talent|payroll|hardware engineer|performance|outcomes|business|strategy|writer|\bit\b|network|security|\bgtm\b|customer success|help ?desk|storage/i;

export const isTechJob = (feed: Feed, title: string) => TECH.test(title) && !OFFICE.test(title) && (!feed.only || feed.only.test(title));

// ------------------------------------------------------------------ places

const US: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};
const REGIONS: Record<string, string> = {
  AB: "CA", BC: "CA", MB: "CA", NB: "CA", NL: "CA", NS: "CA", ON: "CA", PE: "CA", QC: "CA", SK: "CA", YT: "CA",
  alberta: "CA", "british columbia": "CA", manitoba: "CA", "new brunswick": "CA", newfoundland: "CA", "nova scotia": "CA",
  ontario: "CA", quebec: "CA", québec: "CA", saskatchewan: "CA",
  NSW: "AU", VIC: "AU", QLD: "AU", TAS: "AU", "new south wales": "AU", victoria: "AU", queensland: "AU", tasmania: "AU",
  "western australia": "AU", "south australia": "AU",
};
const ALIASES: Record<string, string> = {
  usa: "US", us: "US", "u.s.": "US", "u.s.a.": "US", "united states of america": "US", america: "US",
  uk: "GB", "u.k.": "GB", england: "GB", scotland: "GB", wales: "GB", "northern ireland": "GB", "great britain": "GB",
  uae: "AE", korea: "KR", "south korea": "KR", "czech republic": "CZ", turkey: "TR", türkiye: "TR", holland: "NL", deutschland: "DE",
};

let countryNames: Map<string, string> | null = null;
function countryByName(name: string): string | null {
  if (!countryNames) {
    countryNames = new Map();
    const display = new Intl.DisplayNames(["en"], { type: "region" });
    for (let a = 65; a <= 90; a++)
      for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a, b);
        try {
          const n = display.of(code);
          // First code wins: "United Kingdom" is GB, not the reserved UK.
          if (n && n !== code && !countryNames.has(n.toLowerCase())) countryNames.set(n.toLowerCase(), code);
        } catch {
          // not a region code
        }
      }
  }
  return countryNames.get(name.toLowerCase()) ?? null;
}

const STATE_NAMES = new Map(Object.entries(US).map(([code, name]) => [name.toLowerCase(), code]));

/** Country of one part of a place ("TX", "Texas", "Finland", "IS", "United States"), or null. */
function countryOf(part: string, allowIso: boolean): string | null {
  const p = part.trim();
  const low = p.toLowerCase();
  if (US[p] || STATE_NAMES.has(low)) return "US";
  if (REGIONS[p] || REGIONS[low]) return REGIONS[p] ?? REGIONS[low];
  if (ALIASES[low]) return ALIASES[low];
  const named = countryByName(p);
  if (named) return named;
  if (allowIso && /^[A-Z]{2}$/.test(p) && countryByName(new Intl.DisplayNames(["en"], { type: "region" }).of(p) ?? "") === p) return p;
  return null;
}

const CITY_STATES = new Set(["SG", "HK", "MO", "MC", "LU"]);
const isRegionOnly = (part: string) => Boolean(US[part.trim()] || STATE_NAMES.has(part.trim().toLowerCase()) || REGIONS[part.trim()] || REGIONS[part.trim().toLowerCase()]);

/**
 * "Memphis, TN" -> Memphis, US. "Lappeenranta, Finland" -> Lappeenranta, FI. "Arvada, CO - US" -> Arvada, US.
 * Several places: the first one. Remote or unplaceable: null.
 */
export function parsePlace(raw: string | null | undefined): { city: string; country: string } | null {
  if (!raw) return null;
  for (const segment of raw.split(/;|\||\s\/\s|\s+or\s+|\n/i)) {
    const place = parseOne(segment);
    if (place) return place;
  }
  return null;
}

/** Big cities that feeds often name alone, without a country. */
const KNOWN_CITIES: Record<string, string> = {
  batam: "ID", jakarta: "ID", "johor bahru": "MY", "kuala lumpur": "MY", cyberjaya: "MY", sydney: "AU", "western sydney": "AU", melbourne: "AU",
  london: "GB", dublin: "IE", amsterdam: "NL", frankfurt: "DE", paris: "FR", madrid: "ES", milan: "IT", stockholm: "SE", oslo: "NO",
  copenhagen: "DK", helsinki: "FI", reykjavik: "IS", toronto: "CA", montreal: "CA", dubai: "AE", riyadh: "SA", mumbai: "IN",
  bangkok: "TH", manila: "PH", seoul: "KR", "são paulo": "BR", "sao paulo": "BR", "mexico city": "MX",
};

function parseOne(segment: string): { city: string; country: string } | null {
  const text = segment.replace(/\([^)]*\)/g, " ").replace(/\b(remote|hybrid|on-?site|onsite)\b(-friendly)?\s*[-:]?/gi, " ").trim();
  const parts = text.split(/,|\s[-–]\s/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  for (let i = parts.length - 1; i >= 0; i--) {
    const country = countryOf(parts[i], i > 0);
    if (!country) continue;
    const city = parts.slice(0, i).find((p) => !countryOf(p, false) || isRegionOnly(p)) ?? (CITY_STATES.has(country) ? parts[i] : undefined);
    if (!city || city.length > 60) return null;
    return { city, country };
  }
  const known = KNOWN_CITIES[parts[0].toLowerCase()];
  return known && parts.length === 1 ? { city: parts[0], country: known } : null;
}

// ------------------------------------------------------------------ text

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "-", mdash: "-", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', hellip: "...", bull: "•", middot: "·" };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

/** HTML to plain paragraphs (the job page shows text, never the employer's HTML). */
export function htmlToText(html: string): string {
  const text = decode(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|ul|ol|tr|section)>/gi, "\n\n")
      .replace(/<[^>]+>/g, ""),
  );
  return tidy(text);
}

const tidy = (text: string) =>
  text
    .replace(/[—–]/g, "-")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const MAX_DESCRIPTION = 6000;
function clip(text: string): string {
  if (text.length <= MAX_DESCRIPTION) return text;
  const cut = text.slice(0, MAX_DESCRIPTION);
  return `${cut.slice(0, Math.max(cut.lastIndexOf("\n\n"), MAX_DESCRIPTION - 600)).trim()}\n\n...`;
}

// ------------------------------------------------------------------ feeds

export type FeedListing = { sourceId: string; title: string; raw: unknown };
export type FeedJob = {
  sourceId: string;
  title: string;
  employment: "full_time" | "part_time" | "contract" | "temporary";
  city: string;
  country: string;
  payMin: number | null;
  payMax: number | null;
  payCurrency: string;
  payUnit: "hour" | "month" | "year";
  description: string;
  applyUrl: string;
  postedAt: Date | null;
};

const UA = "Mozilla/5.0 (compatible; IttsuiWorksJobs/1.0; +https://ittsuiworks.com)";
async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function employmentOf(value: string | undefined, title: string): FeedJob["employment"] {
  const v = `${value ?? ""} ${title}`.toLowerCase();
  if (/contract|contractor/.test(v)) return "contract";
  if (/temporary|\btemp\b|seasonal/.test(v)) return "temporary";
  if (/part[\s-]?time|parttime/.test(v)) return "part_time";
  return "full_time";
}

const unitOf = (interval: string | undefined): FeedJob["payUnit"] | null => {
  const v = (interval ?? "").toLowerCase();
  if (/hour/.test(v)) return "hour";
  if (/month/.test(v)) return "month";
  if (/year|annual|salary/.test(v)) return "year";
  return null;
};

type Pay = Pick<FeedJob, "payMin" | "payMax" | "payCurrency" | "payUnit">;
/** Employers sometimes label an hourly wage as a salary (21 to 23 "a year"): the amount decides. */
function sanePay(p: Pay): Pay {
  const top = Number(p.payMax ?? p.payMin ?? 0);
  if (!top) return { ...p, payMin: null, payMax: null };
  const payUnit = p.payUnit === "year" && top < 1000 ? "hour" : p.payUnit === "hour" && top > 1000 ? "year" : p.payUnit;
  return { ...p, payUnit, payMax: p.payMax !== null && p.payMax === p.payMin ? null : p.payMax };
}
/** A page with almost no text helps nobody and search engines skip it. */
const MIN_DESCRIPTION = 200;
const finish = (job: FeedJob): FeedJob | null => (job.description.length < MIN_DESCRIPTION ? null : { ...job, ...sanePay(job) });
const noPay = (): Pay => ({ payMin: null, payMax: null, payCurrency: "USD", payUnit: "hour" });
const validDate = (v: unknown) => {
  const d = v ? new Date(v as string | number) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

/** The feed's listings that are technician jobs in our trades (titles only, one request per employer). */
export async function listFeed(feed: Feed): Promise<FeedListing[]> {
  let all: FeedListing[] = [];
  if (feed.ats === "greenhouse") {
    const d = (await getJson(`https://boards-api.greenhouse.io/v1/boards/${feed.slug}/jobs`)) as { jobs?: { id: number; title: string }[] };
    all = (d.jobs ?? []).map((j) => ({ sourceId: String(j.id), title: j.title, raw: j }));
  } else if (feed.ats === "lever") {
    const d = (await getJson(`https://api.lever.co/v0/postings/${feed.slug}?mode=json`)) as { id: string; text: string }[];
    all = (Array.isArray(d) ? d : []).map((j) => ({ sourceId: j.id, title: j.text, raw: j }));
  } else {
    const d = (await getJson(`https://api.ashbyhq.com/posting-api/job-board/${feed.slug}?includeCompensation=true`)) as { jobs?: { id: string; title: string; isListed?: boolean }[] };
    all = (d.jobs ?? []).filter((j) => j.isListed !== false).map((j) => ({ sourceId: j.id, title: j.title, raw: j }));
  }
  return all.filter((l) => l.title && isTechJob(feed, l.title.trim()));
}

/** One listing in full, ready to publish, or null when it has no real place (remote, or unknown country). */
export async function jobFromListing(feed: Feed, listing: FeedListing): Promise<FeedJob | null> {
  const title = tidy(listing.title).slice(0, 140);
  if (feed.ats === "greenhouse") {
    type G = { content?: string; absolute_url?: string; location?: { name?: string }; updated_at?: string; first_published?: string; pay_input_ranges?: { min_cents: number; max_cents: number; currency_type: string }[] };
    const j = (await getJson(`https://boards-api.greenhouse.io/v1/boards/${feed.slug}/jobs/${listing.sourceId}?pay_transparency=true`)) as G;
    const place = parsePlace(j.location?.name);
    if (!place || !j.absolute_url) return null;
    const range = j.pay_input_ranges?.[0];
    const pay: Pay = range
      ? { payMin: range.min_cents / 100 || null, payMax: range.max_cents / 100 || null, payCurrency: range.currency_type || "USD", payUnit: range.max_cents / 100 < 300 ? "hour" : "year" }
      : noPay();
    return finish({ sourceId: listing.sourceId, title, employment: employmentOf(undefined, title), ...place, ...pay, description: clip(htmlToText(decode(j.content ?? ""))), applyUrl: j.absolute_url, postedAt: validDate(j.first_published ?? j.updated_at) });
  }
  if (feed.ats === "lever") {
    type L = { country?: string; categories?: { location?: string; commitment?: string }; descriptionPlain?: string; description?: string; openingPlain?: string; descriptionBodyPlain?: string; lists?: { text: string; content: string }[]; additionalPlain?: string; hostedUrl?: string; createdAt?: number; salaryRange?: { min?: number; max?: number; currency?: string; interval?: string }; workplaceType?: string };
    const j = listing.raw as L;
    if (j.workplaceType === "remote") return null;
    const parsed = parsePlace(j.categories?.location);
    const country = j.country && /^[A-Z]{2}$/.test(j.country) ? j.country : parsed?.country;
    const location = j.categories?.location ?? "";
    const city = parsed?.city ?? (/remote/i.test(location) ? undefined : location.split(",")[0]?.trim());
    if (!country || !city || !j.hostedUrl) return null;
    const unit = unitOf(j.salaryRange?.interval);
    const pay: Pay = j.salaryRange && unit && (j.salaryRange.min || j.salaryRange.max) ? { payMin: j.salaryRange.min ?? null, payMax: j.salaryRange.max ?? null, payCurrency: j.salaryRange.currency || "USD", payUnit: unit } : noPay();
    const lists = (j.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`).join("\n\n");
    const intro = j.descriptionPlain?.trim() || [j.openingPlain, j.descriptionBodyPlain].filter(Boolean).join("\n\n").trim() || htmlToText(j.description ?? "");
    return finish({ sourceId: listing.sourceId, title, employment: employmentOf(j.categories?.commitment, title), city, country, ...pay, description: clip(tidy([intro, lists, j.additionalPlain].filter(Boolean).join("\n\n"))), applyUrl: j.hostedUrl, postedAt: validDate(j.createdAt) });
  }
  type A = { location?: string; isRemote?: boolean; workplaceType?: string; address?: { postalAddress?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } }; descriptionPlain?: string; descriptionHtml?: string; jobUrl?: string; publishedAt?: string; employmentType?: string; compensation?: { summaryComponents?: { compensationType?: string; interval?: string; currencyCode?: string; minValue?: number; maxValue?: number }[] } };
  const j = listing.raw as A;
  if (j.isRemote && j.workplaceType === "Remote") return null;
  const a = j.address?.postalAddress;
  const fromAddress = a?.addressCountry ? parsePlace([a.addressLocality, a.addressRegion, a.addressCountry].filter(Boolean).join(", ")) : null;
  const place = fromAddress ?? parsePlace(j.location);
  if (!place || !j.jobUrl) return null;
  const salary = j.compensation?.summaryComponents?.find((c) => /salary|hourly|base/i.test(c.compensationType ?? ""));
  const unit = unitOf(salary?.interval);
  const pay: Pay = salary && unit && (salary.minValue || salary.maxValue) ? { payMin: salary.minValue ?? null, payMax: salary.maxValue ?? null, payCurrency: salary.currencyCode || "USD", payUnit: unit } : noPay();
  return finish({ sourceId: listing.sourceId, title, employment: employmentOf(j.employmentType, title), ...place, ...pay, description: clip(j.descriptionPlain ? tidy(j.descriptionPlain) : htmlToText(j.descriptionHtml ?? "")), applyUrl: j.jobUrl, postedAt: validDate(j.publishedAt) });
}
