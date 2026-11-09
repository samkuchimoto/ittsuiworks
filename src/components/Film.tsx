"use client";

import { useEffect, useRef, useState } from "react";
import { PlayIcon } from "./Icons";

/**
 * A silent looping film that plays only while on screen. Visitors who asked for reduced motion or data
 * saving see the still frame; a story film then offers a play button, a background film stays still.
 */
export function Film({
  name,
  alt,
  play,
  className = "size-full object-cover",
}: {
  /** public/media/<name>.mp4 and <name>-poster.webp */
  name: string;
  /** Description for a story film. Omit for a background film, which is hidden from screen readers. */
  alt?: string;
  play?: string;
  className?: string;
}) {
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

  const decorative = !alt;
  return (
    <>
      <video
        ref={ref}
        className={className}
        src={`/media/${name}.mp4`}
        poster={`/media/${name}-poster.webp`}
        muted
        loop
        playsInline
        preload="none"
        aria-label={alt}
        aria-hidden={decorative || undefined}
      />
      {held && !decorative && play && (
        <button type="button" onClick={start} className="absolute right-5 top-5 z-10 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-navy">
          <PlayIcon className="size-3.5" /> {play}
        </button>
      )}
    </>
  );
}
