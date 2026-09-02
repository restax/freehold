import { decryptSecret, encryptSecret, loadMasterKey } from "@freehold/vault";

/**
 * Wave (waveapps.com) invoicing. Same bargain as the ERPNext connector: a
 * tenant who already keeps their books in Wave bills clients *there*, and
 * Freehold creates the customer and the invoice in their business and mirrors
 * the paid status back. Wave stays the accounting record; Freehold stops being
 * a second place to type the same bill.
 *
 * Wave's contract (developer.waveapps.com — API Reference):
 *   endpoint  one GraphQL URL, POST only
 *   auth      Authorization: Bearer <full access token>
 *   ids       opaque strings; a business id and a product id are needed before
 *             an invoice can be created at all
 *   mutations return {didSucceed, inputErrors[{path,message,code}], <node>}
 *             rather than throwing, so a "successful" HTTP 200 can still be a
 *             refusal — every call has to read didSucceed.
 */

const ENDPOINT = "https://gql.waveapps.com/graphql/public";
const TIMEOUT_MS = 10_000;
/** Customer lookup pages this far before giving up and creating a new one. */
const CUSTOMER_PAGE_SIZE = 200;
const CUSTOMER_MAX_PAGES = 5;

export interface WaveConnection {
  /** Opaque Wave business id the invoices are created under. */
  businessId: string;
  businessName: string;
  /** Wave product every invoice line bills, e.g. "TC Services". */
  productId: string;
  productName: string;
  token: string;
}

/** Stored shape on Organization.waveConfig — the token envelope-encrypted. */
export interface WaveConfig {
  businessId: string;
  businessName: string;
  productId: string;
  productName: string;
  tokenEnc: ReturnType<typeof encryptSecret>;
}

export function parseWaveConfig(raw: unknown): WaveConfig | null {
  const cfg = raw as WaveConfig | null;
  return cfg?.businessId && cfg.productId && cfg.tokenEnc ? cfg : null;
}

export function encodeWaveConfig(conn: WaveConnection): WaveConfig {
  const master = loadMasterKey();
  return {
    businessId: conn.businessId,
    businessName: conn.businessName,
    productId: conn.productId,
    productName: conn.productName,
    tokenEnc: encryptSecret(conn.token, master),
  };
}

export function decodeWaveConfig(cfg: WaveConfig): WaveConnection {
  const master = loadMasterKey();
  return {
    businessId: cfg.businessId,
    businessName: cfg.businessName,
    productId: cfg.productId,
    productName: cfg.productName || "TC Services",
    token: decryptSecret(cfg.tokenEnc, master),
  };
}

type GqlResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * One GraphQL call against Wave. Their server is a third party: bounded time,
 * and any failure surfaces as a plain sentence rather than an exception
 * spilling GraphQL internals into our UI.
 */
async function gql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<GqlResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "Wave rejected the token — check it hasn't been revoked." };
    }
    const body = (await res.json().catch(() => null)) as {
      data?: T;
      errors?: Array<{ message?: string }>;
    } | null;
    if (!body)
      return { ok: false, error: `Wave returned an unreadable response (HTTP ${res.status}).` };
    if (body.errors?.length) {
      const text = gqlErrorText(body.errors);
      // Wave answers a bad token with HTTP 200 and "authentication expired",
      // which reads as a session problem rather than the wrong token pasted
      // into a form thirty seconds ago. Say the useful thing instead.
      if (/authentic|unauthor|not logged in/i.test(text)) {
        return { ok: false, error: "Wave rejected the token — check it hasn't been revoked." };
      }
      return { ok: false, error: `Wave refused the request: ${text}` };
    }
    if (!res.ok) return { ok: false, error: `Wave refused the request (HTTP ${res.status}).` };
    if (!body.data) return { ok: false, error: "Wave returned no data for the request." };
    return { ok: true, data: body.data };
  } catch {
    return { ok: false, error: "Wave did not respond — try again in a minute." };
  } finally {
    clearTimeout(timer);
  }
}

/** First few GraphQL complaints, joined and trimmed — never the whole payload. */
export function gqlErrorText(errors: Array<{ message?: string }>): string {
  return (
    errors
      .map((e) => e.message)
      .filter((m): m is string => typeof m === "string" && m.length > 0)
      .slice(0, 3)
      .join("; ")
      .slice(0, 300) || "no reason given"
  );
}

/**
 * Wave's mutations answer with didSucceed rather than an HTTP status, so a
 * refusal arrives looking exactly like a success. This turns one into the
 * other in the single place every mutation goes through.
 */
export function mutationError(payload: {
  didSucceed?: boolean;
  inputErrors?: Array<{ message?: string; path?: string[] }> | null;
}): string | null {
  if (payload.didSucceed) return null;
  const errs = payload.inputErrors ?? [];
  const text = errs
    .map((e) => (e.path?.length ? `${e.path.join(".")}: ${e.message ?? ""}` : (e.message ?? "")))
    .filter((m) => m.length > 0)
    .slice(0, 3)
    .join("; ");
  return text.slice(0, 300) || "Wave declined the request without saying why.";
}

const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

/** Case- and space-insensitive match, so "TC Services" finds "tc  services". */
export function sameName(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  return norm(a) === norm(b);
}

interface Edges<T> {
  edges: Array<{ node: T }>;
}

export interface WaveBusiness {
  id: string;
  name: string;
}
export interface WaveProduct {
  id: string;
  name: string;
}

/** Every business the token can see — the first thing a connection resolves. */
export async function listBusinesses(token: string): Promise<GqlResult<WaveBusiness[]>> {
  const res = await gql<{
    businesses: Edges<WaveBusiness & { isArchived: boolean }> | null;
  }>(token, `query { businesses(pageSize: 200) { edges { node { id name isArchived } } } }`);
  if (!res.ok) return res;
  const live = (res.data.businesses?.edges ?? [])
    .map((e) => e.node)
    .filter((b) => !b.isArchived)
    .map(({ id, name }) => ({ id, name }));
  return { ok: true, data: live };
}

/** Products in one business; the invoice line has to bill one of them. */
export async function listProducts(
  token: string,
  businessId: string,
): Promise<GqlResult<WaveProduct[]>> {
  const res = await gql<{ business: { products: Edges<WaveProduct> | null } | null }>(
    token,
    `query ($businessId: ID!) {
      business(id: $businessId) {
        products(pageSize: 200) { edges { node { id name } } }
      }
    }`,
    { businessId },
  );
  if (!res.ok) return res;
  return { ok: true, data: (res.data.business?.products?.edges ?? []).map((e) => e.node) };
}

/**
 * Turn what the tenant typed — a token, optionally a business name, and the
 * name of the service they bill — into the ids Wave actually needs. Nothing
 * is stored unless this resolves, so a wrong token or a missing product fails
 * on the Integrations page rather than silently at the first invoice.
 */
export async function resolveWaveConnection(input: {
  token: string;
  businessName?: string;
  productName?: string;
}): Promise<{ ok: true; conn: WaveConnection } | { ok: false; error: string }> {
  const wanted = (input.businessName ?? "").trim();
  const productName = (input.productName ?? "").trim() || "TC Services";

  const businesses = await listBusinesses(input.token);
  if (!businesses.ok) return { ok: false, error: businesses.error };
  if (businesses.data.length === 0) {
    return { ok: false, error: "That token can't see any Wave businesses." };
  }
  let business: WaveBusiness | undefined;
  if (wanted) {
    business = businesses.data.find((b) => sameName(b.name, wanted));
    if (!business) {
      return {
        ok: false,
        error: `No Wave business called "${wanted}". This token sees: ${businesses.data
          .map((b) => b.name)
          .join(", ")}.`,
      };
    }
  } else if (businesses.data.length === 1) {
    business = businesses.data[0];
  } else {
    return {
      ok: false,
      error: `This token sees more than one Wave business — name the one to bill from: ${businesses.data
        .map((b) => b.name)
        .join(", ")}.`,
    };
  }

  const products = await listProducts(input.token, business.id);
  if (!products.ok) return { ok: false, error: products.error };
  const product = products.data.find((p) => sameName(p.name, productName));
  if (!product) {
    return {
      ok: false,
      error: `No product called "${productName}" in ${business.name}. Create it in Wave (Sales & Payments → Products & Services), or enter the name of one you already bill.`,
    };
  }

  return {
    ok: true,
    conn: {
      businessId: business.id,
      businessName: business.name,
      productId: product.id,
      productName: product.name,
      token: input.token,
    },
  };
}

/**
 * Prove the stored connection still works, the way the ERPNext and Twenty
 * connectors do: a real authenticated read, plus a check that the billing
 * product is still there.
 */
export async function verifyWave(conn: WaveConnection): Promise<{ ok: boolean; error?: string }> {
  const products = await listProducts(conn.token, conn.businessId);
  if (!products.ok) return { ok: false, error: products.error };
  if (!products.data.some((p) => p.id === conn.productId)) {
    return {
      ok: false,
      error: `The product "${conn.productName}" is no longer in ${conn.businessName}.`,
    };
  }
  return { ok: true };
}

/**
 * Find the client's Wave customer, creating it when it isn't there yet.
 * Wave's customer list filters on email but not on name, so a client with an
 * email on file is one call and everyone else costs a bounded page walk —
 * past that we create rather than scan forever, which at worst leaves a
 * duplicate the tenant can merge in Wave.
 */
export async function ensureCustomer(
  conn: WaveConnection,
  clientName: string,
  clientEmail?: string | null,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (clientEmail) {
    const byEmail = await gql<{
      business: { customers: Edges<{ id: string; name: string }> | null } | null;
    }>(
      conn.token,
      `query ($businessId: ID!, $email: String) {
        business(id: $businessId) {
          customers(email: $email, pageSize: 20, sort: [NAME_ASC]) {
            edges { node { id name } }
          }
        }
      }`,
      { businessId: conn.businessId, email: clientEmail },
    );
    if (!byEmail.ok) return byEmail;
    const hit = (byEmail.data.business?.customers?.edges ?? []).map((e) => e.node);
    const named = hit.find((c) => sameName(c.name, clientName)) ?? hit[0];
    if (named) return { ok: true, id: named.id };
  }

  for (let page = 1; page <= CUSTOMER_MAX_PAGES; page++) {
    const res = await gql<{
      business: {
        customers: {
          pageInfo: { currentPage: number; totalPages: number };
          edges: Array<{ node: { id: string; name: string } }>;
        } | null;
      } | null;
    }>(
      conn.token,
      `query ($businessId: ID!, $page: Int!, $pageSize: Int!) {
        business(id: $businessId) {
          customers(page: $page, pageSize: $pageSize, sort: [NAME_ASC]) {
            pageInfo { currentPage totalPages }
            edges { node { id name } }
          }
        }
      }`,
      { businessId: conn.businessId, page, pageSize: CUSTOMER_PAGE_SIZE },
    );
    if (!res.ok) return res;
    const listed = res.data.business?.customers;
    const match = (listed?.edges ?? [])
      .map((e) => e.node)
      .find((c) => sameName(c.name, clientName));
    if (match) return { ok: true, id: match.id };
    if (!listed || listed.pageInfo.currentPage >= listed.pageInfo.totalPages) break;
  }

  const created = await gql<{
    customerCreate: {
      didSucceed: boolean;
      inputErrors: Array<{ message?: string; path?: string[] }> | null;
      customer: { id: string } | null;
    };
  }>(
    conn.token,
    `mutation ($input: CustomerCreateInput!) {
      customerCreate(input: $input) {
        didSucceed
        inputErrors { path message code }
        customer { id name }
      }
    }`,
    {
      input: {
        businessId: conn.businessId,
        name: clientName,
        ...(clientEmail ? { email: clientEmail } : {}),
      },
    },
  );
  if (!created.ok) return created;
  const failed = mutationError(created.data.customerCreate);
  if (failed || !created.data.customerCreate.customer) {
    return { ok: false, error: failed ?? "Wave created no customer." };
  }
  return { ok: true, id: created.data.customerCreate.customer.id };
}

export interface WaveInvoiceInput {
  customerName: string;
  customerEmail?: string | null;
  description: string;
  amountCents: number;
  dueDate: Date | null;
  /** Our own INV-0007, carried into Wave's memo for cross-reference. */
  reference: string;
  /** Itemization; when present, one Wave invoice item per line. */
  lines?: Array<{ description: string; amountCents: number }>;
}

/**
 * Create the invoice already approved (status SAVED) so it posts to their
 * books — a draft sitting in Wave would help nobody. Wave still owns sending
 * it to the client; Freehold's own email is what actually goes out, exactly
 * as it does for a Freehold-held invoice.
 */
export async function createWaveInvoice(
  conn: WaveConnection,
  input: WaveInvoiceInput,
): Promise<{ ok: true; id: string; url: string | null } | { ok: false; error: string }> {
  const customer = await ensureCustomer(conn, input.customerName, input.customerEmail);
  if (!customer.ok) return customer;

  const items = (
    input.lines && input.lines.length > 0
      ? input.lines
      : [{ description: input.description, amountCents: input.amountCents }]
  ).map((l) => ({
    productId: conn.productId,
    description: l.description,
    quantity: 1,
    // Wave takes a decimal amount, not cents.
    unitPrice: l.amountCents / 100,
  }));

  const res = await gql<{
    invoiceCreate: {
      didSucceed: boolean;
      inputErrors: Array<{ message?: string; path?: string[] }> | null;
      invoice: { id: string; viewUrl: string | null } | null;
    };
  }>(
    conn.token,
    `mutation ($input: InvoiceCreateInput!) {
      invoiceCreate(input: $input) {
        didSucceed
        inputErrors { path message code }
        invoice { id invoiceNumber status viewUrl }
      }
    }`,
    {
      input: {
        businessId: conn.businessId,
        customerId: customer.id,
        status: "SAVED",
        invoiceDate: dateOnly(new Date()),
        ...(input.dueDate ? { dueDate: dateOnly(input.dueDate) } : {}),
        memo: `${input.reference} — ${input.description}`,
        items,
      },
    },
  );
  if (!res.ok) return res;
  const failed = mutationError(res.data.invoiceCreate);
  if (failed || !res.data.invoiceCreate.invoice) {
    return { ok: false, error: failed ?? "Wave created no invoice." };
  }
  const invoice = res.data.invoiceCreate.invoice;
  return { ok: true, id: invoice.id, url: invoice.viewUrl ?? null };
}

export type MirroredStatus = "SENT" | "PAID" | "VOID";

/**
 * Wave's status vocabulary is long (DRAFT, SAVED, UNSENT, SENT, VIEWED,
 * PARTIAL, OVERDUE, PAID, OVERPAID). Only settled maps to PAID; everything
 * else means still outstanding. Defaulting that way keeps an unknown status
 * from silently marking a client's bill settled.
 */
export function mirrorStatus(waveStatus: string): MirroredStatus {
  const s = waveStatus.trim().toUpperCase();
  if (s === "PAID" || s === "OVERPAID") return "PAID";
  return "SENT";
}

/**
 * Current status of one invoice in their business. An invoice deleted in Wave
 * comes back null — that's a void here, not an error, since the bill really
 * is gone from the record.
 */
export async function fetchInvoiceStatus(
  conn: WaveConnection,
  id: string,
): Promise<{ ok: true; status: MirroredStatus } | { ok: false; error: string }> {
  const res = await gql<{
    business: { invoice: { id: string; status: string } | null } | null;
  }>(
    conn.token,
    `query ($businessId: ID!, $invoiceId: ID!) {
      business(id: $businessId) { invoice(id: $invoiceId) { id status } }
    }`,
    { businessId: conn.businessId, invoiceId: id },
  );
  if (!res.ok) return res;
  const invoice = res.data.business?.invoice;
  if (!invoice) return { ok: true, status: "VOID" };
  return { ok: true, status: mirrorStatus(invoice.status) };
}
