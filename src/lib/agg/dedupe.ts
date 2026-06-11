// Lightweight trigram similarity that approximates Postgres pg_trgm, used for
// in-process fuzzy dedupe during ingest (the gin index still backs the
// publish-time SQL check). pg_trgm lowercases, splits on non-alphanumerics,
// pads each word with two leading spaces + one trailing, and compares trigram
// sets by Jaccard similarity.

function trigrams(input: string): Set<string> {
  const set = new Set<string>();
  const words = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  for (const w of words) {
    const padded = `  ${w} `;
    for (let i = 0; i < padded.length - 2; i++) {
      set.add(padded.slice(i, i + 3));
    }
  }
  return set;
}

export function similarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export { trigrams };
