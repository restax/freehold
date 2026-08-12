/**
 * Phone numbers in the shape Twenty will actually accept.
 *
 * Twenty validates `primaryPhoneNumber` with libphonenumber and rejects the
 * whole create with INVALID_PHONE_NUMBER when it can't parse what it was
 * given. A national-format string on its own is genuinely ambiguous, which is
 * why "682-465-7098" was refused in production while other numbers captured
 * the same afternoon went through: the difference was never the record, it was
 * how the number happened to be written on screen.
 *
 * Two things follow. The number is split so nothing has to be inferred, and
 * more than one spelling of that split is offered, because which one a Twenty
 * workspace wants depends on its version: `primaryPhoneCallingCode` only
 * exists in newer ones, and older ones keep the calling code in
 * `primaryPhoneCountryCode` instead. Rather than pin a version we cannot see
 * from here, the caller walks the list until one is accepted.
 *
 * Deliberately dependency-free, the lib/mcp-access.ts pattern, so every format
 * a screenshot can produce is unit-tested without reaching for the network.
 */

/** Twenty's phone composite, split the way its validator wants to receive it. */
export interface TwentyPhoneFields {
  primaryPhoneNumber: string;
  primaryPhoneCallingCode?: string;
  primaryPhoneCountryCode?: string;
}

/** The national number and its calling code, or null if we can't place it. */
function split(raw: string | null | undefined): { national: string; calling: string } | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const international = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  // North America, with or without the leading 1: the common case by far here.
  if (digits.length === 10 && !international) return { national: digits, calling: "+1" };
  if (digits.length === 11 && digits.startsWith("1")) {
    return { national: digits.slice(1), calling: "+1" };
  }

  // A country code was written down but isn't +1. Splitting it off would need
  // a full country table, so the E.164 shapes below carry it instead.
  if (international && digits.length >= 8 && digits.length <= 15) {
    return { national: `+${digits}`, calling: "" };
  }

  // Too short, too long, or an extension smuggled in: not a number we can
  // vouch for. Saying so costs the phone; sending it costs the whole record.
  return null;
}

/**
 * The number as Twenty should store it: bare digits for North America, E.164
 * for everything else. Also what a duplicate lookup should search on, since
 * this is the string that ends up in the CRM.
 */
export function twentyPhone(raw: string | null | undefined): string | null {
  return split(raw)?.national ?? null;
}

/**
 * Every shape worth trying, best first. An empty array means the number was
 * unusable and the person should be saved without it.
 */
export function twentyPhoneShapes(raw: string | null | undefined): TwentyPhoneFields[] {
  const parts = split(raw);
  if (!parts) return [];
  const { national, calling } = parts;

  // Already E.164: one unambiguous shape, nothing to spell differently.
  if (!calling) return [{ primaryPhoneNumber: national }];

  return [
    // Current Twenty: calling code and country code as their own fields.
    {
      primaryPhoneNumber: national,
      primaryPhoneCallingCode: calling,
      primaryPhoneCountryCode: "US",
    },
    // Older Twenty: no callingCode field, and countryCode holds the "+1".
    { primaryPhoneNumber: national, primaryPhoneCountryCode: calling },
    // Last resort, and the one no version can misread: the whole number in
    // E.164 with nothing beside it.
    { primaryPhoneNumber: `${calling}${national}` },
  ];
}
