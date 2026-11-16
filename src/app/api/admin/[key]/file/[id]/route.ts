import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import type { NextRequest } from "next/server";
import { hasDatabase } from "@/lib/db";
import { getFile } from "@/lib/pipeline";

const keyOk = (key: string) => {
  const secret = process.env.ADMIN_KEY ?? "";
  if (secret.length < 24 || key.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(key), Buffer.from(secret));
};

/** A résumé or license a technician uploaded, for Samuel only (/api/admin/<ADMIN_KEY>/file/<id>). Always a download. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/admin/[key]/file/[id]">) {
  await connection();
  const { key, id } = await ctx.params;
  if (!keyOk(key) || !hasDatabase() || !/^[a-z0-9]{6,12}$/.test(id)) return new Response("Not found", { status: 404 });
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
