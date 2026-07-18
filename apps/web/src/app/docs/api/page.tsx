import Link from "next/link";
import { MarketingFooter, MarketingNav } from "@/components/marketing";

export const metadata = {
  title: "API reference | Freehold",
  description:
    "The Freehold REST API: API keys, transactions, contacts, tasks, and signed webhooks. Read and write everything in your workspace.",
};

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-xl bg-stone-900 p-4 font-mono text-xs leading-relaxed text-stone-100">
      <code>{children}</code>
    </pre>
  );
}

function Endpoint({
  method,
  path,
  children,
}: {
  method: string;
  path: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-stone-200/70 py-5 last:border-0">
      <p className="flex items-center gap-2.5">
        <span
          className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold ${
            method === "GET" ? "bg-brand-50 text-brand-700" : "bg-stone-900 text-white"
          }`}
        >
          {method}
        </span>
        <code className="font-mono text-sm">{path}</code>
      </p>
      <div className="mt-2 text-sm leading-relaxed text-stone-600">{children}</div>
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <main className="bg-stone-50 text-stone-900">
      <MarketingNav />

      <section className="mx-auto max-w-3xl px-4 pb-20 pt-12 sm:px-6 lg:pt-16">
        <h1 className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
          API reference
        </h1>
        <p className="mt-4 leading-relaxed text-stone-600">
          Read and write everything in your workspace: transactions, contacts, and tasks, plus
          signed webhooks when things happen. The API is the same whether you're on Freehold Cloud
          or self-hosting.
        </p>

        <h2 className="font-display mt-12 text-2xl font-bold tracking-tight">Authentication</h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          Create an API key in <strong>Settings → API keys</strong> (workspace admins only). Keys
          look like <code className="font-mono text-xs">fh_live_…</code>, are shown once, and give
          full read/write access to that one workspace. Send the key as a bearer token. Only a hash
          of the key is stored, and you can revoke any key instantly.
        </p>
        <CodeBlock>{`curl https://your-freehold-host/v1/transactions \\
  -H "Authorization: Bearer fh_live_your_key_here"`}</CodeBlock>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          Self-hosting: the API service listens on port 3001 by default. On Freehold Cloud the base
          URL is your workspace's API host.
        </p>

        <h2 className="font-display mt-12 text-2xl font-bold tracking-tight">Endpoints</h2>
        <div className="mt-2">
          <Endpoint method="GET" path="/v1/transactions?status=UNDER_CONTRACT">
            List transactions, newest first (up to 200). Optional <code>status</code> filter:
            LISTING, UNDER_CONTRACT, PENDING, CLOSED, CANCELLED.
          </Endpoint>
          <Endpoint method="POST" path="/v1/transactions">
            Create a transaction. <code>propertyAddress</code> is required; <code>status</code>,{" "}
            <code>side</code>, <code>city</code>, <code>state</code>, <code>zip</code>,{" "}
            <code>purchasePrice</code> (dollars), <code>contractDate</code> and{" "}
            <code>closeDate</code> (YYYY-MM-DD) are optional. Returns 201 with the created record
            and fires the <code>transaction.created</code> webhook.
          </Endpoint>
          <Endpoint method="GET" path="/v1/contacts">
            List contacts alphabetically (up to 500).
          </Endpoint>
          <Endpoint method="POST" path="/v1/contacts">
            Create a contact. <code>name</code> required; <code>email</code>, <code>phone</code>,{" "}
            <code>category</code> optional.
          </Endpoint>
          <Endpoint method="GET" path="/v1/tasks?transactionId=…">
            List tasks by due date, optionally scoped to one transaction.
          </Endpoint>
        </div>
        <CodeBlock>{`curl -X POST https://your-freehold-host/v1/transactions \\
  -H "Authorization: Bearer fh_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "propertyAddress": "825 Birchwood Lane",
    "city": "Naperville",
    "state": "IL",
    "status": "UNDER_CONTRACT",
    "side": "BUY_SIDE",
    "purchasePrice": 462000,
    "closeDate": "2026-08-21"
  }'`}</CodeBlock>

        <h2 className="font-display mt-12 text-2xl font-bold tracking-tight">Webhooks</h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          Add endpoints in <strong>Settings → Webhooks</strong>. Freehold POSTs JSON for the events
          you choose: <code>transaction.created</code> and <code>task.completed</code> today, with
          more coming. Failed deliveries retry up to 3 times with backoff; treat webhooks as hints
          and reconcile with the REST API for anything critical.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-stone-600">
          Every delivery is signed. The <code>freehold-signature</code> header carries{" "}
          <code>t=&lt;unix&gt;,v1=&lt;hex&gt;</code> where <code>v1</code> is HMAC-SHA256 of{" "}
          <code>t + "." + body</code> using your endpoint's secret. Reject anything older than 5
          minutes.
        </p>
        <CodeBlock>{`import { createHmac, timingSafeEqual } from "node:crypto";

function verify(secret, header, body) {
  const { t, v1 } = Object.fromEntries(
    header.split(",").map((p) => p.split("=")),
  );
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = createHmac("sha256", secret)
    .update(\`\${t}.\${body}\`)
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}`}</CodeBlock>

        <h2 className="font-display mt-12 text-2xl font-bold tracking-tight">Honest notes</h2>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-stone-600">
          <li>
            List endpoints cap at 200 to 500 records and don't paginate yet; pagination is coming.
          </li>
          <li>
            There are no rate limits yet. Please be reasonable, and don't build a poller that
            hammers every second.
          </li>
          <li>Webhook deliveries are at-least-once: dedupe on the event payload if it matters.</li>
          <li>
            The API grows on request like everything else here: ask at{" "}
            <a
              href="mailto:hello@freeholdtc.dev"
              className="font-medium text-brand-700 hover:text-brand-600"
            >
              hello@freeholdtc.dev
            </a>{" "}
            or on{" "}
            <a
              href="https://github.com/restax/freehold"
              className="font-medium text-brand-700 hover:text-brand-600"
            >
              GitHub
            </a>
            .
          </li>
        </ul>

        <div className="mt-10">
          <Link
            href="/signup"
            className="rounded-full bg-brand-600 px-5 py-2.5 font-medium text-white shadow-xs transition hover:bg-brand-700 active:scale-[0.98]"
          >
            Start free
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
