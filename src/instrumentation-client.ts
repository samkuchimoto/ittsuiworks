import { initBotId } from "botid/client/core";

/**
 * Vercel BotID (https://vercel.com/docs/botid, 22 Nov 2026): an invisible check that the deal order comes from a
 * person's browser. No keys, no account, free (Basic) on every Vercel plan. Every route that calls checkBotId() on the
 * server must be listed here, or that check fails.
 */
initBotId({ protect: [{ path: "/api/deal-order", method: "POST" }] });
