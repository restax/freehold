/**
 * Addresses that must never be mailed, because nothing is listening at the
 * other end and the attempt comes back as a bounce.
 *
 * Bounces are not free: providers score a sender on them, and a demo
 * workspace full of placeholder contacts can quietly ruin the deliverability
 * of the real mail a paying workspace depends on.
 *
 * RFC 2606 reserves both shapes, and the difference between them is the trap
 * this exists to close: `foo.example` is a reserved *TLD*, but
 * `example.com` / `.org` / `.net` are reserved *second-level* names under
 * ordinary TLDs. A check that only looked at the end of the domain caught the
 * first and sailed straight past the second.
 */

const RESERVED_TLD = /\.(example|test|invalid|localhost)$/i;
const RESERVED_SLD = /^example\.(com|org|net)$/i;

/** The domain of an address, lowercased, or "" if it isn't shaped like one. */
function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1
    ? ""
    : email
        .slice(at + 1)
        .trim()
        .toLowerCase();
}

/**
 * True when mailing this address would bounce by construction. Callers skip
 * the send rather than erroring: a placeholder contact is normal in sample
 * data, not a fault worth interrupting someone's work over.
 */
export function isUndeliverableAddress(email: string | null | undefined): boolean {
  if (!email) return true;
  const domain = domainOf(email);
  if (!domain) return true;
  return RESERVED_TLD.test(domain) || RESERVED_SLD.test(domain);
}
