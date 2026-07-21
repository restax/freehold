/**
 * Strip quoted history from an inbound email reply so the parser (AI or human)
 * reads only what the sender actually wrote this time — not the entire thread
 * echoed back. Heuristic, deliberately conservative: it cuts at the first
 * recognized quote header and drops fully-quoted (`>`) trailing blocks, but
 * never tries to be clever about signatures beyond the obvious mobile ones.
 */

// Markers that begin quoted history. Each is matched at the start of a line.
const QUOTE_MARKERS: RegExp[] = [
  // Gmail / Apple Mail: "On Tue, Jul 21, 2026 at 3:00 PM Sam <sam@x> wrote:"
  // (may wrap across lines — match "On …wrote:" spanning up to ~200 chars).
  /(^|\n)On\s[\s\S]{0,200}?\bwrote:\s*(\n|$)/,
  // Outlook: "-----Original Message-----"
  /(^|\n)\s*-{2,}\s*Original Message\s*-{2,}/i,
  // Outlook header block divider (a run of underscores on its own line).
  /(^|\n)_{5,}\s*(\n|$)/,
  // Forwarded marker.
  /(^|\n)-{2,}\s*Forwarded message\s*-{2,}/i,
  // Outlook field block: a "From:" line followed shortly by Sent:/To:.
  /(^|\n)From:\s.+(\n.*){0,3}\n(Sent|To|Date):\s/i,
];

export function stripQuotedReply(raw: string): string {
  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Earliest quote-header marker wins.
  let cut = text.length;
  for (const re of QUOTE_MARKERS) {
    const m = re.exec(text);
    if (m) {
      // m.index points at the leading \n (or 0); the marker itself starts there.
      const at = m.index === 0 ? 0 : m.index + 1;
      if (at < cut) cut = at;
    }
  }
  let head = text.slice(0, cut);

  // Drop a trailing run of fully-quoted lines (a reply that leaves the quote
  // below without any header) and mobile-client signatures.
  const lines = head.split("\n");
  while (lines.length > 0) {
    const last = lines[lines.length - 1].trim();
    if (last.startsWith(">") || /^sent from my /i.test(last) || last === "") {
      lines.pop();
    } else {
      break;
    }
  }
  head = lines.join("\n").trim();

  // If stripping removed everything (e.g. a reply that was only a quote header),
  // fall back to the original trimmed text rather than an empty string.
  return head || text.trim();
}
