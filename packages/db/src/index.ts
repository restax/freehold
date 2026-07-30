import * as PrismaPkg from "@prisma/client";

/** Domain alias: an Organization row IS a Freehold tenant. */
export type {
  Account,
  ActionPlan,
  ActionPlanTask,
  Client,
  Contact,
  ContractExtraction,
  DocTemplate,
  Document,
  ExtractionField,
  HandbookNote,
  Invitation,
  Member,
  Organization,
  Organization as Tenant,
  PaymentRequest,
  PaymentRequestItem,
  PlatformSetting,
  PortalLink,
  Session,
  SignatureEnvelope,
  Task,
  TenantState,
  Transaction,
  TransactionAssignee,
  TransactionParty,
  User,
  UserLicense,
  VaultAccessLog,
  VaultCredential,
} from "@prisma/client";
export { prisma } from "./client.js";
export { tenantSlug } from "./slug.js";
export { type TenantTx, withTenant, withVendor } from "./tenant.js";

// Prisma's generated enums are re-exported via namespace property access
// (not named re-exports): bundlers statically verify named imports against
// the generated CJS module and can miss freshly generated members, which
// breaks the whole module graph at runtime. Property access is always safe.
export const Prisma = PrismaPkg.Prisma;
export const ClientType = PrismaPkg.ClientType;
export type ClientType = PrismaPkg.ClientType;
export const DateAnchor = PrismaPkg.DateAnchor;
export type DateAnchor = PrismaPkg.DateAnchor;
export const HandbookGrade = PrismaPkg.HandbookGrade;
export type HandbookGrade = PrismaPkg.HandbookGrade;
export const HandbookSubject = PrismaPkg.HandbookSubject;
export type HandbookSubject = PrismaPkg.HandbookSubject;
export const PartyRole = PrismaPkg.PartyRole;
export type PartyRole = PrismaPkg.PartyRole;
export const PlanTier = PrismaPkg.PlanTier;
export type PlanTier = PrismaPkg.PlanTier;
export const TaskStatus = PrismaPkg.TaskStatus;
export const TaskPriority = PrismaPkg.TaskPriority;
export type TaskPriority = PrismaPkg.TaskPriority;
export type TaskStatus = PrismaPkg.TaskStatus;
export const TransactionSide = PrismaPkg.TransactionSide;
export type TransactionSide = PrismaPkg.TransactionSide;
export const TransactionStatus = PrismaPkg.TransactionStatus;
export type TransactionStatus = PrismaPkg.TransactionStatus;
export const VaultAction = PrismaPkg.VaultAction;
export type VaultAction = PrismaPkg.VaultAction;
export const EnvelopeStatus = PrismaPkg.EnvelopeStatus;
export type EnvelopeStatus = PrismaPkg.EnvelopeStatus;
export const EsignProvider = PrismaPkg.EsignProvider;
export const PortalAudience = PrismaPkg.PortalAudience;
export type PortalAudience = PrismaPkg.PortalAudience;
export type EsignProvider = PrismaPkg.EsignProvider;
export const ExtractionStatus = PrismaPkg.ExtractionStatus;
export type ExtractionStatus = PrismaPkg.ExtractionStatus;
export const FieldConfidence = PrismaPkg.FieldConfidence;
export type FieldConfidence = PrismaPkg.FieldConfidence;
export const FieldTarget = PrismaPkg.FieldTarget;
export type FieldTarget = PrismaPkg.FieldTarget;
export const FieldValueType = PrismaPkg.FieldValueType;
export type FieldValueType = PrismaPkg.FieldValueType;
export const InvoiceStatus = PrismaPkg.InvoiceStatus;
export type InvoiceStatus = PrismaPkg.InvoiceStatus;
export const ComplianceStatus = PrismaPkg.ComplianceStatus;
export type ComplianceStatus = PrismaPkg.ComplianceStatus;
export const ComplianceSlotStatus = PrismaPkg.ComplianceSlotStatus;
export type ComplianceSlotStatus = PrismaPkg.ComplianceSlotStatus;
export const PaymentRequestStatus = PrismaPkg.PaymentRequestStatus;
export type PaymentRequestStatus = PrismaPkg.PaymentRequestStatus;
export const EngagementStatus = PrismaPkg.EngagementStatus;
export type EngagementStatus = PrismaPkg.EngagementStatus;
export const TicketStatus = PrismaPkg.TicketStatus;
export type TicketStatus = PrismaPkg.TicketStatus;
export const VendorCategory = PrismaPkg.VendorCategory;
export type VendorCategory = PrismaPkg.VendorCategory;
export const VendorConnectionStatus = PrismaPkg.VendorConnectionStatus;
export type VendorConnectionStatus = PrismaPkg.VendorConnectionStatus;
export const ConnectionInitiator = PrismaPkg.ConnectionInitiator;
export type ConnectionInitiator = PrismaPkg.ConnectionInitiator;
export const VendorOrderStatus = PrismaPkg.VendorOrderStatus;
export type VendorOrderStatus = PrismaPkg.VendorOrderStatus;
export const OrderPlacedBy = PrismaPkg.OrderPlacedBy;
export type OrderPlacedBy = PrismaPkg.OrderPlacedBy;
export const OrderActor = PrismaPkg.OrderActor;
export type OrderActor = PrismaPkg.OrderActor;
export const ProposalKind = PrismaPkg.ProposalKind;
export type ProposalKind = PrismaPkg.ProposalKind;
export const ProposalStatus = PrismaPkg.ProposalStatus;
export type ProposalStatus = PrismaPkg.ProposalStatus;
export const AdStatus = PrismaPkg.AdStatus;
export type AdStatus = PrismaPkg.AdStatus;
export const CreditLedgerReason = PrismaPkg.CreditLedgerReason;
export type CreditLedgerReason = PrismaPkg.CreditLedgerReason;
