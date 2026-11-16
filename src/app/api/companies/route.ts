/**
 * Retired on 16 November 2026 (Samuel): Ittsui Works no longer sells project leads. Commercial projects go to
 * /api/inquiries (kind=project) and trade companies apply as partners (kind=partner); a person confirms agreements,
 * licenses and insurance before any introduction. The old self-serve flow stays in lib/market.ts, switched off.
 */
export function POST() {
  return Response.json({ ok: false, error: "gone" }, { status: 410 });
}
