/** The Stripe client, from STRIPE_SECRET_KEY only (never print or log the key). */
import "server-only";
import Stripe from "stripe";

export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // Local tests only: a mock Stripe server (never set on Vercel).
  const mock = process.env.STRIPE_MOCK_URL;
  if (mock?.startsWith("http://localhost")) {
    const url = new URL(mock);
    return new Stripe(key, { host: url.hostname, port: Number(url.port), protocol: "http" });
  }
  return new Stripe(key);
}
