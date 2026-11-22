import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { isAdminKey } from "./admin-key";
import { rateLimit } from "./rate-limit";

/**
 * Admin sign-in (22 Nov 2026), replacing the permanent /admin/<ADMIN_KEY> link: the key is typed once on /admin and
 * never appears in a URL, a page, a form field or the browser history. The browser then holds a signed session
 * cookie (HttpOnly, SameSite=Strict, Secure in production) that lasts SESSION_HOURS. Signed with a secret derived
 * from ADMIN_KEY, so changing ADMIN_KEY in Vercel signs every session out at once. Every admin page, button and file
 * download checks the session on the server.
 */
export const ADMIN_COOKIE = "iw_admin";
const SESSION_HOURS = 12;
const MAX_AGE_MS = SESSION_HOURS * 3600_000;

function secret(): Buffer | null {
  const key = process.env.ADMIN_KEY ?? "";
  return key.length >= 24 ? createHmac("sha256", key).update("ittsui-admin-session-v1").digest() : null;
}
const sign = (payload: string, key: Buffer) => createHmac("sha256", key).update(payload).digest("base64url");

/** A new session value: expiry, random nonce, signature. */
export function newSessionValue(now = Date.now()): string | null {
  const key = secret();
  if (!key) return null;
  const payload = `${now + MAX_AGE_MS}.${randomBytes(18).toString("base64url")}`;
  return `${payload}.${sign(payload, key)}`;
}

/** True for an unexpired value signed with the current ADMIN_KEY. */
export function validSessionValue(value: string | undefined, now = Date.now()): boolean {
  const key = secret();
  if (!key || !value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [expires, nonce, mac] = parts;
  const expected = Buffer.from(sign(`${expires}.${nonce}`, key));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  const at = Number(expires);
  return Number.isFinite(at) && at > now && at - now <= MAX_AGE_MS;
}

/** Is this request signed in as admin? For pages, server actions and route handlers. */
export async function isAdmin(): Promise<boolean> {
  return validSessionValue((await cookies()).get(ADMIN_COOKIE)?.value);
}

/**
 * Checks the typed key (constant time, 5 tries per IP every 10 minutes) and starts a session. Server actions only.
 * Returns false when refused.
 */
export async function signIn(typedKey: string): Promise<boolean> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`admin-login:${ip}`, 5)) return false;
  if (!isAdminKey(typedKey)) return false;
  const value = newSessionValue();
  if (!value) return false;
  (await cookies()).set(ADMIN_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return true;
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}
