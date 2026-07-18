/** Domain alias: an Organization row IS a Freehold tenant. */
export type {
  Account,
  Client,
  Invitation,
  Member,
  Organization,
  Organization as Tenant,
  Session,
  User,
} from "@prisma/client";
export { ClientType } from "@prisma/client";
export { prisma } from "./client.js";
export { tenantSlug } from "./slug.js";
export { type TenantTx, withTenant } from "./tenant.js";
