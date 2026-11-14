import { IMPORT } from "@/lib/config";
import { hasDatabase } from "@/lib/db";
import { importJobs } from "@/lib/importer";

export const maxDuration = 300;

/**
 * The daily job import (vercel.json cron, 10:00 UTC): technician jobs from employers' public careers pages
 * (lib/feeds.ts, lib/importer.ts). Vercel calls it with CRON_SECRET; anyone else only sees whether it is on.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorized = Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
  if (!authorized || !hasDatabase()) return Response.json({ on: IMPORT.on });
  const result = await importJobs().catch((error) => ({ error: error instanceof Error ? error.message : "unknown" }));
  return Response.json(result);
}
