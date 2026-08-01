/**
 * US phone formatting for input fields: "3125550101" becomes "(312) 555-0101"
 * as you type.
 *
 * Deliberately conservative about what it touches. Anything that doesn't look
 * like a plain US number — an international "+81…", an extension ("x22"), a
 * note ("ask for Dana") — passes through untouched, because mangling what a
 * person meant is worse than leaving it unformatted. Sample data and most real
 * entry are plain ten-digit numbers, and those are the ones that get tidied.
 */

/** Characters that are part of formatting rather than meaning. */
const DRESSING = /[\s().-]/g;

export function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Whether this string is safe to reformat: only digits and dressing, and a
 * plausible US length. A leading "+" or a letter means the person is telling
 * us something the (xxx) xxx-xxxx shape can't hold.
 */
export function isFormattableUsPhone(value: string): boolean {
  if (value.replace(DRESSING, "").replace(/\d/g, "") !== "") return false;
  const d = digitsOf(value);
  if (d.length > 11) return false;
  if (d.length === 11 && !d.startsWith("1")) return false;
  return true;
}

/** Progressive format for a digit string: works mid-typing, not just at 10. */
export function formatUsDigits(d: string): string {
  const lead = d.length === 11 && d.startsWith("1") ? "1 " : "";
  const rest = lead ? d.slice(1) : d;
  if (rest.length === 0) return "";
  if (rest.length <= 3) return `${lead}(${rest}`;
  if (rest.length <= 6) return `${lead}(${rest.slice(0, 3)}) ${rest.slice(3)}`;
  return `${lead}(${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6, 10)}`;
}

/** The whole-value version: format if it's ours to format, else hands off. */
export function formatUsPhone(value: string): string {
  if (!isFormattableUsPhone(value)) return value;
  return formatUsDigits(digitsOf(value));
}
