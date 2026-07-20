import { prisma, withTenant } from "@freehold/db";
import { billingEnabled } from "@freehold/ee-billing";
import { docusignAdapter } from "@freehold/integrations";
import Link from "next/link";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/copy-button";
import { createSkillKey, readNewSkillKey } from "@/lib/actions/api-keys";
import { connectDocumenso, disconnectDocumenso } from "@/lib/actions/esign-config";
import { connectFub, disconnectFub, importFubContacts } from "@/lib/actions/fub";
import { connectStorage, disconnectStorage } from "@/lib/actions/storage-config";
import { connectTwenty, disconnectTwenty, importTwentyContacts } from "@/lib/actions/twenty";
import { emailEnabled } from "@/lib/email";
import { documensoStatus } from "@/lib/esign-config";
import { fubStatus } from "@/lib/fub";
import { storageStatus } from "@/lib/storage-config";
import { requireAdminTenant } from "@/lib/tenant";
import { twentyStatus } from "@/lib/twenty";
import { btn, btnGhost, card, input, label as labelCls } from "@/lib/ui";

export const dynamic = "force-dynamic";

type Tone = "active" | "setup" | "included";

function StatusPill({ tone, label }: { tone: Tone; label: string }) {
  const cls =
    tone === "active"
      ? "bg-brand-50 text-brand-800"
      : tone === "included"
        ? "bg-stone-100 text-stone-600"
        : "bg-amber-50 text-amber-800";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

function skillPrompt(key: string): string {
  const base = (process.env.BETTER_AUTH_URL ?? "http://localhost:3010").replace(/\/$/, "");
  return `I manage real-estate transactions in Freehold. Use its REST API to answer questions about my workspace.

Base URL: ${base}/api/v1
Send this header with every request: Authorization: Bearer ${key}

Endpoints:
- GET /account — workspace overview and counts
- GET /clients — clients with portal activity
- GET /transactions — deals (filters: ?status=..., ?clientId=...)
- GET /tasks — deadlines across all deals, soonest first
- GET /contacts — CRM contacts with categories and A–D grades

When I ask what's closing, what's due, or how a client is doing, fetch the data and answer concisely. Never repeat the API key back to me.`;
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ storageOk?: string; storageError?: string }>;
}) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  const { storageOk, storageError } = await searchParams;
  const newSkillKey = await readNewSkillKey();

  const [apiKeys, webhooks] = await Promise.all([
    withTenant(tenantId, (tx) => tx.apiKey.count({ where: { revokedAt: null } })),
    withTenant(tenantId, (tx) => tx.webhookEndpoint.count({ where: { active: true } })),
  ]);
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { slug: true },
  });
  const documenso = await documensoStatus(tenantId);
  const fub = await fubStatus(tenantId);
  const twenty = await twentyStatus(tenantId);
  const storage = await storageStatus(tenantId);

  const cards: Array<{
    name: string;
    mono: string;
    tone: Tone;
    status: string;
    body: string;
    href?: string;
    hrefLabel?: string;
    external?: boolean;
    extra?: ReactNode;
  }> = [
    {
      name: "Email & reply capture",
      mono: "@",
      tone: emailEnabled() ? "active" : "setup",
      status: emailEnabled() ? "Active" : "Needs setup",
      body: emailEnabled()
        ? `Send from ${org.slug}@${process.env.EMAIL_FROM_DOMAIN} on any transaction's Emails tab; replies thread back automatically.`
        : "Set RESEND_API_KEY, EMAIL_FROM_DOMAIN, and EMAIL_REPLY_DOMAIN to send from your workspace's address with reply capture.",
      href: "/dashboard/transactions",
      hrefLabel: "Open a transaction → Emails tab",
    },
    {
      name: "Documenso e-signatures",
      mono: "Do",
      tone: (documenso.source ? "active" : "setup") as Tone,
      status:
        documenso.source === "tenant"
          ? "Connected"
          : documenso.source === "env"
            ? "Active"
            : "Needs connection",
      body: documenso.source
        ? `Sending via ${documenso.url}. Documents go out for signature from any transaction's Attachments tab; per-client provider choice on the client page.`
        : "Open-source e-signing. Connect your Documenso account below — paste your instance URL (or https://app.documenso.com) and an API token; we verify it before saving. Manual signing works regardless.",
      href: documenso.source ? "/dashboard/transactions" : undefined,
      hrefLabel: "Send from a transaction",
      extra:
        documenso.source === "tenant" ? (
          <form action={disconnectDocumenso} className="mt-2">
            <button type="submit" className="text-xs text-stone-400 hover:text-red-600">
              Disconnect
            </button>
          </form>
        ) : documenso.source === "env" ? undefined : (
          <form action={connectDocumenso} className="mt-3 flex flex-col gap-2">
            <label className={labelCls}>
              Documenso URL
              <input
                name="url"
                required
                placeholder="https://app.documenso.com"
                className={input}
              />
            </label>
            <label className={labelCls}>
              API token
              <input name="token" type="password" required placeholder="api_…" className={input} />
            </label>
            <button type="submit" className={`${btn} self-start`}>
              Verify &amp; connect
            </button>
          </form>
        ),
    },
    {
      name: "Document storage",
      mono: "St",
      tone: (storage.source === "tenant" ? "active" : "included") as Tone,
      status:
        storage.source === "tenant"
          ? "Your bucket"
          : storage.source === "platform"
            ? "Platform storage"
            : "Built-in",
      body:
        storage.source === "tenant"
          ? `New documents are written to your own bucket "${storage.bucket}". Files stored before you connected stay where they were. Everything is encrypted at rest.`
          : "By default Freehold stores your documents, encrypted at rest. Connect your own S3-compatible bucket — AWS S3, Cloudflare R2, Backblaze B2, Wasabi, or MinIO — to keep every new file in storage you control.",
      extra:
        storage.source === "tenant" ? (
          <form action={disconnectStorage} className="mt-2">
            <p className="mb-1.5 text-xs text-stone-400">
              Disconnecting leaves files already in this bucket readable only while it's connected —
              Freehold keeps no second copy.
            </p>
            <button type="submit" className="text-xs text-stone-400 hover:text-red-600">
              Disconnect
            </button>
          </form>
        ) : (
          <form action={connectStorage} className="mt-3 flex flex-col gap-2">
            <label className={labelCls}>
              Endpoint
              <input
                name="endpoint"
                required
                placeholder="https://s3.us-east-1.amazonaws.com"
                className={input}
              />
            </label>
            <div className="flex gap-2">
              <label className={`${labelCls} flex-1`}>
                Bucket
                <input name="bucket" required placeholder="my-firm-docs" className={input} />
              </label>
              <label className={`${labelCls} w-28`}>
                Region
                <input name="region" placeholder="us-east-1" className={input} />
              </label>
            </div>
            <label className={labelCls}>
              Access key ID
              <input name="accessKey" required className={input} />
            </label>
            <label className={labelCls}>
              Secret access key
              <input name="secretKey" type="password" required className={input} />
            </label>
            <button type="submit" className={`${btn} self-start`}>
              Verify &amp; connect
            </button>
          </form>
        ),
    },
    {
      name: "DocuSign e-signatures",
      mono: "DS",
      tone: (docusignAdapter.available().ok ? "active" : "included") as Tone,
      status: docusignAdapter.available().ok ? "Active" : "Self-hosted option",
      body: docusignAdapter.available().ok
        ? "Send documents for signature from any transaction's Attachments tab; per-client provider choice on the client page."
        : "Prefer DocuSign? It runs on self-hosted Freehold with your own DocuSign developer account. Don't want to touch servers? Our team sets up self-hosted Freehold, DocuSign, and your data migration for you — flat fee, quoted up front.",
      href: docusignAdapter.available().ok ? "/dashboard/transactions" : "/services",
      hrefLabel: docusignAdapter.available().ok ? "Send from a transaction" : "Setup & IT services",
    },
    {
      name: "Zapier",
      mono: "Z",
      tone: (webhooks > 0 ? "active" : "included") as Tone,
      status: webhooks > 0 ? "Active" : "Included",
      body: "Connect DocuSign, Dotloop, and 7,000+ apps using your own accounts — instant triggers from Freehold's signed webhooks, actions through the API. No approval processes anywhere.",
      href: "/docs/zapier",
      hrefLabel: "Setup guide & recipes",
    },
    {
      name: "Follow Up Boss",
      mono: "FB",
      tone: (fub.connected ? "active" : "setup") as Tone,
      status: fub.connected ? "Connected" : "Needs connection",
      body: fub.connected
        ? `Website leads flow into your Follow Up Boss automations, and you can pull your people into contacts.${fub.importedAt ? ` Last import: ${fub.importedCount} new contact${fub.importedCount === 1 ? "" : "s"} on ${fub.importedAt.slice(0, 10)}.` : ""}`
        : "Connect with your API key (Follow Up Boss → Admin → API) — website leads flow into your FUB automations and your people import as contacts. Verified before saving.",
      href: "/docs/followupboss",
      hrefLabel: "How it works",
      extra: fub.connected ? (
        <div className="mt-2 flex items-center gap-4">
          <form action={importFubContacts}>
            <button type="submit" className={`${btnGhost} px-2.5 py-1 text-xs`}>
              Import contacts now
            </button>
          </form>
          <form action={disconnectFub}>
            <button type="submit" className="text-xs text-stone-400 hover:text-red-600">
              Disconnect
            </button>
          </form>
        </div>
      ) : (
        <form action={connectFub} className="mt-3 flex flex-col gap-2">
          <label className={labelCls}>
            API key
            <input name="apiKey" type="password" required placeholder="fka_…" className={input} />
          </label>
          <button type="submit" className={`${btn} self-start`}>
            Verify &amp; connect
          </button>
        </form>
      ),
    },
    {
      name: "Twenty CRM",
      mono: "Tw",
      tone: (twenty.connected ? "active" : "setup") as Tone,
      status: twenty.connected ? "Connected" : "Needs connection",
      body: twenty.connected
        ? `Connected to ${twenty.url}. Website leads land in Twenty as people, and you can pull your people into contacts.${twenty.importedAt ? ` Last import: ${twenty.importedCount} new contact${twenty.importedCount === 1 ? "" : "s"} on ${twenty.importedAt.slice(0, 10)}.` : ""}`
        : "The open-source CRM. Connect your instance URL (or https://api.twenty.com) and an API key from Twenty's Settings → API & Webhooks — website leads flow in as people, and your people import as contacts. Verified before saving.",
      href: "/docs/twenty",
      hrefLabel: "How it works",
      extra: twenty.connected ? (
        <div className="mt-2 flex items-center gap-4">
          <form action={importTwentyContacts}>
            <button type="submit" className={`${btnGhost} px-2.5 py-1 text-xs`}>
              Import contacts now
            </button>
          </form>
          <form action={disconnectTwenty}>
            <button type="submit" className="text-xs text-stone-400 hover:text-red-600">
              Disconnect
            </button>
          </form>
        </div>
      ) : (
        <form action={connectTwenty} className="mt-3 flex flex-col gap-2">
          <label className={labelCls}>
            Twenty URL
            <input name="url" required placeholder="https://api.twenty.com" className={input} />
          </label>
          <label className={labelCls}>
            API key
            <input name="apiKey" type="password" required className={input} />
          </label>
          <button type="submit" className={`${btn} self-start`}>
            Verify &amp; connect
          </button>
        </form>
      ),
    },
    {
      name: "Claude Skill",
      mono: "AI",
      tone: apiKeys > 0 ? "active" : "setup",
      status: apiKeys > 0 ? "Ready" : "One-click setup",
      body: "Ask Claude about your own deals — what's closing this week, what's overdue, how a client is doing. One click creates your skill, then you paste a single prompt into Claude.",
      extra: (
        <div className="mt-3 flex flex-col gap-3">
          {newSkillKey ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-800">
                Your skill is ready. Copy this prompt and paste it into any Claude chat (or save it
                as project instructions). For your safety it's shown only once — generate a fresh
                one anytime.
              </p>
              <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded-md border border-amber-100 bg-white p-2.5 font-mono text-[11px] leading-relaxed text-stone-700">
                {skillPrompt(newSkillKey)}
              </pre>
              <div className="mt-2">
                <CopyButton text={skillPrompt(newSkillKey)} label="Copy prompt" />
              </div>
            </div>
          ) : isAdmin ? (
            <form action={createSkillKey}>
              <button type="submit" className={btnGhost}>
                {apiKeys > 0 ? "Generate a fresh skill prompt" : "Set up the Claude Skill"}
              </button>
            </form>
          ) : (
            <p className="text-xs text-stone-400">
              Ask a workspace admin to set this up — it takes one click.
            </p>
          )}
          <details className="group">
            <summary className="cursor-pointer select-none text-xs font-medium text-brand-700 hover:text-brand-600">
              How does this work? Is my data safe?
            </summary>
            <div className="mt-2 flex flex-col gap-2 rounded-lg bg-stone-50 p-3 text-xs leading-relaxed text-stone-600">
              <p>
                <strong className="text-stone-800">How it works.</strong> Setting up the skill (one
                click for a workspace admin) creates a private access key and wraps it in a short
                prompt. Paste that prompt into Claude once per conversation (or save it in a Claude
                project so it's always on). From then on, questions like "what's closing this week?"
                make Claude look at your live Freehold data and answer from it.
              </p>
              <p>
                <strong className="text-stone-800">Is my data safe?</strong> The key works like a
                password that mostly just <em>reads</em> your workspace — it can add a transaction
                or contact if you ask, but it can never delete anything, by design. Everything
                travels encrypted (HTTPS). Treat the prompt like a password: don't share it with
                anyone you wouldn't give your login.
              </p>
              <p>
                <strong className="text-stone-800">Changed your mind?</strong> Revoke the key any
                time in{" "}
                <Link href="/dashboard/settings" className="underline hover:text-brand-700">
                  Settings → API keys
                </Link>{" "}
                and the prompt stops working instantly.
              </p>
            </div>
          </details>
        </div>
      ),
    },
    {
      name: "Freehold API",
      mono: "{}",
      tone: apiKeys > 0 ? "active" : "setup",
      status: apiKeys > 0 ? `${apiKeys} active key${apiKeys === 1 ? "" : "s"}` : "No keys yet",
      body: "REST access to transactions, contacts, tasks, clients, and your account. Keys are shown once and stored hashed.",
      href: "/docs/api",
      hrefLabel: "API reference",
    },
    {
      name: "Signed webhooks",
      mono: "→",
      tone: webhooks > 0 ? "active" : "setup",
      status: webhooks > 0 ? `${webhooks} endpoint${webhooks === 1 ? "" : "s"}` : "None configured",
      body: "HMAC-signed events (transaction.created, task.completed) pushed to your own tools, with retries.",
      href: "/dashboard/settings",
      hrefLabel: "Manage webhooks",
    },
    {
      name: "Client invoicing (Stripe)",
      mono: "St",
      tone: billingEnabled() ? "active" : "setup",
      status: billingEnabled() ? "Active" : "Needs Stripe keys",
      body: "Invoice your clients with hosted payment pages; paid status syncs back automatically.",
      href: "/dashboard/invoices",
      hrefLabel: "Open invoices",
    },
    {
      name: "Calendar feeds",
      mono: "Ca",
      tone: "included",
      status: "Included",
      body: "Every client and agent portal carries a subscribe-once calendar feed — dates stay current in Google, Outlook, or Apple Calendar.",
      href: "/dashboard/clients",
      hrefLabel: "Share from a client's portals",
    },
    {
      name: "CSV import",
      mono: "⇥",
      tone: "included",
      status: "Included",
      body: "Bring contacts and transactions from spreadsheets or legacy platform exports, with a dry-run preview.",
      href: "/dashboard/import",
      hrefLabel: "Open import",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Integrations</h1>
        <p className="text-sm text-stone-500">
          What's connected in this workspace, what needs setup, and what's built in. Want one we
          don't have?{" "}
          <a href="mailto:hello@freeholdtc.dev" className="text-brand-700 hover:underline">
            Ask
          </a>{" "}
          — requests usually ship in days.
        </p>
      </div>

      {storageOk && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Storage connected — new documents will be written to your bucket.
        </p>
      )}
      {storageError && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{storageError}</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <section key={c.name} className={`${card} flex gap-4`}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-stone-100 font-display text-base font-bold text-stone-700">
              {c.mono}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-medium">{c.name}</h2>
                <StatusPill tone={c.tone} label={c.status} />
              </div>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">{c.body}</p>
              {c.href && (
                <Link
                  href={c.href}
                  className="mt-2 inline-block text-sm font-medium text-brand-700 hover:text-brand-600"
                >
                  {c.hrefLabel} →
                </Link>
              )}
              {c.extra}
            </div>
          </section>
        ))}
      </div>

      <p className="text-xs text-stone-400">
        The public roadmap of upcoming integrations lives on{" "}
        <Link href="/integrations" className="underline hover:text-brand-700">
          the integrations page
        </Link>
        .
      </p>
    </div>
  );
}
