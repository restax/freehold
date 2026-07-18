import * as PrismaPkg from "@prisma/client";

/** Domain alias: an Organization row IS a Freehold tenant. */
export type {
  Account,
  ActionPlan,
  ActionPlanTask,
  Client,
  Contact,
  Invitation,
  Member,
  Organization,
  Organization as Tenant,
  Session,
  Task,
  Transaction,
  TransactionParty,
  User,
} from "@prisma/client";
export { prisma } from "./client.js";
export { tenantSlug } from "./slug.js";
export { type TenantTx, withTenant } from "./tenant.js";

// Prisma's generated enums are re-exported via namespace property access
// (not named re-exports): bundlers statically verify named imports against
// the generated CJS module and can miss freshly generated members, which
// breaks the whole module graph at runtime. Property access is always safe.
export const ClientType = PrismaPkg.ClientType;
export type ClientType = PrismaPkg.ClientType;
export const DateAnchor = PrismaPkg.DateAnchor;
export type DateAnchor = PrismaPkg.DateAnchor;
export const PartyRole = PrismaPkg.PartyRole;
export type PartyRole = PrismaPkg.PartyRole;
export const TaskStatus = PrismaPkg.TaskStatus;
export type TaskStatus = PrismaPkg.TaskStatus;
export const TransactionSide = PrismaPkg.TransactionSide;
export type TransactionSide = PrismaPkg.TransactionSide;
export const TransactionStatus = PrismaPkg.TransactionStatus;
export type TransactionStatus = PrismaPkg.TransactionStatus;
