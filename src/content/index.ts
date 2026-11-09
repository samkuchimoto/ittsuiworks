import type { Locale } from "@/lib/site";
import { en, type Dict } from "./en";
import { ja } from "./ja";

const dictionaries: Record<Locale, Dict> = { en, ja };

export const getDictionary = (lang: Locale): Dict => dictionaries[lang];
export type { Dict };
