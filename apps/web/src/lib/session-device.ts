/** "desktop" | "mobile", from a User-Agent string. Good enough to draw the
 * line for concurrent-session limiting — not meant to be exhaustive. */
export function classifyDeviceType(userAgent: string | null | undefined): "desktop" | "mobile" {
  if (!userAgent) return "desktop";
  return /Mobi|Android|iPhone|iPad/i.test(userAgent) ? "mobile" : "desktop";
}
