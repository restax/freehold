/**
 * The stable identity of every card on /dashboard/integrations, kept apart
 * from that page's own render logic so /admin/integrations can list the same
 * set without importing a dashboard page (which pulls in tenant-scoped data
 * loading it has no business doing).
 *
 * `key` is what IntegrationBranding rows are keyed on — stable across
 * renames of the display name, so an operator's uploaded logo doesn't go
 * orphaned if a card's copy changes later.
 */
export interface IntegrationCatalogEntry {
  key: string;
  name: string;
  /** The plain-letter mark shown when no logo has been uploaded. */
  mono: string;
}

export const INTEGRATION_CATALOG: IntegrationCatalogEntry[] = [
  { key: "email", name: "Email & reply capture", mono: "@" },
  { key: "documenso", name: "Documenso e-signatures", mono: "Do" },
  { key: "storage", name: "Document storage", mono: "St" },
  { key: "docusign", name: "DocuSign e-signatures", mono: "DS" },
  { key: "opensign", name: "OpenSign e-signatures", mono: "OS" },
  { key: "zapier", name: "Zapier", mono: "Z" },
  { key: "fub", name: "Follow Up Boss", mono: "FB" },
  { key: "twenty", name: "Twenty CRM", mono: "Tw" },
  { key: "erpnext", name: "ERPNext", mono: "ER" },
  { key: "mcp", name: "Claude connector", mono: "AI" },
  { key: "api", name: "Freehold API", mono: "{}" },
  { key: "webhooks", name: "Signed webhooks", mono: "→" },
  { key: "stripe", name: "Client invoicing (Stripe)", mono: "St" },
  { key: "calendar", name: "Calendar feeds", mono: "Ca" },
  { key: "csv-import", name: "CSV import", mono: "⇥" },
];
