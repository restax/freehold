import Link from "next/link";

export const metadata = { title: "Terms of service · Freehold" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <Link href="/" className="font-serif text-lg font-semibold text-brand-700">
        Freehold
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Terms of service</h1>
      <p className="mt-2 text-sm text-stone-500">Pre-launch draft. Last updated July 18, 2026.</p>
      <div className="mt-6 flex max-w-prose flex-col gap-4 text-sm leading-relaxed text-stone-700">
        <p>
          Freehold Cloud is a hosted service for managing real estate transactions. You keep
          ownership of everything you put into it. We keep the right to operate the service, nothing
          more.
        </p>
        <p>
          The software itself is open source under the Apache-2.0 license; self-hosting it is
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
