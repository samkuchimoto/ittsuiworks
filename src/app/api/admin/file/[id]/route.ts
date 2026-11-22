import { connection } from "next/server";
import type { NextRequest } from "next/server";
import { isAdmin } from "@/lib/admin-session";
import { hasDatabase } from "@/lib/db";
import { getFile } from "@/lib/pipeline";

/** A résumé or license a technician uploaded, for a signed-in admin only (/api/admin/file/<id>). Always a download. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/admin/file/[id]">) {
  await connection();
  const { id } = await ctx.params;
  if (!(await isAdmin()) || !hasDatabase() || !/^[a-z0-9]{6,12}$/.test(id)) return new Response("Not found", { status: 404 });
  const file = await getFile(id);
  if (!file) return new Response("Not found", { status: 404 });
  const name = file.name.replace(/[^\w. -]/g, "_");
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
