"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Job pages are cached (hosting fix 1, 16 Nov 2026), so a job can reach its end date while its page is cached. This shows
 * its children while the job is open and swaps them for `closed` the moment expiresAt passes, checked in the browser.
 */
export function LiveUntil({ expiresAt, closed, children }: { expiresAt: string; closed: ReactNode; children: ReactNode }) {
  const [over, setOver] = useState(false);
  useEffect(() => {
    const left = new Date(expiresAt).getTime() - Date.now();
    if (left <= 0) {
      setOver(true);
      return;
    }
    if (left < 2 ** 31 - 1) {
      const timer = setTimeout(() => setOver(true), left);
      return () => clearTimeout(timer);
    }
  }, [expiresAt]);
  return <>{over ? closed : children}</>;
}
