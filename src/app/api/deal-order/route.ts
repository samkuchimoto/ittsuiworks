import { checkBotId } from "botid/server";
import { readAttribution } from "@/lib/attribution";
import { createDealOrder, parseDealOrder } from "@/lib/deal";
import { fail, readForm, refuse } from "@/lib/guard";
import { clientIp } from "@/lib/rate-limit";

export const maxDuration = 30;

/**
 * An official order from /deal (Samuel, 22 Nov 2026). Same-site posts only, 8 per IP every 10 minutes, a hidden bot
 * field, the fields checked here, then Vercel BotID. The order is stored with its reference, IP and review flag, then
 * both emails go out (lib/deal.ts). Nothing is charged and no bank detail is ever sent from here.
 */
export async function POST(request: Request) {
  const refused = refuse(request, "deal-order", 8);
  if (refused) return refused;
  const form = await readForm(request);
  if (form === "bot") return Response.json({ ok: true });
  if (!form) return fail("bad_request", 400);

  const parsed = parseDealOrder(form);
  if ("invalid" in parsed) return fail("invalid", 400, parsed.invalid);

  if (!(await isHuman())) return fail("bot", 403);

  try {
    const { reference } = await createDealOrder(parsed.order, { ip: clientIp(request), userAgent: request.headers.get("user-agent") ?? "", attribution: readAttribution(form) });
    return Response.json({ ok: true, reference });
  } catch (error) {
    console.error("[deal] order failed:", error instanceof Error ? error.message : "unknown");
    return fail("server", 500);
  }
}

/**
 * Vercel BotID (https://vercel.com/docs/botid; Basic mode, free, no keys). The page's script (src/instrumentation-client.ts)
 * marks the order request as coming from a real browser; a script, curl or a copy of the form elsewhere is a bot. The
 * order emails whatever address is typed, so a failed check refuses the order rather than letting it through.
 * On a computer BotID always answers "human"; BOTID_DEV_BYPASS=BAD-BOT makes it answer "bot" to try the refusal
 * (BotID ignores this in production).
 */
async function isHuman(): Promise<boolean> {
  try {
    const verification = await checkBotId({ developmentOptions: { bypass: process.env.BOTID_DEV_BYPASS === "BAD-BOT" ? "BAD-BOT" : "HUMAN" } });
    if (verification.isBot) console.info("[deal] BotID refused an order");
    return !verification.isBot;
  } catch (error) {
    console.error("[deal] BotID check failed:", error instanceof Error ? error.message : "unknown");
    return false;
  }
}
