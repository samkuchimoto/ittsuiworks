import type { Locale } from "@/lib/site";
import { en, type Dict } from "./en";
import { ja } from "./ja";

const dictionaries: Record<Locale, Dict> = { en, ja };

export const getDictionary = (lang: Locale): Dict => dictionaries[lang];
export type { Dict };

/** Fills "{name}" placeholders. Unknown names stay as they are, so a missing value shows up in testing. */
export const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
