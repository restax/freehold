import { Wordmark } from "@/components/marketing";

export const metadata = { title: "Privacy policy · Freehold" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <Wordmark size="sm" />
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Privacy policy</h1>
      <p className="mt-2 text-sm text-stone-500">Last updated July 19, 2026.</p>
      <div className="mt-6 flex max-w-prose flex-col gap-4 text-sm leading-relaxed text-stone-700">
        <p>
          Freehold Cloud stores the data you put into it: transactions, contacts, documents, and
          workspace settings. We use it to run the service for you and for nothing else. We do not
          sell it, share it with advertisers, or train AI models on it.
        </p>
        <p>
          Contract extraction sends the document you upload to Anthropic's Claude API to read it.
          Anthropic does not train on this data under the API terms we operate under.
        </p>
        <p>
          Credentials you store in the vault and every document you upload are envelope-encrypted
          before they reach the database or storage.
        </p>
        <p>
          Payments are processed by Stripe; we never see your card number. We use no third-party
          advertising or analytics trackers.
        </p>
        <p>
          We protect data with industry-standard physical and electronic safeguards — encryption in
          transit and at rest, database-enforced workspace isolation, and audit logging. No
          internet-connected system is 100% secure, though, and we can make no guarantees as to the
          security or privacy of your information; see the security disclaimer in our{" "}
          <a href="/terms" className="text-brand-700 hover:text-brand-600">
            terms
          </a>
          .
        </p>
        <p>
          You stay in control of where your data lives. Connect your own S3-compatible storage
          bucket and new documents are written there, in infrastructure you own. You can download
          your entire workspace — records and documents — as one archive at any time, and with your
          own storage connected we deliver a full copy there automatically every night.
        </p>
        <p>
          You can export your data or delete your workspace at any time, and deletion is permanent.
          If you self-host Freehold, none of this applies: your data lives on your own server and
          never reaches us.
        </p>
        <p>
          Questions: open an issue on{" "}
          <a
            href="https://github.com/restax/freehold"
            className="text-brand-700 hover:text-brand-600"
          >
            GitHub
          </a>{" "}
          or email us. This policy will be finalized with counsel before Freehold Cloud takes paid
          customers.
        </p>
      </div>
    </main>
  );
}
