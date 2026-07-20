import { Wordmark } from "@/components/marketing";

export const metadata = { title: "Terms of service · Freehold" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <Wordmark size="sm" />
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Terms of service</h1>
      <p className="mt-2 text-sm text-stone-500">Last updated July 19, 2026.</p>
      <div className="mt-6 flex max-w-prose flex-col gap-4 text-sm leading-relaxed text-stone-700">
        <p>
          Freehold Cloud is a hosted service for managing real estate transactions. You keep
          ownership of everything you put into it. We keep the right to operate the service, nothing
          more.
        </p>
        <p>
          The software itself is source-available under the Elastic License 2.0; self-hosting it is
          governed by that license, not these terms.
        </p>
        <p>
          Freehold is a coordination tool, not a law firm, brokerage, or escrow agent. Extracted
          contract values are shown for your review and you are responsible for confirming them
          before relying on them.
        </p>
        <p>
          Paid plans bill monthly per seat through Stripe and can be cancelled any time from the
          billing page; your data stays exportable after cancellation.
        </p>
        <p>
          Don't use the service to break the law, and don't attempt to access other customers' data.
          We may suspend accounts that do either.
        </p>
        <h2 className="mt-2 font-semibold text-stone-900">If Freehold Cloud ever goes away</h2>
        <p>
          Your business should never be trapped inside ours. Freehold is source-available software:
          the full application is already public on{" "}
          <a
            href="https://github.com/restax/freehold"
            className="text-brand-700 hover:text-brand-600"
          >
            GitHub
          </a>
          , and the Elastic License 2.0 lets you run it for your own organization — free, forever,
          on your own server. That's the real guarantee: it doesn't depend on us staying in business
          or behaving well, because the code you'd need is already in your hands.
        </p>
        <p>
          Your data stays exportable at any time, including after you cancel. If we ever wound down
          Freehold Cloud, we intend to give reasonable advance notice and a final export so you can
          move to your own instance without losing a day of work.
        </p>
        <h2 className="mt-2 font-semibold text-stone-900">Security disclaimer</h2>
        <p>
          Real estate transactions involve sensitive information, and we treat that seriously: we
          use industry-standard physical and electronic safeguards, including encryption in transit
          and at rest, database-enforced workspace isolation, envelope-encrypted document and
          credential storage, and audit logging. However, no system connected to the internet is
          100% secure, and{" "}
          <strong>
            we can make no guarantees as to the security or privacy of your information
          </strong>
          . You use the service at your own risk.
        </p>
        <h2 className="mt-2 font-semibold text-stone-900">Your responsibilities</h2>
        <p>
          You are solely responsible for the data you put into Freehold and for who you give access
          to it: safeguarding your password and API keys, choosing what each portal link exposes and
          to whom you send it, obtaining your clients' consent before storing their information or
          credentials, deactivating access when relationships end, and complying with the laws and
          license rules that apply to your business. If you self-host Freehold, you are solely
          responsible for securing the servers it runs on.
        </p>
        <p>
          These terms will be finalized with counsel before Freehold Cloud takes paid customers.
          Questions:{" "}
          <a
            href="https://github.com/restax/freehold"
            className="text-brand-700 hover:text-brand-600"
          >
            GitHub
          </a>
          .
        </p>
      </div>
    </main>
  );
}
