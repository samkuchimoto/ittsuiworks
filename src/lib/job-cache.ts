/**
 * Cached job pages (Samuel, 16 Nov 2026, hosting fix 1). A job page (/[lang]/jobs/[id]) is built once and kept until its
 * job changes, or for a week at most (JOB_PAGE_SECONDS), instead of being rebuilt on every visit. Whatever changes a job's
 * status calls refreshJobPages with the job ids: closed, renewed, featured, gone live, expired, ended by its employer's
 * careers page, revived by an import, deleted. Application tracking (/api/go), the apply form, account and admin pages
 * and the filtered job search are not cached.
 */
import "server-only";
import { revalidatePath } from "next/cache";
import { locales } from "@/lib/site";

/** The longest a job page is kept without a change (the job's status and expiry are checked in the browser too). */
export const JOB_PAGE_SECONDS = 7 * 24 * 3600;

/**
 * Marks these jobs' pages (every language) for a rebuild on their next visit. Next.js only allows this in route handlers
 * and server actions; called from a page render it is skipped (logged), and the daily check refreshes recent changes.
 */
export function refreshJobPages(ids: (string | null | undefined)[]): number {
  const clean = [...new Set(ids.filter((id): id is string => typeof id === "string" && /^[a-z0-9x]{6,12}$/.test(id)))];
  if (clean.length === 0) return 0;
  try {
    for (const id of clean) for (const lang of locales) revalidatePath(`/${lang}/jobs/${id}`);
    revalidatePath("/sitemap.xml");
    return clean.length;
  } catch (error) {
    console.warn("[job-cache] refresh skipped:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return 0;
  }
}
