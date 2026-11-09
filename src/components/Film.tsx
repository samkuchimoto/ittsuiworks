"use client";

import { useEffect, useRef, useState } from "react";
import { PlayIcon } from "./Icons";

/**
 * The night film: silent, looping, and playing only while on screen. Visitors who asked for
 * reduced motion or data saving see the still frame and a play button instead.
 */
export function Film({ alt, play }: { alt: string; play: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || saveData) {
      setHeld(true);
      return;
    }
    video.preload = "auto";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.muted = true;
          video.play().catch(() => setHeld(true));
        } else video.pause();
      },
      { rootMargin: "120px" },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  const start = () => {
    const video = ref.current;
    if (!video) return;
    video.muted = true;
    video.play().then(() => setHeld(false)).catch(() => {});
  };

  return (
    <div className="relative size-full">
      <video
        ref={ref}
        className="size-full object-cover"
        src="/media/film-night.mp4"
        poster="/media/film-night-poster.webp"
        muted
        loop
        playsInline
        preload="none"
        aria-label={alt}
      />
      {held && (
        <button type="button" onClick={start} className="absolute right-5 top-5 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-navy">
          <PlayIcon className="size-3.5" /> {play}
        </button>
      )}
    </div>
  );
}
