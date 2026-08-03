import { Wordmark } from "@/components/marketing";
import { TERMS_LAST_UPDATED } from "@/lib/terms";

export const metadata = { title: "Terms of service · Freehold" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <Wordmark size="sm" />
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Terms of service</h1>
      <p className="mt-2 text-sm text-stone-500">Last updated {TERMS_LAST_UPDATED}.</p>
      <div className="mt-6 flex max-w-prose flex-col gap-4 text-sm leading-relaxed text-stone-700">
        <p>
          Freehold Cloud is a hosted service for managing real estate transactions, operated by
          Freehold Studio ("we," "us"). You keep ownership of everything you put into it. We keep
          the right to operate the service, nothing more. By creating an account, you agree to these
          terms.
        </p>
        <p>
          The software itself is source-available under the Elastic License 2.0; self-hosting it is
          governed by that license, not these terms. Everything below describes Freehold Cloud, the
          service we operate.
        </p>
        <p>
          Freehold is a coordination tool, not a law firm, brokerage, escrow agent, or title
          company. Extracted contract values are shown for your review and you are responsible for
          confirming them before relying on them.
        </p>
        <p>
          Paid plans bill monthly per seat through Stripe and can be cancelled any time from the
          billing page; your data stays exportable after cancellation.
        </p>

        <h2 className="mt-2 font-semibold text-stone-900">Eligibility</h2>
        <p>
          You must be at least 18 years old and able to form a binding contract to create a Freehold
          account. If you're signing up on behalf of a brokerage, team, or other organization,
          you're confirming that you have the authority to bind that organization to these terms.
        </p>

        <h2 className="mt-2 font-semibold text-stone-900">Acceptable use</h2>
        <p>These rules apply to Freehold Cloud, the hosted service. Don't use it to:</p>
        <ul className="list-disc pl-5">
          <li>
            break any law, or violate a third party's rights, including your clients' privacy;
          </li>
          <li>
            access, or attempt to access, another customer's workspace or data without
            authorization;
          </li>
          <li>
            scrape, crawl, or programmatically extract data from Freehold Cloud outside of the
            documented API and MCP connector;
          </li>
          <li>
            probe, scan, or attempt to bypass the security or rate limits of Freehold Cloud, or
            interfere with its normal operation;
          </li>
          <li>resell or sublicense access to Freehold Cloud without our written agreement; or</li>
          <li>
            use the service in a way that requires a real estate, escrow, or transaction
            coordination license you don't hold, in any state where that license is required.
          </li>
        </ul>
        <p>
          We may suspend or terminate accounts that violate any of the above, with or without
          advance notice, at our discretion. Reverse-engineering or self-hosting the Freehold
          software itself is not covered by this policy; that's governed by the Elastic License 2.0
          instead.
        </p>

        <h2 className="mt-2 font-semibold text-stone-900">Intellectual property</h2>
        <p>
          We own Freehold, including its code, design, and branding, except for the rights we grant
          you under the Elastic License 2.0 to self-host it. You own the content you put into your
          workspace: your clients, contacts, transactions, notes, and documents. By using Freehold
          Cloud, you grant us a limited license to host, process, and display that content solely to
          provide the service to you, and for no other purpose.
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
          , and the Elastic License 2.0 lets you run it for your own organization, free, forever, on
          your own server. That's the real guarantee: it doesn't depend on us staying in business or
          behaving well, because the code you'd need is already in your hands.
        </p>
        <p>
          Your data stays exportable at any time, including after you cancel. If we ever wound down
          Freehold Cloud, we intend to give reasonable advance notice and a final export so you can
          move to your own instance without losing a day of work.
        </p>

        <h2 className="mt-2 font-semibold text-stone-900">Termination</h2>
        <p>
          You can cancel any time from the billing page; cancellation takes effect at the end of
          your current billing period. We can suspend or terminate your access for violating the
          acceptable use rules above, nonpayment, or if required by law, with or without advance
          notice. After termination, your data remains exportable for a reasonable period before
          deletion; see the privacy policy for specifics.
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

        <h2 className="mt-2 font-semibold text-stone-900">Limitation of liability</h2>
        <p>
          Freehold Cloud is provided "as is" and "as available," without warranties of any kind,
          express or implied. To the maximum extent permitted by law, we are not liable for any
          indirect, incidental, special, consequential, or punitive damages, or for lost profits,
          lost data, or business interruption, arising from your use of the service, even if we've
          been advised of the possibility. Our total liability for any claim arising from these
          terms or your use of Freehold Cloud is limited to the amount you paid us in the 12 months
          before the claim arose.
        </p>

        <h2 className="mt-2 font-semibold text-stone-900">Your responsibilities</h2>
        <p>
          <strong>
            You, and your business, are solely responsible for complying with the real estate,
            transaction-coordination, and escrow laws and licensing requirements of every state you
            operate in.
          </strong>{" "}
          Freehold is a coordination tool: it does not provide legal, tax, brokerage, or escrow
          advice, does not determine what your state requires, and takes on no liability for your
          compliance with those requirements. You agree to indemnify and hold Freehold Studio
          harmless from any claim, loss, or liability, including reasonable legal fees, arising from
          your use of the service, your violation of these terms, or your violation of any law or
          licensing requirement that applies to your business.
        </p>
        <p>
          You are also solely responsible for the data you put into Freehold and for who you give
          access to it: safeguarding your password and API keys, choosing what each portal link
          exposes and to whom you send it, obtaining your clients' consent before storing their
          information or credentials, and deactivating access when relationships end. If you
          self-host Freehold, you are solely responsible for securing the servers it runs on.
        </p>

        <h2 className="mt-2 font-semibold text-stone-900">Changes to these terms</h2>
        <p>
          If we make a material change, we'll update the date at the top of this page and, for
          significant changes, notify workspace owners directly. Continuing to use Freehold Cloud
          after a change takes effect means you accept the updated terms.
        </p>
        <p>
          These terms will be finalized with counsel before Freehold Cloud takes paid customers at
          scale. Questions:{" "}
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
