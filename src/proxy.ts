import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE } from "@/lib/site";

/**
 * English lives at the root (/privacy), Japanese under /ja (/ja/privacy). Every page sits in
 * app/[lang], so an unprefixed URL is rewritten to /en internally; visitors never see /en.
 * A browser that prefers Japanese, with no language picked yet, is sent once to /ja.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/ja" || pathname.startsWith("/ja/")) return NextResponse.next();

  const url = request.nextUrl.clone();
  if (prefersJapanese(request)) {
    url.pathname = pathname === "/" ? "/ja" : `/ja${pathname}`;
    return NextResponse.redirect(url);
  }
  url.pathname = pathname === "/" ? "/en" : `/en${pathname}`;
  return NextResponse.rewrite(url);
}

function prefersJapanese(request: NextRequest) {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  if (saved === "ja" || saved === "en") return saved === "ja";
  // "ja,en-US;q=0.9" -> the first of ja / en by weight.
  const ranked = (request.headers.get("accept-language") ?? "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { base: tag.split("-")[0].toLowerCase(), q: q ? Number(q.trim().slice(2)) : 1 };
    })
    .filter((entry) => (entry.base === "ja" || entry.base === "en") && entry.q > 0)
    .sort((a, b) => b.q - a.q);
  return ranked[0]?.base === "ja";
}

export const config = {
  // Skip API routes, Next internals, metadata files and anything with a file extension.
  matcher: ["/((?!api|_next|icon|apple-icon|.*\\..*).*)"],
};
