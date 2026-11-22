import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * The one check behind every admin page, button and file download (ADMIN_KEY, 24 characters or more). Compared in
 * constant time, so response times never hint at how much of a guess was right. A missing or short key opens nothing.
 */
export function isAdminKey(candidate: string): boolean {
  const secret = Buffer.from(process.env.ADMIN_KEY ?? "");
  const given = Buffer.from(candidate);
  if (secret.length < 24 || given.length !== secret.length) return false;
  return timingSafeEqual(given, secret);
}
