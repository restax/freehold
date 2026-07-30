/**
 * Locating an extractor's cited quote inside a PDF page's text items.
 *
 * pdf.js hands the text layer over as many small fragments — often a single
 * word, sometimes part of one — and the model's quote almost never lines up
 * with those boundaries. The first version of this asked, per fragment, "does
 * the quote contain this string?", which is true for *every* occurrence of
 * "the", "and" or "for" on the page as soon as the quote contains that word
 * once. Hovering a field lit up a hundred scattered words and pointed at
 * nothing.
 *
 * This matches a contiguous run instead: the fragments are joined back into
 * one string, the quote is found inside it, and only the fragments overlapping
 * that span are highlighted. Finding nothing highlights nothing, which is more
 * use than highlighting everything.
 */

/** Fewest words a run must have to count — below this a "match" is noise. */
const MIN_WORDS = 3;
/** …and it must be this substantial in characters, so "of the deed" is out. */
const MIN_CHARS = 8;

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ");
}

/**
 * The page's fragments joined into one normalized string, plus a map from each
 * character back to the fragment it came from.
 *
 * A separator is forced between fragments: pdf.js frequently omits the
 * trailing space, so "15 California" + "Avenue" would otherwise join into
 * "15 CaliforniaAvenue" and never match the quote.
 */
function flatten(items: string[]): { text: string; owner: number[] } {
  let text = "";
  const owner: number[] = [];
  items.forEach((raw, i) => {
    for (const ch of normalize(raw)) {
      if (ch === " " && text.endsWith(" ")) continue;
      text += ch;
      owner.push(i);
    }
    if (!text.endsWith(" ")) {
      text += " ";
      owner.push(i);
    }
  });
  return { text, owner };
}

/**
 * Strip the decorations a cited quote tends to arrive wrapped in — smart or
 * straight quotation marks, and the ellipses the model uses to show it
 * trimmed the middle of a sentence.
 */
function cleanQuote(quote: string): string {
  return normalize(quote)
    .replace(/[“”‘’"']/g, "")
    .replace(/\.{2,}|…/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Which of `items` to highlight for `quote`, by index.
 *
 * Tries the whole quote first, then progressively shorter word-windows,
 * taking the longest run that actually appears on the page — a quote can
 * disagree with the PDF at either end (the model tidies punctuation, or the
 * sentence runs across a page break) while its middle still matches exactly.
 */
export function matchQuoteItems(items: string[], quote: string): Set<number> {
  const hits = new Set<number>();
  const cleaned = cleanQuote(quote ?? "");
  if (!cleaned) return hits;

  const { text, owner } = flatten(items);
  if (!text.trim()) return hits;

  const words = cleaned.split(" ").filter(Boolean);
  if (words.length < MIN_WORDS) return hits;

  for (let len = words.length; len >= MIN_WORDS; len--) {
    for (let start = 0; start + len <= words.length; start++) {
      const needle = words.slice(start, start + len).join(" ");
      if (needle.length < MIN_CHARS) continue;
      const at = text.indexOf(needle);
      if (at === -1) continue;
      for (let i = at; i < at + needle.length && i < owner.length; i++) {
        hits.add(owner[i]);
      }
      return hits;
    }
  }
  return hits;
}
