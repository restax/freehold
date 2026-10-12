export const FULL_NAME_MESSAGE = "Please enter your first and last name.";

/** True when the name has at least two words that each contain a letter. */
export function isFullName(name: string): boolean {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 && parts.every((p) => /\p{L}/u.test(p));
}
