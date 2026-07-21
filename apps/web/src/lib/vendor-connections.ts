import { VendorConnectionStatus } from "@freehold/db";

/**
 * Pure predicates for the connection handshake, unit-tested. The actions in
 * lib/actions/vendor-connections.ts enforce them; keeping the decisions here
 * (not inline) is what lets the state machine be pinned by tests.
 */

interface ConnectionLike {
  status: VendorConnectionStatus;
  requestedBy: "TENANT" | "VENDOR";
}

/** The party that must accept is the one that did NOT request. */
export function canAccept(c: ConnectionLike, side: "TENANT" | "VENDOR"): boolean {
  return c.status === VendorConnectionStatus.REQUESTED && c.requestedBy !== side;
}

/** Same rule for declining — only the receiving side, only while pending. */
export function canDecline(c: ConnectionLike, side: "TENANT" | "VENDOR"): boolean {
  return canAccept(c, side);
}

/** Either side may revoke an active connection. */
export function canRevoke(c: ConnectionLike): boolean {
  return c.status === VendorConnectionStatus.ACTIVE;
}

/** Orders may only flow across a live connection. */
export function isConnected(status: VendorConnectionStatus): boolean {
  return status === VendorConnectionStatus.ACTIVE;
}
