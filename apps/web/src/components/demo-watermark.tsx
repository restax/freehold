/**
 * A quiet, page-wide "DEMO" watermark for the shared public demo workspace —
 * so a visitor who bookmarks the tab, or leaves it open after signing up for
 * real, can't mistake it for their own account. Purely decorative (aria-hidden,
 * pointer-events-none) and faint by design: legible on close look, invisible
 * at a glance, like a watermark on good paper.
 */
export function DemoWatermark() {
  const tile =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='170' viewBox='0 0 260 170'%3E%3Ctext x='0' y='100' font-family='Georgia, serif' font-size='34' font-weight='700' letter-spacing='4' fill='%2357534e' transform='rotate(-24 130 85)'%3EDEMO%3C/text%3E%3C/svg%3E";
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-30 opacity-[0.04]"
      style={{ backgroundImage: `url("${tile}")`, backgroundRepeat: "repeat" }}
    />
  );
}
