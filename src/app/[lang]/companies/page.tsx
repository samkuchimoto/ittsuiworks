import { permanentRedirect } from "next/navigation";
import { isLocale, pathFor } from "@/lib/site";

/** "Get project leads" retired on 16 November 2026: trade companies now apply as partners on /join. */
export default async function Companies({ params }: PageProps<"/[lang]/companies">) {
  const { lang } = await params;
  permanentRedirect(`${pathFor(isLocale(lang) ? lang : "en", "/join")}#partner`);
}
