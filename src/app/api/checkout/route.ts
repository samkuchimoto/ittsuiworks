import { leadCheckout, sponsorCheckout } from "@/lib/market";
import { SITE_URL } from "@/lib/site";

/**
 * Plain HTML form posts from the lead page ("Take this lead") and the account page ("Feature this job").
 * Prices come from lib/config.ts, never from the browser. Answers with a redirect to Stripe Checkout.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response("bad request", { status: 400 });
  }
  const kind = String(form.get("kind") ?? "");
  const back = String(form.get("back") ?? "/");
  const safeBack = back.startsWith("/") && !back.startsWith("//") ? back : "/";
  try {
    const url =
      kind === "lead"
        ? await leadCheckout(String(form.get("token") ?? ""))
        : kind === "sponsor"
          ? await sponsorCheckout(String(form.get("account") ?? ""), String(form.get("job") ?? ""))
          : null;
    return Response.redirect(url ?? `${SITE_URL}${safeBack}`, 303);
  } catch (error) {
    console.error("[checkout] failed:", error instanceof Error ? error.message : "unknown");
    return Response.redirect(`${SITE_URL}${safeBack}`, 303);
  }
}
