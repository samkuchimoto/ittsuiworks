import type { Locale } from "./site";

/** ISO 3166-1 alpha-2 codes. Names come from the browser's own list (Intl.DisplayNames), in the page's language. */
export const COUNTRY_CODES = (
  "AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ " +
  "DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP " +
  "KE KG KH KI KM KN KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL " +
  "NO NP NR NZ OM PA PE PG PH PK PL PR PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM " +
  "TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS YE ZA ZM ZW"
).split(" ");

export const isCountry = (code: string) => COUNTRY_CODES.includes(code);

const cache = new Map<string, Intl.DisplayNames>();
export function countryName(code: string, lang: Locale | string = "en"): string {
  if (!cache.has(lang)) cache.set(lang, new Intl.DisplayNames([lang], { type: "region" }));
  try {
    return cache.get(lang)!.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Every country, sorted by its name in the page's language. */
export function countryOptions(lang: Locale): [string, string][] {
  return COUNTRY_CODES.map((code) => [code, countryName(code, lang)] as [string, string]).sort((a, b) => a[1].localeCompare(b[1], lang));
}

/** The currency a job in this country is most likely paid in. */
export function currencyFor(country: string): string {
  const map: Record<string, string> = {
    US: "USD", PR: "USD", JP: "JPY", GB: "GBP", CA: "CAD", AU: "AUD", NZ: "NZD", SG: "SGD", AE: "AED", SA: "SAR", KR: "KRW",
    IN: "INR", MX: "MXN", BR: "BRL", PH: "PHP", TH: "THB", CH: "CHF", NO: "NOK", SE: "SEK", DK: "DKK", PL: "PLN", HK: "HKD",
    TW: "TWD", MY: "MYR", ID: "IDR", VN: "VND", ZA: "ZAR",
  };
  const euro = "AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK".split(" ");
  return map[country] ?? (euro.includes(country) ? "EUR" : "USD");
}
