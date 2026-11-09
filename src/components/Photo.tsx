/** A photo from public/media, served at the width the screen needs. Sizes come from scripts/media.mjs. */
const WIDTHS: Record<string, number[]> = { hero: [720, 1100, 1672], other: [720, 1100] };

export function Photo({
  name,
  alt,
  sizes,
  className = "",
  priority = false,
}: {
  name: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  const widths = name.startsWith("hero-") ? WIDTHS.hero : WIDTHS.other;
  const src = (w: number) => `/media/${name}-${w}.webp`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src(widths[1])}
      srcSet={widths.map((w) => `${src(w)} ${w}w`).join(", ")}
      sizes={sizes}
      alt={alt}
      width={1672}
      height={941}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={className}
    />
  );
}
