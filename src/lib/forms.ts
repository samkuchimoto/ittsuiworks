/** Shared by the two forms and the /api/contact route. */
export const COUNTRIES = ["us", "jp"] as const;
export const INDUSTRIES = ["hvac", "datacenter", "marine"] as const;
export const TRADES = ["hvac", "datacenter", "marine", "other"] as const;
export const NEEDS = ["clients", "technicians", "both"] as const;
export const KINDS = ["company", "technician"] as const;

export type Country = (typeof COUNTRIES)[number];
export type Industry = (typeof INDUSTRIES)[number];
export type Trade = (typeof TRADES)[number];
export type Need = (typeof NEEDS)[number];
