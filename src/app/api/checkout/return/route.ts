import { confirmCheckout } from "@/lib/market";
import { SITE_URL } from "@/lib/site";

/** Stripe sends the payer back here; the payment is checked with Stripe, recorded, and the payer sent on. */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("session_id") ?? "";
  try {
    return Response.redirect(await confirmCheckout(id), 303);
  } catch (error) {
    console.error("[checkout-return] failed:", error instanceof Error ? error.message : "unknown");
    return Response.redirect(SITE_URL, 303);
  }
}
