"use client";

import { useEffect } from "react";
import { captureAttribution } from "@/lib/attribution";

/** Notes which outreach link or website brought this visit, for the tab's session only (lib/attribution.ts). */
export function Attribution() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
