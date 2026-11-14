import type { ReactNode } from "react";

/** The small orange label with a rule before it, above every section title. */
export function Label({ children, light = false, center = false }: { children: ReactNode; light?: boolean; center?: boolean }) {
  return (
    <p className={`flex items-center gap-3 text-[13px] font-bold uppercase tracking-[0.2em] ${light ? "text-amber" : "text-orange"} ${center ? "justify-center" : ""}`}>
      <span aria-hidden="true" className={`h-px w-8 ${light ? "bg-amber" : "bg-orange"}`} />
      {children}
    </p>
  );
}

/** Section title in the display serif. A "|" in the copy marks a deliberate line break. */
export function Title({ id, children, light = false, className = "", as: Tag = "h2" }: { id?: string; children: ReactNode; light?: boolean; className?: string; as?: "h1" | "h2" }) {
  return (
    <Tag id={id} className={`font-display mt-4 text-[34px] leading-[1.1] sm:text-[44px] lg:text-[52px] ${light ? "text-white" : "text-navy"} ${className}`}>
      {typeof children === "string" && children.includes("|")
        ? children.split("|").map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))
        : children}
    </Tag>
  );
}

/** The orange call to action with the arrow, used across the site. */
export function Cta({ href, children, tone = "orange", className = "" }: { href: string; children: ReactNode; tone?: "orange" | "navy" | "white"; className?: string }) {
  const tones = {
    orange: "bg-orange text-white shadow-[0_14px_32px_-14px_rgb(200_70_27/0.85)] hover:bg-orange-deep",
    navy: "bg-navy text-white shadow-[0_14px_32px_-16px_rgb(15_39_71/0.9)] hover:bg-navy-deep",
    white: "bg-white text-navy ring-1 ring-navy/15 hover:ring-navy",
  };
  return (
    <a href={href} className={`group inline-flex items-center gap-3 rounded-lg px-6 py-4 text-[16px] font-semibold transition ${tones[tone]} ${className}`}>
      {children}
      <svg viewBox="0 0 24 24" className="size-4 transition group-hover:translate-x-0.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </a>
  );
}
