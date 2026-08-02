import { prisma, withTenant } from "@freehold/db";
import { billingEnabled } from "@freehold/ee-billing";
import { docusignAdapter, makeOpenSignAdapter } from "@freehold/integrations";
import {
  Code,
  CurrencyDollar,
  Database,
  EnvelopeSimple,
  Signature,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { McpConnectorPanel } from "@/components/mcp-connector-panel";
import { SectionCard } from "@/components/section-card";
import { connectErpnext, disconnectErpnext } from "@/lib/actions/erpnext";
import { connectDocumenso, disconnectDocumenso } from "@/lib/actions/esign-config";
import { connectFub, disconnectFub, importFubContacts } from "@/lib/actions/fub";
import { refreshErpnextInvoices } from "@/lib/actions/invoices";
import { connectStorage, disconnectStorage } from "@/lib/actions/storage-config";
import { connectTwenty, disconnectTwenty, importTwentyContacts } from "@/lib/actions/twenty";
import { emailEnabled } from "@/lib/email";
import { parseErpnextConfig } from "@/lib/erpnext";
import { documensoStatus } from "@/lib/esign-config";
import { fubStatus } from "@/lib/fub";
import { openSignStatus } from "@/lib/opensign-config";
import { storageStatus } from "@/lib/storage-config";
import { requireAdminTenant } from "@/lib/tenant";
import { twentyStatus } from "@/lib/twenty";
import { btn, btnGhost, card, input, label as labelCls } from "@/lib/ui";

export const dynamic = "force-dynamic";

type Tone = "active" | "setup" | "included";

type Category =
  | "Communication"
  | "E-signatures"
  | "CRM & leads"
  | "Money"
  | "Storage & data"
  | "Developers & automation";

const CATEGORY_ORDER: Category[] = [
  "Communication",
  "E-signatures",
  "CRM & leads",
  "Money",
  "Storage & data",
  "Developers & automation",
];

const CATEGORY_ICON: Record<Category, typeof EnvelopeSimple> = {
  Communication: EnvelopeSimple,
  "E-signatures": Signature,
  "CRM & leads": UsersThree,
  Money: CurrencyDollar,
  "Storage & data": Database,
  "Developers & automation": Code,
};

function StatusPill({ tone, label }: { tone: Tone; label: string }) {
  const cls =
    tone === "active"
      ? "bg-brand-50 text-brand-800"
      : tone === "included"
        ? "bg-stone-100 text-stone-600"
        : "bg-amber-50 text-amber-800";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ storageOk?: string; storageError?: string; erpnextError?: string }>;
}) {
  const { tenantId, isAdmin, userId } = await requireAdminTenant();
  const { storageOk, storageError, erpnextError } = await searchParams;

  const [apiKeys, webhooks] = await Promise.all([
    withTenant(tenantId, (tx) => tx.apiKey.count({ where: { revokedAt: null } })),
    withTenant(tenantId, (tx) => tx.webhookEndpoint.count({ where: { active: true } })),
  ]);
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { slug: true, mcpEnabled: true },
  });
  const mcpEnabled = org.mcpEnabled;
  const documenso = await documensoStatus(tenantId);
  const opensignAvailable = makeOpenSignAdapter().available().ok;
  const opensign = opensignAvailable ? await openSignStatus(tenantId) : { connected: false };
  const fub = await fubStatus(tenantId);
  const twenty = await twentyStatus(tenantId);
  const storage = await storageStatus(tenantId);
  const erpnext = parseErpnextConfig(
    (
      await prisma.organization.findUniqueOrThrow({
        where: { id: tenantId },
        select: { erpnextConfig: true },
      })
    ).erpnextConfig,
  );

  const branding = new Map((await prisma.integrationBranding.findMany()).map((b) => [b.key, b]));

  const cards: Array<{
    key: string;
    name: string;
    category: Category;
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
      key: "email",
      name: "Email & reply capture",
      category: "Communication",
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
      key: "documenso",
      name: "Documenso e-signatures",
      category: "E-signatures",
      mono: "Do",
      tone: (documenso.source ? "active" : "setup") as Tone,
      status:
        documenso.source === "tenant"
          ? "Connected"
          : documenso.source === "env"
            ? "Active"
            : "Needs connection",
      body: documenso.source
        ? `Sending via ${documenso.url}. Documents go out for signature from any transaction's Documents tab; per-client provider choice on the client page.`
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
      key: "storage",
      name: "Document storage",
      category: "Storage & data",
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
      key: "docusign",
      name: "DocuSign e-signatures",
      category: "E-signatures",
      mono: "DS",
      tone: (docusignAdapter.available().ok ? "active" : "included") as Tone,
      status: docusignAdapter.available().ok ? "Active" : "Self-hosted option",
      body: docusignAdapter.available().ok
        ? "Send documents for signature from any transaction's Documents tab; per-client provider choice on the client page."
        : "Prefer DocuSign? It runs on self-hosted Freehold with your own DocuSign developer account. Don't want to touch servers? Our team sets up self-hosted Freehold, DocuSign, and your data migration for you — flat fee, quoted up front.",
      href: docusignAdapter.available().ok ? "/dashboard/transactions" : "/services",
      hrefLabel: docusignAdapter.available().ok ? "Send from a transaction" : "Setup & IT services",
    },
    ...(opensignAvailable
      ? [
          {
            key: "opensign",
            name: "OpenSign e-signatures",
            category: "E-signatures" as Category,
            mono: "OS",
            tone: "included" as Tone,
            status: opensign.connected ? "Ready" : "Included",
            // The "powered by OpenSign" wording is not just marketing: OpenSign
            // is AGPL-3.0 and we run it as a service your signers interact with,
            // so naming it and pointing at its source is the attribution that
            // keeps us straight. Don't quietly drop it.
            body: opensign.connected
              ? "Sending via Freehold's OpenSign. Documents go out for signature from any transaction's Documents tab; per-client provider choice on the client page. Powered by OpenSign, the open-source e-signature project."
              : "Open-source e-signing, included at no extra setup — nothing to connect. The first document you send provisions your workspace's space automatically. Powered by OpenSign, the open-source e-signature project.",
            href: "/dashboard/transactions",
            hrefLabel: "Send from a transaction",
          },
        ]
      : []),
    {
      key: "zapier",
      name: "Zapier",
      category: "Developers & automation",
      mono: "Z",
      tone: (webhooks > 0 ? "active" : "included") as Tone,
      status: webhooks > 0 ? "Active" : "Included",
      body: "Connect DocuSign, Dotloop, and 7,000+ apps using your own accounts — instant triggers from Freehold's signed webhooks, actions through the API. No approval processes anywhere.",
      href: "/docs/zapier",
      hrefLabel: "Setup guide & recipes",
    },
    {
      key: "fub",
      name: "Follow Up Boss",
      category: "CRM & leads",
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
      key: "twenty",
      name: "Twenty CRM",
      category: "CRM & leads",
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
      key: "erpnext",
      name: "ERPNext",
      category: "Money",
      mono: "ER",
      tone: (erpnext ? "active" : "setup") as Tone,
      status: erpnext ? "Connected" : "Optional",
      body: erpnext
        ? `Connected to ${erpnext.url}, billing item "${erpnext.itemCode}". Client invoices can be created as Sales Invoices in your ERPNext, and their paid status mirrors back here.`
        : "Already run ERPNext for your books? Connect it and you can issue client invoices as Sales Invoices there instead of keeping them in Freehold — your ERP stays the accounting record. Needs an API key/secret from your ERPNext user, and a service Item to bill against. Verified before saving.",
      extra: erpnext ? (
        <div className="mt-2 flex items-center gap-4">
          <form action={refreshErpnextInvoices}>
            <button type="submit" className={`${btnGhost} px-2.5 py-1 text-xs`}>
              Sync invoice statuses
            </button>
          </form>
          <form action={disconnectErpnext}>
            <button type="submit" className="text-xs text-stone-400 hover:text-red-600">
              Disconnect
            </button>
          </form>
        </div>
      ) : (
        <form action={connectErpnext} className="mt-3 flex flex-col gap-2">
          {erpnextError && (
            <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-800">
              {erpnextError}
            </p>
          )}
          <label className={labelCls}>
            ERPNext URL
            <input name="url" required placeholder="https://erp.example.com" className={input} />
          </label>
          <label className={labelCls}>
            API key
            <input name="apiKey" required className={input} />
          </label>
          <label className={labelCls}>
            API secret
            <input name="apiSecret" type="password" required className={input} />
          </label>
          <label className={labelCls}>
            Item to bill
            <input name="itemCode" placeholder="TC Services" className={input} />
          </label>
          <button type="submit" className={`${btn} self-start`}>
            Verify &amp; connect
          </button>
        </form>
      ),
    },
    {
      key: "mcp",
      name: "Claude connector",
      category: "Developers & automation",
      mono: "AI",
      tone: mcpEnabled ? "active" : "setup",
      status: mcpEnabled ? "On" : "Off",
      body: "Connect this workspace to Claude directly, so you can ask about your files in any Claude conversation without pasting anything. Each person signs in with their own account and sees only what their role already lets them see. Off until the workspace owner turns it on.",
      extra: <McpConnectorPanel tenantId={tenantId} userId={userId} isAdmin={isAdmin} />,
    },
    {
      key: "api",
      name: "Freehold API",
      category: "Developers & automation",
      mono: "{}",
      tone: apiKeys > 0 ? "active" : "setup",
      status: apiKeys > 0 ? `${apiKeys} active key${apiKeys === 1 ? "" : "s"}` : "No keys yet",
      body: "REST access to transactions, contacts, tasks, clients, and your account. Keys are shown once and stored hashed.",
      href: "/docs/api",
      hrefLabel: "API reference",
    },
    {
      key: "webhooks",
      name: "Signed webhooks",
      category: "Developers & automation",
      mono: "→",
      tone: webhooks > 0 ? "active" : "setup",
      status: webhooks > 0 ? `${webhooks} endpoint${webhooks === 1 ? "" : "s"}` : "None configured",
      body: "HMAC-signed events (transaction.created, task.completed) pushed to your own tools, with retries.",
      href: "/dashboard/settings",
      hrefLabel: "Manage webhooks",
    },
    {
      key: "stripe",
      name: "Client invoicing (Stripe)",
      category: "Money",
      mono: "St",
      tone: billingEnabled() ? "active" : "setup",
      status: billingEnabled() ? "Active" : "Needs Stripe keys",
      body: "Invoice your clients with hosted payment pages; paid status syncs back automatically.",
      href: "/dashboard/invoices",
      hrefLabel: "Open invoices",
    },
    {
      key: "calendar",
      name: "Calendar feeds",
      category: "Communication",
      mono: "Ca",
      tone: "included",
      status: "Included",
      body: "Every client and agent portal carries a subscribe-once calendar feed — dates stay current in Google, Outlook, or Apple Calendar.",
      href: "/dashboard/clients",
      hrefLabel: "Share from a client's portals",
    },
    {
      key: "csv-import",
      name: "CSV import",
      category: "Storage & data",
      mono: "⇥",
      tone: "included",
      status: "Included",
      body: "Bring contacts and transactions from spreadsheets or legacy platform exports, with a dry-run preview.",
      href: "/dashboard/import",
      hrefLabel: "Open import",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
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

      {CATEGORY_ORDER.map((category) => {
        const items = cards.filter((c) => c.category === category);
        if (items.length === 0) return null;
        const Icon = CATEGORY_ICON[category];
        return (
          <SectionCard
            key={category}
            title={category}
            icon={<Icon size={16} />}
            count={items.length}
          >
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((c) => {
                const b = branding.get(c.key);
                return (
                  <section key={c.name} className={`${card} flex gap-4`}>
                    {b?.logo ? (
                      // biome-ignore lint/performance/noImgElement: an operator-uploaded data URL, not a bundled asset next/image can size.
                      <img
                        src={b.logo}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-xl border border-stone-200 object-contain p-1"
                      />
                    ) : (
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-stone-100 font-display text-base font-bold text-stone-700">
                        {c.mono}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-medium">{c.name}</h2>
                        <StatusPill tone={c.tone} label={c.status} />
                        {b?.url && (
                          <a
                            href={b.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-medium text-stone-400 hover:text-brand-700"
                          >
                            Website ↗
                          </a>
                        )}
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
                );
              })}
            </div>
          </SectionCard>
        );
      })}

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
