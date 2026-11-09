"use client";

import { useEffect } from "react";

/**
 * Sections rise in as they reach the screen. The page is fully visible without JavaScript: only after
 * hydration are elements below the fold hidden. Anything above the bottom of the screen is revealed,
 * so a jump from the menu never leaves a section hidden behind it.
 */
export function Reveal() {
  useEffect(() => {
    let pending = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
    const sweep = () => {
      const line = window.innerHeight * 0.94;
      pending = pending.filter((el) => {
        if (el.getBoundingClientRect().top < line) {
          el.classList.add("is-in");
          return false;
        }
        return true;
      });
      if (!pending.length) stop();
    };
    let frame = 0;
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(() => ((frame = 0), sweep()));
    };
    const stop = () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    sweep();
    document.documentElement.classList.add("js");
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      stop();
    };
  }, []);
  return null;
}
