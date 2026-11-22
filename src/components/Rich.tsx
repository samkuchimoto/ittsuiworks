/** Copy with "**bold**" marks (content/deal.ts): the marked parts in semibold, everything else as plain text. */
export function Rich({ text, strong = "font-semibold text-navy" }: { text: string; strong?: string }) {
  return (
    <>
      {text.split("**").map((part, i) =>
        i % 2 ? (
          <strong key={i} className={strong}>
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}
