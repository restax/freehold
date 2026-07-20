import { decryptSecret, encryptSecret, loadMasterKey } from "@freehold/vault";

/**
 * ERPNext (Frappe) invoicing. A tenant who already runs ERPNext bills clients
 * there instead of in Freehold: we create the Customer and Sales Invoice in
 * *their* instance and mirror the status back. Their ERP stays the system of
 * record for accounting; Freehold just stops being a second place to type it.
 *
 * Frappe's REST contract (docs.frappe.io/framework/user/en/api/rest):
 *   auth      Authorization: token <api_key>:<api_secret>
 *   resource  /api/resource/{DocType}[/{name}]
 *   envelope  every response wraps the payload in "data"
 *   docstatus 0 draft · 1 submitted · 2 cancelled
 */

const TIMEOUT_MS = 10_000;

export interface ErpnextConnection {
  url: string;
  apiKey: string;
  apiSecret: string;
  /** Item code billed on every invoice line, e.g. "TC-SERVICES". */
  itemCode: string;
}

/** Stored shape on Organization.erpnextConfig — secrets envelope-encrypted. */
export interface ErpnextConfig {
  url: string;
  itemCode: string;
  keyEnc: ReturnType<typeof encryptSecret>;
  secretEnc: ReturnType<typeof encryptSecret>;
}

export function parseErpnextConfig(raw: unknown): ErpnextConfig | null {
  const cfg = raw as ErpnextConfig | null;
  return cfg?.url && cfg.keyEnc && cfg.secretEnc ? cfg : null;
}

export function encodeErpnextConfig(conn: ErpnextConnection): ErpnextConfig {
  const master = loadMasterKey();
  return {
    url: conn.url.replace(/\/$/, ""),
    itemCode: conn.itemCode,
    keyEnc: encryptSecret(conn.apiKey, master),
    secretEnc: encryptSecret(conn.apiSecret, master),
  };
}

export function decodeErpnextConfig(cfg: ErpnextConfig): ErpnextConnection {
  const master = loadMasterKey();
  return {
    url: cfg.url,
    itemCode: cfg.itemCode || "TC Services",
    apiKey: decryptSecret(cfg.keyEnc, master),
    apiSecret: decryptSecret(cfg.secretEnc, master),
  };
}

function authHeaders(conn: ErpnextConnection): Record<string, string> {
  return {
    Authorization: `token ${conn.apiKey}:${conn.apiSecret}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/**
 * One REST call against the tenant's instance. Their server is a third party:
 * bounded time, and any failure surfaces as a plain message rather than an
 * exception spilling ERP internals into our UI.
 */
async function call<T>(
  conn: ErpnextConnection,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${conn.url}${path}`, {
      method: init.method ?? "GET",
      headers: authHeaders(conn),
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        error: "ERPNext rejected the API key — check the key, secret, and role.",
      };
    }
    if (!res.ok) {
      // Frappe returns its real complaint in _server_messages / exception.
      const body = (await res.json().catch(() => null)) as {
        exception?: string;
        _server_messages?: string;
      } | null;
      const detail = body?.exception ?? body?._server_messages ?? `HTTP ${res.status}`;
      return { ok: false, error: `ERPNext refused the request: ${String(detail).slice(0, 300)}` };
    }
    const body = (await res.json()) as { data: T };
    return { ok: true, data: body.data };
  } catch {
    return { ok: false, error: "ERPNext did not respond — check the URL and that it's reachable." };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Prove the credentials work before saving them, the way the storage and
 * Twenty connectors do: a real authenticated read against the instance.
 */
export async function verifyErpnext(
  conn: ErpnextConnection,
): Promise<{ ok: boolean; error?: string; user?: string }> {
  const who = await call<Record<string, unknown>>(
    conn,
    "/api/resource/Customer?limit_page_length=1",
  );
  if (!who.ok) return { ok: false, error: who.error };
  // The item every invoice line bills must exist, or invoices fail later with
  // a confusing error — better to refuse the connection now.
  const item = await call<Array<{ name: string }>>(
    conn,
    `/api/resource/Item?limit_page_length=1&filters=${encodeURIComponent(
      JSON.stringify([["item_code", "=", conn.itemCode]]),
    )}`,
  );
  if (!item.ok) return { ok: false, error: item.error };
  if (!Array.isArray(item.data) || item.data.length === 0) {
    return {
      ok: false,
      error: `No Item "${conn.itemCode}" exists in ERPNext. Create it there (a non-stock service item), or enter the code of one you already use.`,
    };
  }
  return { ok: true };
}

/** Find the client's Customer by name, creating it when it's not there yet. */
export async function ensureCustomer(
  conn: ErpnextConnection,
  clientName: string,
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const found = await call<Array<{ name: string }>>(
    conn,
    `/api/resource/Customer?limit_page_length=1&filters=${encodeURIComponent(
      JSON.stringify([["customer_name", "=", clientName]]),
    )}`,
  );
  if (!found.ok) return found;
  if (Array.isArray(found.data) && found.data.length > 0) {
    return { ok: true, name: found.data[0].name };
  }
  const created = await call<{ name: string }>(conn, "/api/resource/Customer", {
    method: "POST",
    body: { customer_name: clientName, customer_type: "Company" },
  });
  if (!created.ok) return created;
  return { ok: true, name: created.data.name };
}

export interface ErpnextInvoiceInput {
  customerName: string;
  description: string;
  amountCents: number;
  dueDate: Date | null;
  /** Our own INV-0007, carried into ERPNext's remarks for cross-reference. */
  reference: string;
}

/**
 * Create the Sales Invoice and submit it (docstatus 1) so it posts to their
 * ledger — a draft sitting in ERPNext would help nobody. Amount goes on a
 * single line at qty 1, since a TC bills a fee, not a bill of materials.
 */
export async function createSalesInvoice(
  conn: ErpnextConnection,
  input: ErpnextInvoiceInput,
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const customer = await ensureCustomer(conn, input.customerName);
  if (!customer.ok) return customer;

  const created = await call<{ name: string }>(conn, "/api/resource/Sales%20Invoice", {
    method: "POST",
    body: {
      customer: customer.name,
      docstatus: 1,
      ...(input.dueDate ? { due_date: input.dueDate.toISOString().slice(0, 10) } : {}),
      remarks: `${input.reference} — ${input.description}`,
      items: [
        {
          item_code: conn.itemCode,
          qty: 1,
          rate: input.amountCents / 100,
          description: input.description,
        },
      ],
    },
  });
  if (!created.ok) return created;
  return { ok: true, name: created.data.name };
}

export type MirroredStatus = "SENT" | "PAID" | "VOID";

/**
 * Their status vocabulary is long and version-dependent (Paid, Partly Paid,
 * Unpaid, Overdue, Return, Credit Note Issued, Internal Transfer…). Only the
 * two terminal outcomes are mapped explicitly; everything else means still
 * outstanding. Defaulting that way keeps an unknown status from silently
 * marking a client's bill settled.
 */
export function mirrorStatus(erpStatus: string, docstatus?: number): MirroredStatus {
  if (docstatus === 2) return "VOID";
  const s = erpStatus.trim().toLowerCase();
  if (s === "paid") return "PAID";
  if (s === "cancelled" || s === "return" || s === "credit note issued") return "VOID";
  return "SENT";
}

/** Current status of one invoice in their instance. */
export async function fetchInvoiceStatus(
  conn: ErpnextConnection,
  name: string,
): Promise<{ ok: true; status: MirroredStatus } | { ok: false; error: string }> {
  const res = await call<{ status?: string; docstatus?: number }>(
    conn,
    `/api/resource/Sales%20Invoice/${encodeURIComponent(name)}`,
  );
  if (!res.ok) return res;
  return { ok: true, status: mirrorStatus(res.data.status ?? "", res.data.docstatus) };
}

/** Deep link to the invoice in the tenant's own ERPNext UI. */
export function erpnextInvoiceUrl(url: string, name: string): string {
  return `${url.replace(/\/$/, "")}/app/sales-invoice/${encodeURIComponent(name)}`;
}
