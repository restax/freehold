import { PartyRole } from "@freehold/db";

/**
 * Which contacts belong in the "Primary Agent" / "Co-Agent" picker.
 *
 * A Contact has no type of its own — "buyer", "seller", "agent" only exist as
 * a role on one transaction's TransactionParty link. Left unfiltered, the
 * agent picker on a new file offered every contact ever added anywhere,
 * including a buyer or a title company from an unrelated deal.
 *
 * A contact is agent-eligible if it has never been tied to a transaction as
 * a non-agent party, or if at least one of those ties was itself an agent
 * role. A brand-new contact — never linked to anything — is eligible by
 * default, since that's how every agent starts out.
 */
const AGENT_PARTY_ROLES: readonly PartyRole[] = [PartyRole.BUYER_AGENT, PartyRole.LISTING_AGENT];

export function isAgentEligible(parties: { role: string }[]): boolean {
  return (
    parties.length === 0 || parties.some((p) => AGENT_PARTY_ROLES.includes(p.role as PartyRole))
  );
}
