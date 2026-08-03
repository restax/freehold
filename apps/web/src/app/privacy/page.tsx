import { Wordmark } from "@/components/marketing";

export const metadata = { title: "Privacy policy · Freehold" };

type Row = [category: string, examples: string, source: string, purpose: string];

const CCPA_CATEGORIES: Row[] = [
  [
    "Identifiers",
    "Name, email, username, phone number, IP address",
    "You, automatically",
    "Create and secure your account, run the service",
  ],
  [
    "Customer records",
    "Billing name and address, payment method on file with Stripe",
    "You, Stripe",
    "Process subscription payments",
  ],
  [
    "Commercial information",
    "Plan tier, transaction and credit usage, invoice history",
    "You, automatically",
    "Bill correctly, enforce plan limits",
  ],
  [
    "Internet or network activity",
    "Pages viewed, session device type, login timestamps",
    "Automatically",
    "Security, session limits, product analytics",
  ],
  [
    "Audio data",
    "Voice captured during dictation or voice search, transient",
    "You",
    "Convert speech to text and read answers aloud",
  ],
  [
    "User-generated content",
    "Client, contact, and transaction records; documents you upload",
    "You",
    "Run the transaction coordination service you signed up for",
  ],
  [
    "Precise or approximate location",
    "Address text typed into address fields, approximate location from IP",
    "You, automatically",
    "Address autocomplete, security",
  ],
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <Wordmark size="sm" />
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Privacy policy</h1>
      <p className="mt-2 text-sm text-stone-500">Last updated August 3, 2026.</p>

      <div className="mt-6 flex max-w-prose flex-col gap-4 text-sm leading-relaxed text-stone-700">
        <p>
          This policy covers Freehold Cloud, the hosted service operated by Freehold Studio ("we,"
          "us"). It does not cover self-hosted installations of the open-source Freehold software;
          see "If you self-host Freehold" below.
        </p>
        <p>
          This is a plain-language summary of a document we intend to have reviewed by counsel
          before Freehold Cloud takes paid customers at scale. If anything here is unclear, email{" "}
          <a href="mailto:privacy@freeholdtc.dev" className="text-brand-700 hover:text-brand-600">
            privacy@freeholdtc.dev
          </a>
          .
        </p>

        <h2 className="mt-2 font-semibold text-stone-900">What we collect</h2>
        <p>
          <strong>Account information.</strong> Name, email, username, and (optionally) phone
          number, when you sign up or update your profile. If you sign in with Google or Microsoft,
          we receive only what that provider shares for sign-in: your name and email.
        </p>
        <p>
          <strong>Workspace content.</strong> The clients, contacts, transactions, tasks, notes, and
          documents you and your team put into Freehold. This is the core of the service, it is your
          data, and it is what Freehold exists to help you manage.
        </p>
        <p>
          <strong>Payment information.</strong> Subscription payments are processed by Stripe. We
          receive your billing name, address, and subscription status; we never see or store your
          card number.
        </p>
        <p>
          <strong>Technical and usage data.</strong> IP address, browser and device type, and login
          timestamps, collected automatically to run and secure the service (for example, our
          concurrent-session limit uses device type and IP to tell sessions apart).
        </p>
        <p>
          <strong>Voice data.</strong> If you use dictation or voice search, your microphone audio
          is streamed to our speech-to-text and text-to-speech providers for the length of that
          session and is not stored by Freehold afterward.
        </p>
        <p>
          <strong>Cookies and analytics.</strong> Freehold Cloud uses Vercel Web Analytics, a
          cookieless, aggregate page-view analytics product, across the whole application, including
          the dashboard. We also ship PostHog, a product-analytics tool, in our code, but it only
          activates if we configure an API key for it; it is not currently active. Neither is an
          advertising tracker, and we place no advertising pixels of any kind. Sign-in itself
          requires a session cookie to work.
        </p>

        <h2 className="mt-2 font-semibold text-stone-900">How we use it</h2>
        <p>
          We use your information to operate Freehold Cloud, secure your account, process payments,
          respond to support requests, and improve the product. We do not use your workspace content
          to train AI models, ours or anyone else's.
        </p>

        <h2 className="mt-2 font-semibold text-stone-900">
          Categories of personal information (last 12 months)
        </h2>
        <p>The table below is written to satisfy CCPA/CPRA's disclosure requirement directly.</p>
        <div className="overflow-x-auto rounded-xl border border-stone-200">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="px-4 py-2.5 font-medium text-stone-700">Category</th>
                <th className="px-4 py-2.5 font-medium text-stone-700">Examples</th>
                <th className="px-4 py-2.5 font-medium text-stone-700">Source</th>
                <th className="px-4 py-2.5 font-medium text-stone-700">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {CCPA_CATEGORIES.map(([category, examples, source, purpose]) => (
                <tr key={category} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3 align-top font-medium text-stone-900">{category}</td>
                  <td className="px-4 py-3 align-top text-stone-600">{examples}</td>
                  <td className="px-4 py-3 align-top text-stone-600">{source}</td>
                  <td className="px-4 py-3 align-top text-stone-500">{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          The commercial purpose for collecting these categories is, in every case, providing the
          Freehold Cloud service you signed up for: running your workspace, billing your
          subscription, and keeping the account secure.
        </p>

        <h2 className="mt-2 font-semibold text-stone-900">Who we share it with</h2>
        <p>
          We share data only with the vendors that help us run the service (our infrastructure,
          payments, AI, email, and voice providers) and only what each one needs to do its job. The
          complete, current list, including exactly what each vendor sees, lives on our{" "}
          <a href="/subprocessors" className="text-brand-700 hover:text-brand-600">
            subprocessors page
          </a>
          , updated the day we start sending a new vendor data. Contract text you upload is sent to
          Anthropic's Claude API for extraction; Anthropic does not train on this data under the API
          terms we operate under.
        </p>
        <p>
          <strong>
            We do not sell your personal information, and we do not share it for cross-context
            behavioral advertising.
          </strong>{" "}
          Nothing on this page changes that without saying so explicitly and giving you a way to opt
          out first.
        </p>

        <h2 className="mt-2 font-semibold text-stone-900">Data retention and security</h2>
        <p>
          We keep your data for as long as your account is active, plus a reasonable period
          afterward in case you want to return, then delete it. Documents you upload and credentials
          you store in the vault are envelope-encrypted before they reach the database or storage.
          We use industry-standard physical and electronic safeguards, including encryption in
          transit and at rest, database-enforced workspace isolation, and audit logging. No
          internet-connected system is 100% secure, and we can make no guarantee as to the security
          of your information; see the security disclaimer in our{" "}
          <a href="/terms" className="text-brand-700 hover:text-brand-600">
            terms
          </a>
          .
        </p>
        <p>
          You stay in control of where your documents live. Connect your own S3-compatible storage
          bucket in Settings and new documents are written there, in infrastructure you own; with it
          connected, we also push a full nightly copy there automatically. You can download your
          entire workspace, records and documents, as one archive at any time from Settings.
        </p>

        <h2 className="mt-2 font-semibold text-stone-900">International transfers</h2>
        <p>
          Our infrastructure and most subprocessors are based in the United States; one voice
          provider also processes data in the European Union. If you are located outside the United
          States, your information will be transferred to and processed there.
        </p>

        <h2 className="mt-2 font-semibold text-stone-900">Your rights</h2>
        <p>
          <strong>If you are a California resident (CCPA/CPRA):</strong> you have the right to know
          what personal information we hold about you, to request its deletion, to correct
          inaccurate information, and to opt out of the sale or sharing of personal information. As
          stated above, we do not sell or share personal information, so there is no opt-out to
          exercise; if that ever changes, we will provide a clear "Do Not Sell or Share My Personal
          Information" control before it does. We will not discriminate against you for exercising
          any of these rights.
        </p>
        <p>
          Freehold Cloud is US-focused: we have no EU or UK operations and don't market to customers
          there, so GDPR does not apply to us today. If that ever changes, we will extend the same
          rights above to EU and UK users under GDPR.
        </p>
        <p>
          Wherever you're located, you can request the same access, correction, or deletion rights
          described above by emailing{" "}
          <a href="mailto:privacy@freeholdtc.dev" className="text-brand-700 hover:text-brand-600">
            privacy@freeholdtc.dev
          </a>
          . Exporting your own workspace data is instant and self-service from Settings; account and
          workspace deletion is currently handled by request rather than a self-service button, and
          we aim to complete it within 30 days.
        </p>

        <h2 className="mt-2 font-semibold text-stone-900">Children's privacy</h2>
        <p>
          Freehold Cloud is a business tool for licensed real estate professionals and is not
          directed at, or knowingly used by, anyone under 18. We do not knowingly collect personal
          information from children.
        </p>

        <h2 className="mt-2 font-semibold text-stone-900">If you self-host Freehold</h2>
        <p>
          None of the above applies. Freehold's source code is public, and self-hosting it means
          your data lives on your own server and never reaches us. You are the data controller for
          your own installation.
        </p>

        <h2 className="mt-2 font-semibold text-stone-900">Changes to this policy</h2>
        <p>
          If we make a material change to how we handle your data, we will update the date at the
          top of this page and, for significant changes, notify workspace owners directly.
        </p>
        <p>
          Questions: open an issue on{" "}
          <a
            href="https://github.com/restax/freehold"
            className="text-brand-700 hover:text-brand-600"
          >
            GitHub
          </a>{" "}
          or email{" "}
          <a href="mailto:privacy@freeholdtc.dev" className="text-brand-700 hover:text-brand-600">
            privacy@freeholdtc.dev
          </a>
          .
        </p>
      </div>
    </main>
  );
}
