import { hasDatabase } from "@/lib/db";
import { dailyOutreach, outreachConfig } from "@/lib/outreach";

export const maxDuration = 300;

/**
 * Cold email on its own (Samuel, 16 November 2026: separate marketing outreach from the operational daily run).
 * Finds companies, reads the outreach mailbox (bounces, STOP replies) and sends the day's batch, in that order, so any
 * STOP reply is honoured before a send. NOT scheduled: vercel.json has no entry for this path, so nothing runs until
 * Samuel restarts outreach (add the cron entry AND set OUTREACH.paused = false). Vercel's call carries CRON_SECRET;
 * anyone else only sees the switches.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorized = Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
  if (!authorized || !hasDatabase()) return Response.json({ scheduled: false, outreach: outreachConfig() });
  const outreach = await dailyOutreach().catch((error) => ({ error: error instanceof Error ? error.message : "unknown" }));
  return Response.json({ scheduled: false, outreach });
}
