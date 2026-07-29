/**
 * Which columns the contacts table shows, in which order.
 *
 * Same shape and rules as the transactions catalogue — see lib/table-columns.ts
 * for the resolution behaviour. Grouped the way a coordinator thinks about a
 * contact: who they are, how to reach them, who else is on the record, how the
 * relationship is being worked, and the reference numbers.
 *
 * Mailing address is deliberately absent. It's on the contact's own page; a
 * list is for finding somebody, not for reading their post.
 */

import { type ColumnDef, makeColumnSet } from "./table-columns";

export type { ColumnDef } from "./table-columns";

export const CONTACT_COLUMNS: readonly ColumnDef[] = [
  // Who they are
  { key: "name", label: "Name", group: "Who", width: "18rem", locked: true },
  { key: "jobTitle", label: "Job title", group: "Who", width: "11rem" },
  { key: "company", label: "Company", group: "Who", width: "13rem" },
  { key: "teamName", label: "Team", group: "Who", width: "11rem" },
  // How to reach them
  { key: "phone", label: "Phone", group: "Reaching them", width: "10rem" },
  { key: "workPhone", label: "Work phone", group: "Reaching them", width: "10rem" },
  { key: "email", label: "Email", group: "Reaching them", width: "16rem" },
  { key: "website", label: "Website", group: "Reaching them", width: "13rem" },
  // The second person on the record
  { key: "secondName", label: "Second person", group: "Second person", width: "13rem" },
  { key: "secondEmail", label: "Second email", group: "Second person", width: "16rem" },
  { key: "secondPhone", label: "Second phone", group: "Second person", width: "10rem" },
  // How the relationship is being worked
  { key: "categories", label: "Categories", group: "Relationship", width: "16rem" },
  { key: "grade", label: "Rating", group: "Relationship", width: "6rem" },
  { key: "owners", label: "Owners", group: "Relationship", width: "12rem" },
  { key: "lastTouch", label: "Last touch", group: "Relationship", width: "8rem", align: "right" },
  { key: "nextTouch", label: "Next touch", group: "Relationship", width: "8rem", align: "right" },
  { key: "referredBy", label: "Referred by", group: "Relationship", width: "12rem" },
  // Reference
  { key: "brokerageLicense", label: "Brokerage licence", group: "Reference", width: "11rem" },
  { key: "salespersonLicense", label: "Salesperson licence", group: "Reference", width: "11rem" },
  { key: "createdAt", label: "Added", group: "Reference", width: "8rem", align: "right" },
] as const;

/** What somebody sees before touching the picker — the reference layout. */
export const DEFAULT_CONTACT_COLUMNS = ["name", "phone", "email", "categories", "owners"] as const;

const SET = makeColumnSet(CONTACT_COLUMNS, DEFAULT_CONTACT_COLUMNS);

export const CONTACT_LOCKED_KEYS = SET.lockedKeys;
export const contactColumnByKey = SET.byKey;
export const contactColumnGroups = SET.groups;
export const resolveContactColumns = SET.resolve;
export const normalizeContactColumns = SET.normalize;
export const contactTableMinWidth = SET.minWidth;
