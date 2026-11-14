import { hasDatabase } from "@/lib/db";
import { setAlert } from "@/lib/market";
import { unsubscribeProspect } from "@/lib/outreach";

/**
 * One-click unsubscribe (RFC 8058): mail apps POST here from the List-Unsubscribe header.
 * k=alert: a job alert (t = its token). k=prospect: outreach (t = the prospect id, added to the stop list).
 * A GET (a person clicking the link) shows a page with a confirm button, so link scanners unsubscribe nobody.
 */
async function stop(kind: string, token: string) {
  if (!hasDatabase()) return;
  if (kind === "alert") await setAlert(token, false);
  else if (kind === "prospect") await unsubscribeProspect(token);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  let kind = url.searchParams.get("k") ?? "";
  let token = url.searchParams.get("t") ?? "";
  const fromPage = (request.headers.get("content-type") ?? "").includes("form");
  if (fromPage) {
    try {
      const form = await request.formData();
      kind = String(form.get("k") ?? kind);
      token = String(form.get("t") ?? token);
    } catch {
      // The one-click body ("List-Unsubscribe=One-Click") carries nothing we need.
    }
  }
  await stop(kind, token.slice(0, 40));
  const page = new URL("/unsubscribe", request.url);
  page.searchParams.set("done", "1");
  return request.headers.get("sec-fetch-mode") === "navigate" ? Response.redirect(page.href, 303) : Response.json({ ok: true });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = new URL("/unsubscribe", request.url);
  page.searchParams.set("k", url.searchParams.get("k") ?? "");
  page.searchParams.set("t", url.searchParams.get("t") ?? "");
  return Response.redirect(page.href, 303);
}
