import { withTenant } from "@freehold/db";
import { fmtDate } from "./format";
import { FREEHOLD_FACTS, FREEHOLD_RULES } from "./freehold-facts";
import { claimFounderCallSlot, getPlatformSettings } from "./platform-settings";
import { resolveAgentPortal, resolvePortal } from "./portal";
import type { VoiceScope } from "./voice-grant";

/**
 * The read surface the voice agent is allowed to reach, and nothing wider.
 *
 * Deliberately NOT a refactor of the public REST API (`/api/v1`): that returns
 * 200–500-row dumps shaped for programmatic consumers, which is the wrong
 * shape to read aloud and a lot of tokens to spend. These return small,
 * already-summarised answers.
 *
 * The scope always comes from a verified grant (see voice-grant.ts). No tool
 * takes a tenant id, portal token, or transaction id from the model — the
 * model can only ask questions, never widen its own reach. Portal tools defer
 * to the same resolvers the portal pages themselves use, so a spoken answer
 * can never exceed what that link's own page already renders.
 */

export interface VoiceTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}

/**
 * Every page the navigate tool can send someone to, mirrored from the
 * sidebar's own GROUPS (dashboard-nav.tsx) so the two never drift. Guests get
 * the same restricted subset the sidebar shows them (GUEST_HREFS there) —
 * duplicated here since that file is a client component and this one isn't.
 */
const PAGE_PATHS: Record<string, string> = {
  dashboard: "/dashboard",
  transactions: "/dashboard/transactions",
  calendar: "/dashboard/calendar",
  contacts: "/dashboard/contacts",
  clients: "/dashboard/clients",
  documents: "/dashboard/documents",
  "action-plans": "/dashboard/action-plans",
  compliance: "/dashboard/compliance",
  templates: "/dashboard/templates",
  emails: "/dashboard/emails",
  vault: "/dashboard/vault",
  import: "/dashboard/import",
  invoices: "/dashboard/invoices",
  directory: "/dashboard/directory",
  vendors: "/dashboard/vendors",
  engagements: "/dashboard/engagements",
  website: "/dashboard/website",
  integrations: "/dashboard/integrations",
  team: "/dashboard/team",
  billing: "/dashboard/billing",
  support: "/dashboard/support",
};
const GUEST_PAGES = new Set(["dashboard", "transactions", "calendar", "support"]);

const TENANT_TOOLS: VoiceTool[] = [
  {
    name: "workspace_summary",
    description:
      "Counts across the whole workspace: active and closed transactions, clients, contacts, open tasks. Use for 'how many' or 'how's business' questions.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "search_transactions",
    description:
      "Find transactions by property address or client name. Omit the query to list the most recent. Optionally filter by status.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Address or client name, partial match" },
        status: {
          type: "string",
          description:
            "DRAFT, COMING_SOON, ACTIVE, TMP_OFF_MARKET, UNDER_CONTRACT, PENDING, CLOSED, or CANCELLED",
        },
      },
    },
  },
  {
    name: "upcoming_deadlines",
    description:
      "Open tasks and closings due in the next N days (default 7). Use for 'what's due', 'what's closing', 'what's coming up'.",
    input_schema: {
      type: "object",
      properties: { days: { type: "number", description: "How many days ahead, default 7" } },
    },
  },
  {
    name: "find_people",
    description:
      "Search contacts and clients by name, email, or phone. Use for 'what's so-and-so's number' or 'who is the lender on'.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Name, email, or phone fragment" } },
      required: ["query"],
    },
  },
  {
    name: "navigate",
    description:
      "Open a page, or a specific record, in the app right now. Call this whenever the answer is about one particular transaction, contact, or client — not only when they say 'show me' or 'open'. Naming a record is asking for it. Look it up with search_transactions or find_people first to get its id, then pass that id here (instead of page) in the same turn. Skip it only when there is no single record involved: counts, deadlines across several files, or a list of unrelated things.",
    input_schema: {
      type: "object",
      properties: {
        page: {
          type: "string",
          description: `One of: ${Object.keys(PAGE_PATHS).join(", ")}`,
        },
        transactionId: {
          type: "string",
          description:
            "Go straight to this transaction (id from a prior search_transactions result)",
        },
        contactId: {
          type: "string",
          description: "Go straight to this contact (id from a prior find_people result)",
        },
        clientId: {
          type: "string",
          description: "Go straight to this client (id from a prior find_people result)",
        },
      },
    },
  },
];

const PORTAL_TOOLS: VoiceTool[] = [
  {
    name: "my_files",
    description:
      "The transaction(s) this person can see: address, status, and key dates. Use for 'where are we', 'what's the status', 'when do we close'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "my_dates",
    description: "Upcoming milestones and deadlines visible to this person.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "my_documents",
    description: "Names of documents shared with this person. Never returns file contents.",
    input_schema: { type: "object", properties: {} },
  },
];

const CALL_THE_FOUNDER_TOOL: VoiceTool = {
  name: "call_the_founder",
  description:
    "Bring the developer into this same call live, right now. Call this ONLY after the " +
    "visitor has clearly agreed to the idea when you offered it — never on your own " +
    "initiative mid-answer, and never more than once per conversation. It may fail if he's " +
    "unavailable or another call just connected; if so, say so warmly and move on.",
  input_schema: { type: "object", properties: {} },
};

export async function toolsForScope(scope: VoiceScope): Promise<VoiceTool[]> {
  if (scope.kind === "dictation") return [];
  if (scope.kind === "marketing") {
    const settings = await getPlatformSettings();
    return settings.founderCallsAvailable ? [CALL_THE_FOUNDER_TOOL] : [];
  }
  return scope.kind === "portal" ? PORTAL_TOOLS : TENANT_TOOLS;
}

/** Spoken-answer rules every scope shares. */
const SPEAKING_STYLE = `You are being LISTENED TO, not read. So:
- Answer in one or two short sentences. Never read out a list of more than
  three items — summarise instead.
- Say dates like a person does: "Friday the 24th", not "2026-07-24".
- Never say IDs, URLs, or raw field names.
- Money: "three eighty-five" or "three hundred eighty-five thousand".`;

const WORKSPACE_INSTRUCTIONS = `You are Freehold's voice assistant, helping a real
estate transaction coordinator find information by voice.

${SPEAKING_STYLE}

Always call a tool before answering a question about their data — never guess or
rely on memory of earlier answers. If a lookup comes back empty, say so plainly.
If asked something you have no tool for, say you can't help with that yet and
suggest the dashboard. Keep it warm and quick.

This is a search box, so finding something and going there are the same act.
Navigate to the record they NAMED, in the same turn you look it up — if they name
a client, open the client, even though the lookup also returns that client's
transactions. Those extra results are context for your answer, not a menu to
offer them. Don't wait to be asked twice, and don't ask which one they meant when
one of the matches is plainly the thing they said: pick the closest name match
and go. Read the answer out as you go; the page opens behind you.

Stay put only when there is no single record to open — counts, "what's due this
week", or a genuine list of several unrelated things.

Say your whole answer in the same message as the navigate call, not afterwards —
navigate tells you nothing back, so anything you leave until after it just makes
them wait longer. Make it a real answer ("That's the Harbor Lane file — closing
Thursday the 30th"), not a progress report.

Never offer to do something you could just do. And if you do ask ("want me to
pull that up?") and they agree — "yes", "sure", "go ahead", or anything meaning
it — do it in that turn: call the tool, don't ask again. Re-run whatever lookup
you need for the id rather than saying you're not sure what they meant.`;

const PORTAL_INSTRUCTIONS = `You are Freehold's voice assistant, speaking with a
buyer, seller, or agent about their own transaction.

${SPEAKING_STYLE}

Always call a tool before answering — never guess. You can only see this one
person's file; if they ask about anything else, say you can only help with their
transaction and suggest they contact their coordinator. Be reassuring and brief:
these are people mid-move, and this is often the most stressful purchase of
their life.`;

export function marketingInstructions(opts: {
  sellingPoints: string | null;
  callAvailable: boolean;
}): string {
  const sellingPointsBlock = opts.sellingPoints?.trim()
    ? `\nKey things to weave in naturally when relevant (in your own words, never read verbatim):\n${opts.sellingPoints.trim()}\n`
    : "";

  // The greeting itself already leads with the call proposal when this is
  // available (see MARKETING_GREETING_WITH_CALL) — this block just documents
  // the standing rule for the rest of the conversation: still requires a
  // clear yes before the tool is ever called, and only offered the once.
  const callOfferBlock = opts.callAvailable
    ? `
You have a call_the_founder tool. You'll typically have already proposed this
as your opening line — if they say yes, call the tool. If they haven't
answered yet or changed the subject, that's fine, don't push it again; you
only get the one offer per conversation. Only ever call the tool on a clear yes
— never on anything ambiguous. If it fails (he's mid-call, or just stepped
away), say so warmly — never apologize excessively, just move on.`
    : "";

  return `You are the voice of Freehold, greeting a visitor on the homepage who
has never used it. You have no access to any customer data — you are here to
explain Freehold and answer questions about it.

${SPEAKING_STYLE}

${FREEHOLD_FACTS}

${FREEHOLD_RULES}
${sellingPointsBlock}
Be genuinely useful, not salesy. If Freehold isn't a fit for what they describe,
say so — that honesty is the product's whole personality. Point people to the
live demo or hello@freeholdtc.dev when it's the better answer.
${callOfferBlock}`;
}

/** The opening line when the call-the-founder feature is off: a short pitch,
 *  half the length of the old one — just the one-line hook, not three
 *  enumerated features (those still come up naturally if asked about). */
export const MARKETING_GREETING = `Give a warm five-second pitch, in your own
words, exactly one sentence: Freehold is AI-powered transaction management and
CRM for real estate transaction coordinators. Then invite them to ask anything.`;

/** The opening line when the call feature is on: still give the short pitch
 *  first — a visitor who's never heard of Freehold needs that before anything
 *  else makes sense — then immediately pivot into genuine surprised
 *  excitement about the call feature and propose trying it. Still needs a
 *  clear yes before the tool is ever called (see marketingInstructions'
 *  callOfferBlock); this only covers how the opening two beats are ordered. */
export const MARKETING_GREETING_WITH_CALL = `Give the same warm five-second,
one-sentence pitch as always, in your own words: Freehold is AI-powered
transaction management and CRM for real estate transaction coordinators. Then,
right after that — same breath, not a new topic — pivot into genuine surprised
excitement: something just got added, you can bring the actual Freehold
developer onto this call live, right now, no typing needed, just to say hi and
prove it works. Ask if they want to try it. Two short beats total, not a long
speech.`;

const WORKSPACE_GREETING = "Greet them in one short sentence and ask what they'd like to know.";

const PORTAL_GREETING = `Greet them warmly in one short sentence, mention you can
answer questions about their transaction, and invite them to ask.`;

/** Persona + opening line for a scope. Kept server-side so the agent stays generic. */
export async function briefForScope(
  scope: VoiceScope,
): Promise<{ instructions: string; greeting: string; mode?: string }> {
  if (scope.kind === "dictation") {
    // Non-empty instructions so the agent's "did the app vouch for this grant?"
    // gate passes; `mode` tells it to run STT-only (no LLM, no TTS, no greeting).
    return { mode: "dictation", instructions: "(dictation)", greeting: "" };
  }
  if (scope.kind === "marketing") {
    const settings = await getPlatformSettings();
    return {
      instructions: marketingInstructions({
        sellingPoints: settings.founderCallSellingPoints,
        callAvailable: settings.founderCallsAvailable,
      }),
      greeting: settings.founderCallsAvailable ? MARKETING_GREETING_WITH_CALL : MARKETING_GREETING,
    };
  }
  if (scope.kind === "portal") {
    return { instructions: PORTAL_INSTRUCTIONS, greeting: PORTAL_GREETING };
  }
  return { instructions: WORKSPACE_INSTRUCTIONS, greeting: WORKSPACE_GREETING };
}

const NOT_FOUND = { result: "Nothing matched." };

/** Transactions a guest may see: only the ones they're assigned to. */
function guestFilter(scope: VoiceScope) {
  return scope.kind === "guest" ? { assignees: { some: { userId: scope.userId } } } : {};
}

async function runTenantTool(
  scope: Extract<VoiceScope, { kind: "tenant" | "guest" }>,
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const { tenantId } = scope;
  const scoped = guestFilter(scope);

  // No DB access needed: just resolve a destination the client will route to.
  // A destination id only ever reaches here because the model read it off an
  // earlier tool result in this same turn — those results are already scoped
  // (guest-filtered transactions, no contacts/clients for guests at all) — and
  // the destination page re-checks access regardless, so a wrong or
  // hallucinated id 404s rather than leaking anything.
  if (name === "navigate") {
    const isGuest = scope.kind === "guest";
    const transactionId = typeof input.transactionId === "string" ? input.transactionId : "";
    const contactId = typeof input.contactId === "string" ? input.contactId : "";
    const clientId = typeof input.clientId === "string" ? input.clientId : "";

    if (transactionId) return { navigateTo: `/dashboard/transactions/${transactionId}` };
    // Guests coordinate files, not the CRM — same "no directory access" rule
    // find_people already enforces for them.
    if (!isGuest && contactId) return { navigateTo: `/dashboard/contacts/${contactId}` };
    if (!isGuest && clientId) return { navigateTo: `/dashboard/clients/${clientId}` };

    const page = typeof input.page === "string" ? input.page : "";
    if (!(page in PAGE_PATHS) || (isGuest && !GUEST_PAGES.has(page))) {
      return { error: "Can't go there." };
    }
    return { navigateTo: PAGE_PATHS[page] };
  }

  if (name === "workspace_summary") {
    return withTenant(tenantId, async (tx) => ({
      activeTransactions: await tx.transaction.count({
        where: { ...scoped, status: { notIn: ["CLOSED", "CANCELLED"] } },
      }),
      closedTransactions: await tx.transaction.count({ where: { ...scoped, status: "CLOSED" } }),
      openTasks: await tx.task.count({ where: { status: "OPEN" } }),
      ...(scope.kind === "tenant"
        ? { clients: await tx.client.count(), contacts: await tx.contact.count() }
        : {}),
    }));
  }

  if (name === "search_transactions") {
    const query = typeof input.query === "string" ? input.query.trim() : "";
    const status = typeof input.status === "string" ? input.status : null;
    const rows = await withTenant(tenantId, (tx) =>
      tx.transaction.findMany({
        where: {
          ...scoped,
          ...(status ? { status: status as never } : {}),
          ...(query
            ? {
                OR: [
                  { propertyAddress: { contains: query, mode: "insensitive" as const } },
                  { client: { name: { contains: query, mode: "insensitive" as const } } },
                ],
              }
            : {}),
        },
        orderBy: { updatedAt: "desc" },
        take: 15,
        select: {
          id: true,
          propertyAddress: true,
          status: true,
          closeDate: true,
          contractDate: true,
          purchasePrice: true,
          client: { select: { name: true } },
        },
      }),
    );
    if (rows.length === 0) return NOT_FOUND;
    return rows.map((t) => ({
      id: t.id,
      address: t.propertyAddress,
      status: t.status,
      client: t.client?.name ?? null,
      closeDate: fmtDate(t.closeDate),
      contractDate: fmtDate(t.contractDate),
      price: t.purchasePrice,
    }));
  }

  if (name === "upcoming_deadlines") {
    const days = typeof input.days === "number" && input.days > 0 ? Math.min(input.days, 90) : 7;
    const until = new Date(Date.now() + days * 24 * 3600 * 1000);
    return withTenant(tenantId, async (tx) => {
      const tasks = await tx.task.findMany({
        where: {
          status: "OPEN",
          dueDate: { lte: until },
          ...(scope.kind === "guest" ? { transaction: scoped } : {}),
        },
        orderBy: { dueDate: "asc" },
        take: 25,
        select: {
          title: true,
          dueDate: true,
          priority: true,
          transaction: { select: { id: true, propertyAddress: true } },
        },
      });
      const closings = await tx.transaction.findMany({
        where: {
          ...scoped,
          closeDate: { lte: until, gte: new Date(Date.now() - 24 * 3600 * 1000) },
          status: { notIn: ["CLOSED", "CANCELLED"] },
        },
        orderBy: { closeDate: "asc" },
        select: { id: true, propertyAddress: true, closeDate: true },
      });
      if (tasks.length === 0 && closings.length === 0) {
        return { result: `Nothing due in the next ${days} days.` };
      }
      return {
        tasks: tasks.map((t) => ({
          title: t.title,
          due: fmtDate(t.dueDate),
          priority: t.priority,
          transactionId: t.transaction?.id ?? null,
          address: t.transaction?.propertyAddress ?? null,
        })),
        closings: closings.map((c) => ({
          id: c.id,
          address: c.propertyAddress,
          closeDate: fmtDate(c.closeDate),
        })),
      };
    });
  }

  if (name === "find_people") {
    // Guests coordinate files, not the CRM — they get no directory access.
    if (scope.kind === "guest") return { result: "Not available." };
    const query = typeof input.query === "string" ? input.query.trim() : "";
    if (!query) return NOT_FOUND;
    const like = { contains: query, mode: "insensitive" as const };
    const [contacts, clients] = await withTenant(tenantId, async (tx) => [
      await tx.contact.findMany({
        where: { OR: [{ name: like }, { email: like }, { phone: like }] },
        take: 10,
        select: { id: true, name: true, email: true, phone: true, category: true },
      }),
      await tx.client.findMany({
        where: { OR: [{ name: like }, { email: like }] },
        take: 10,
        select: { id: true, name: true, email: true, phone: true, type: true },
      }),
    ]);
    if (contacts.length === 0 && clients.length === 0) return NOT_FOUND;
    return { contacts, clients };
  }

  return { error: "unknown_tool" };
}

/**
 * Portal tools. Every one re-derives its data from the capability token via
 * the same resolvers the portal pages use — which already apply
 * visibleToClient / visibleToAgent and the per-link show* toggles. Nothing
 * here accepts an id, so there is no parameter a model could bend toward
 * another file.
 */
async function runPortalTool(token: string, name: string): Promise<unknown> {
  const client = await resolvePortal(token);
  const agent = client ? null : await resolveAgentPortal(token);
  if (!client && !agent) return { error: "link_not_found" };

  if (client) {
    const { txn } = client;
    if (name === "my_files") {
      return {
        address: txn.propertyAddress,
        status: txn.status,
        closeDate: fmtDate(txn.closeDate),
        contractDate: fmtDate(txn.contractDate),
      };
    }
    if (name === "my_dates") {
      const open = txn.tasks.filter((t) => t.dueDate);
      if (open.length === 0) return { result: "No dates are shared on this file yet." };
      return open.map((t) => ({ milestone: t.title, date: fmtDate(t.dueDate), status: t.status }));
    }
    if (name === "my_documents") {
      if (txn.documents.length === 0) return { result: "No documents shared yet." };
      return txn.documents.map((d) => ({ name: d.filename, added: fmtDate(d.createdAt) }));
    }
  }

  if (agent) {
    if (name === "my_files") {
      return agent.transactions.map((t) => ({
        address: t.propertyAddress,
        status: t.status,
        closeDate: fmtDate(t.closeDate),
      }));
    }
    if (name === "my_dates") {
      if (agent.upcoming.length === 0) return { result: "Nothing coming up in the next 30 days." };
      return agent.upcoming.map((t) => ({
        milestone: t.title,
        date: fmtDate(t.dueDate),
        address: t.transaction?.propertyAddress ?? null,
      }));
    }
    if (name === "my_documents") {
      if (agent.recentDocs.length === 0) return { result: "No recent documents." };
      return agent.recentDocs.map((d) => ({
        name: d.filename,
        address: d.transaction?.propertyAddress ?? null,
      }));
    }
  }

  return { error: "unknown_tool" };
}

/**
 * Whether this tool-use turn can be the last one.
 *
 * `navigate` hands back a path and nothing else — there is no fact in its
 * result the model could reason about on another pass. So when every call in
 * a turn was navigate and the model already wrote its sentence alongside them,
 * looping again buys nothing and costs a whole round trip. That round trip was
 * a third of the wait on "find X and open it", which is the most common thing
 * anyone asks this box.
 *
 * Both conditions matter. Without `said` we would return an empty reply; and a
 * turn that also called a lookup still needs the next pass, because those
 * results are exactly what the answer is made of.
 */
export function turnIsTerminal(
  toolNames: readonly string[],
  said: string,
  navigateTo: string | undefined,
): boolean {
  if (!navigateTo || said.trim() === "") return false;
  return toolNames.length > 0 && toolNames.every((n) => n === "navigate");
}

export interface VoiceReference {
  type: "transaction" | "contact" | "client";
  id: string;
  label: string;
}

/**
 * Pull id+label pairs out of a tool result (search_transactions,
 * upcoming_deadlines, find_people) so the caller can turn a matching mention
 * in the model's reply text into a link. Shape-sniffing and best-effort — a
 * result that doesn't look like one of these never throws, just yields
 * nothing.
 */
export function extractReferences(result: unknown): VoiceReference[] {
  const refs: VoiceReference[] = [];
  const pushTransaction = (row: unknown, idKey: "id" | "transactionId" = "id") => {
    if (!row || typeof row !== "object") return;
    const rec = row as Record<string, unknown>;
    const id = rec[idKey];
    const address = rec.address;
    if (typeof id === "string" && typeof address === "string") {
      refs.push({ type: "transaction", id, label: address });
    }
  };
  const pushPerson = (row: unknown, type: "contact" | "client") => {
    if (!row || typeof row !== "object") return;
    const { id, name } = row as Record<string, unknown>;
    if (typeof id === "string" && typeof name === "string") {
      refs.push({ type, id, label: name });
    }
  };
  if (Array.isArray(result)) {
    for (const row of result) pushTransaction(row);
  } else if (result && typeof result === "object") {
    const { contacts, clients, tasks, closings } = result as Record<string, unknown>;
    if (Array.isArray(contacts)) for (const c of contacts) pushPerson(c, "contact");
    if (Array.isArray(clients)) for (const c of clients) pushPerson(c, "client");
    if (Array.isArray(tasks)) for (const t of tasks) pushTransaction(t, "transactionId");
    if (Array.isArray(closings)) for (const c of closings) pushTransaction(c);
  }
  return refs;
}

/** Dispatch a tool call under a verified scope. Never throws to the caller. */
export async function runVoiceTool(
  scope: VoiceScope,
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  try {
    // Dictation transcribes only — it publishes no tools, so nothing to run.
    if (scope.kind === "dictation") return { error: "no_tools_in_this_scope" };
    if (scope.kind === "marketing") {
      // The only marketing tool. Re-checks availability + cooldown at
      // execution time (not just at brief-fetch time), since the flag or the
      // cooldown window can change mid-conversation. The agent does the
      // actual SIP dial-out itself, using its own credentials — this only
      // grants (and atomically claims) permission to do so.
      if (name !== "call_the_founder") return { error: "no_tools_in_this_scope" };
      const claimed = await claimFounderCallSlot();
      return claimed
        ? { ok: true }
        : { ok: false, reason: "not available right now — try again in a few minutes" };
    }
    if (scope.kind === "portal") return await runPortalTool(scope.portalToken, name);
    return await runTenantTool(scope, name, input);
  } catch {
    return { error: "lookup_failed" };
  }
}
