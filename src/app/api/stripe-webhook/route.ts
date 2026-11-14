import type Stripe from "stripe";
import { checkoutPaid } from "@/lib/market";
import { stripeClient } from "@/lib/stripe";

/**
 * Stripe calls this when a Checkout payment succeeds (backup to the return page and the daily check).
 * Set up in Stripe: event destination https://ittsuiworks.com/api/stripe-webhook, events checkout.session.completed
 * and checkout.session.async_payment_succeeded; its signing secret goes in Vercel as STRIPE_WEBHOOK_SECRET.
 * Only Ittsui Works payments (metadata.site = ittsuiworks) are handled.
 */
export async function POST(request: Request) {
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return new Response("not configured", { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("no signature", { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return new Response("invalid signature", { status: 400 });
  }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.site === "ittsuiworks") {
      try {
        await checkoutPaid(session);
      } catch (error) {
        console.error("[stripe-webhook] failed:", error instanceof Error ? error.message : "unknown");
        return new Response("retry", { status: 500 });
      }
    }
  }
  return Response.json({ received: true });
}
