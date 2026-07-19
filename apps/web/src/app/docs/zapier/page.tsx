import Link from "next/link";
import { MarketingFooter, MarketingNav } from "@/components/marketing";

export const metadata = {
  title: "Zapier | Freehold docs",
  description:
    "Connect Freehold to DocuSign, Dotloop, and 7,000+ apps with Zapier: instant triggers from signed webhooks, actions through the REST API. No approvals, your own accounts.",
};

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4 border-b border-stone-200/70 py-5 last:border-0">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 font-display text-sm font-bold text-brand-800">
        {n}
      </span>
      <div>
        <h3 className="font-medium">{title}</h3>
        <div className="mt-1 text-sm leading-relaxed text-stone-600">{children}</div>
      </div>
    </li>
  );
}

export default function ZapierDocsPage() {
  return (
    <main className="bg-stone-50 text-stone-900">
      <MarketingNav />
      <section className="mx-auto max-w-3xl px-4 pb-20 pt-12 sm:px-6">
        <h1 className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight">
          Freehold + Zapier
        </h1>
        <p className="mt-4 leading-relaxed text-stone-600">
          Zapier connects your workspace to DocuSign, Dotloop, and 7,000+ other apps — using{" "}
          <em>your</em> accounts in those tools, with nothing to install and no approval processes.
          Freehold's side is powered by instant, signed webhooks and the{" "}
          <Link href="/docs/api" className="text-brand-700 underline hover:text-brand-600">
            REST API
          </Link>
          .
        </p>

        <div className="mt-8 rounded-2xl border border-stone-200/70 bg-white p-6">
          <h2 className="font-display text-xl font-bold tracking-tight">What Freehold offers</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            <strong>Instant triggers:</strong> new transaction, new contact (including website
            leads), task completed, document uploaded, envelope completed.
            <br />
            <strong>Actions:</strong> create transaction, create contact, create task, add a
            transaction note.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-stone-600">
            You connect with two values: your Freehold URL and an API key from{" "}
            <span className="font-medium">Settings → API keys</span>.{" "}
            <a
              href="https://zapier.com/developer/public-invite/244096/505268/a6d7aefc0073936c93c825ddd163fb56/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand-700 underline"
            >
              Add the Freehold app to your Zapier account →
            </a>{" "}
            Prefer not to? "Webhooks by Zapier" works too, with the endpoints below.
          </p>
        </div>

        <h2 className="font-display mt-12 text-2xl font-bold tracking-tight">
          Recipe 1 — DocuSign signing loop
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          Upload a document in Freehold, DocuSign sends it for signature from your own DocuSign
          account, and the completion lands back on the transaction.
        </p>
        <ol className="mt-2">
          <Step n={1} title="Trigger: Freehold — Document Uploaded">
            With the Freehold app, pick the "Document Uploaded" trigger. (Webhooks by Zapier works
            too: catch hook, then add a webhook endpoint in Freehold Settings for{" "}
            <code className="font-mono text-xs">document.uploaded</code>.)
          </Step>
          <Step n={2} title="Action: DocuSign — Send Envelope">
            Connect your DocuSign account in Zapier and use "Send Envelope Using Document" (or a
            template). Map the signer names and emails from the transaction.
          </Step>
          <Step n={3} title="Trigger: DocuSign — Envelope Completed">
            A second Zap: when DocuSign reports the envelope complete…
          </Step>
          <Step n={4} title="Action: Freehold — Add Transaction Note">
            …write it back: "Signed via DocuSign" lands on the transaction's Notes, timestamped. Or
            create a task for the next step of your checklist.
          </Step>
        </ol>

        <h2 className="font-display mt-12 text-2xl font-bold tracking-tight">
          Recipe 2 — Dotloop sync
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          Working alongside a team that lives in Dotloop? Keep both systems current without double
          entry.
        </p>
        <ol className="mt-2">
          <Step n={1} title="Trigger: Freehold — New Transaction">
            Every new Freehold transaction…
          </Step>
          <Step n={2} title="Action: Dotloop — Create Loop">
            …creates a matching loop in your Dotloop account, with the address and details mapped.
          </Step>
          <Step n={3} title="Trigger: Dotloop — Loop Status Change">
            And in the other direction: when a loop's status changes…
          </Step>
          <Step n={4} title="Action: Freehold — Create Task or Add Note">
            …Freehold gets a task ("Loop moved to Under Contract — update dates") or a note on the
            transaction.
          </Step>
        </ol>

        <h2 className="font-display mt-12 text-2xl font-bold tracking-tight">Under the hood</h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          Triggers are delivered as HMAC-signed webhooks (see{" "}
          <Link href="/docs/api" className="text-brand-700 underline hover:text-brand-600">
            the API reference
          </Link>{" "}
          for signature verification). Zapier can subscribe programmatically via{" "}
          <code className="font-mono text-xs">POST /api/v1/webhooks</code> with{" "}
          <code className="font-mono text-xs">{`{ url, events }`}</code>, and unsubscribe with{" "}
          <code className="font-mono text-xs">DELETE /api/v1/webhooks/:id</code>. Events:{" "}
          <code className="font-mono text-xs">
            transaction.created, task.completed, document.uploaded, envelope.sent,
            envelope.completed
          </code>
          . Writeback endpoints: <code className="font-mono text-xs">POST /api/v1/tasks</code> and{" "}
          <code className="font-mono text-xs">POST /api/v1/notes</code>.
        </p>
        <p className="mt-4 text-xs text-stone-400">
          Multi-step Zaps require a paid Zapier plan (Zapier's pricing, not ours). Freehold's
          bundled e-signing via Documenso needs none of this — Zapier is for teams that specifically
          want DocuSign, Dotloop, or the rest of the Zapier catalog.
        </p>
      </section>
      <MarketingFooter />
    </main>
  );
}
