/** Ittsui Works mark: the Ittsui circle, with its two dots joined on one line. A pair that works as one. */
export function Mark({ className = "size-9", tone = "navy" }: { className?: string; tone?: "navy" | "white" }) {
  const ink = tone === "white" ? "#ffffff" : "#0f2747";
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="13.6" fill="none" stroke={ink} strokeWidth="2.3" />
      <line x1="10.2" y1="16" x2="21.8" y2="16" stroke={ink} strokeWidth="1.5" />
      <circle cx="10.2" cy="16" r="3.7" fill={ink} />
      <circle cx="21.8" cy="16" r="3.7" fill="#e59a3c" />
    </svg>
  );
}

export function Wordmark({ tone = "navy", className = "" }: { tone?: "navy" | "white"; className?: string }) {
  const white = tone === "white";
  return (
    <span className={`flex items-center gap-2.5 whitespace-nowrap sm:gap-3 ${className}`}>
      <Mark tone={tone} className="size-9 shrink-0 sm:size-10" />
      <span className="flex flex-col leading-none">
        <span lang="en" className={`font-[family-name:var(--font-newsreader)] text-[23px] font-medium sm:text-[27px] tracking-[-0.01em] ${white ? "text-white" : "text-navy"}`}>
          Ittsui Works
        </span>
        <span lang="ja" className={`mt-1 font-[family-name:var(--font-mincho)] text-[11.5px] font-semibold tracking-[0.3em] ${white ? "text-white/70" : "text-mute"}`}>
          一対ワークス
        </span>
      </span>
    </span>
  );
}
