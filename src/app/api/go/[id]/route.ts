import { connection } from "next/server";
import type { NextRequest } from "next/server";
import { countApplyClick, isPerson, trackedApplyUrl } from "@/lib/clicks";
import { getJob, isLive } from "@/lib/market";
import { SITE_URL, pathFor } from "@/lib/site";

/**
 * "Apply with the employer": counts the click and sends the technician on to the employer's own page, tagged with
 * Ittsui Works as the source (lib/clicks.ts). A job that ended, or has no web link, goes back to its page here.
 */
async function go(request: NextRequest, id: string, count: boolean): Promise<Response> {
  await connection();
  const job = await getJob(id);
  if (!job) return Response.redirect(`${SITE_URL}/jobs`, 302);
  if (!isLive(job) || !/^https?:\/\//i.test(job.apply_url)) return Response.redirect(`${SITE_URL}${pathFor(job.lang === "ja" ? "ja" : "en", `/jobs/${job.id}`)}`, 302);
  if (count && isPerson(request.headers.get("user-agent"))) {
    await countApplyClick(job.id).catch((error) => console.error("[go] count failed:", error instanceof Error ? error.message : "unknown"));
  }
  return new Response(null, { status: 302, headers: { Location: trackedApplyUrl(job.apply_url), "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

export async function GET(request: NextRequest, ctx: RouteContext<"/api/go/[id]">) {
  return go(request, (await ctx.params).id, true);
}

/** Link checkers ask with HEAD: same answer, never counted. */
export async function HEAD(request: NextRequest, ctx: RouteContext<"/api/go/[id]">) {
  return go(request, (await ctx.params).id, false);
}
