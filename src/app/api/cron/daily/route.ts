import { PRICING, paymentsOn } from "@/lib/config";
import { hasDatabase } from "@/lib/db";
import { mailConfigured, trySendMail } from "@/lib/mail";
import { dailyMarket, marketStats } from "@/lib/market";
import { dailyOutreach, outreachConfig, outreachStats } from "@/lib/outreach";

export const maxDuration = 300;

const flags = () => ({
  database: hasDatabase(),
  email: mailConfigured(),
  stripe: Boolean(process.env.STRIPE_SECRET_KEY),
  pricesApproved: PRICING.approved,
  payments: paymentsOn(),
  outreach: outreachConfig(),
});

/**
 * The daily run (vercel.json cron): jobs end, job alerts go out, open projects go to companies, missed payments
 * are recovered, outreach runs, and one summary email reaches the inbox. Vercel calls it with CRON_SECRET;
 * anyone else only sees which parts are switched on.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorized = Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
  if (!authorized || !hasDatabase()) return Response.json(flags());

  const market = await dailyMarket().catch((error) => ({ error: error instanceof Error ? error.message : "unknown" }));
  const outreach = await dailyOutreach().catch((error) => ({ error: error instanceof Error ? error.message : "unknown" }));
  const stats = await marketStats().catch(() => null);
  const prospects = await outreachStats().catch(() => ({}));

  await trySendMail({
    subject: `Ittsui Works daily: ${stats ? `${stats.liveJobs} live jobs, ${stats.applications} applications, ${stats.leadsSold} leads sold` : "check the run"}`,
    lines: [
      stats
        ? `Live jobs: ${stats.liveJobs} (${stats.newJobs} new). Applications (24 h): ${stats.applications}. Job alerts on: ${stats.alerts}.`
        : "Stats failed.",
      stats ? `Companies: ${stats.companies} (${stats.leadCompanies} with leads on). Projects: ${stats.openProjects} open, ${stats.waitingProjects} waiting, ${stats.newProjects} new. Leads sold (24 h): ${stats.leadsSold}.` : "",
      `Run: ${JSON.stringify(market)}`,
      `Outreach: ${JSON.stringify(outreach)}`,
      `Outreach queue: ${JSON.stringify(prospects)}`,
      `Switches: ${JSON.stringify(flags())}`,
    ],
  });
  return Response.json({ ...flags(), market, outreach, stats, prospects });
}
