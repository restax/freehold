import { Wordmark } from "@/components/marketing";

export const metadata = {
  alternates: { canonical: "/subprocessors" },
  title: "Subprocessors · Freehold",
  description:
    "Every third party Freehold Cloud sends data to, what they do, and what they see. Updated as our infrastructure changes.",
};

type Row = [name: string, purpose: string, dataShared: string, location: string];

const GROUPS: Array<[string, Row[]]> = [
  [
    "Infrastructure & hosting",
    [
      [
        "Vercel Inc.",
        "Runs the application (every page load and API request) and provides Vercel Web Analytics, a cookieless, aggregate page-view analytics product active across the whole app.",
        "All traffic passing through Freehold, including session cookies, plus aggregate page-view counts.",
        "United States",
      ],
      [
        "Neon, Inc.",
        "Primary Postgres database.",
        "Every workspace record: transactions, contacts, tasks, and encrypted credentials.",
        "United States",
      ],
      [
        "Cloudflare, Inc. (R2)",
        "Object storage for uploaded documents.",
        "Every uploaded file, envelope-encrypted before it leaves our servers, so Cloudflare holds ciphertext, not readable documents.",
        "United States / global edge",
      ],
      [
        "DigitalOcean, LLC",
        "Hosts Freehold's own OpenSign instance for e-signatures (see the note below).",
        "Documents sent for signature and signer names/emails.",
        "United States",
      ],
    ],
  ],
  [
    "AI & voice",
    [
      [
        "Anthropic, PBC",
        "Claude powers contract extraction, the site assistant, and the optional Claude connector (MCP) for asking about your own workspace from Claude Desktop or Claude Code.",
        "Contract/document text submitted for extraction; workspace data returned to a query you make through chat or the connector. Anthropic does not train on this data under the API terms we operate under.",
        "United States",
      ],
      [
        "Deepgram, Inc.",
        "Speech-to-text behind voice search and the dictation button.",
        "Audio while you're speaking into the mic, and the resulting transcript.",
        "United States",
      ],
      [
        "ElevenLabs",
        "Text-to-speech for voice search's spoken answers.",
        "The text of the answer being read aloud.",
        "United States / European Union",
      ],
      [
        "LiveKit, Inc.",
        "Realtime audio transport for voice search sessions.",
        "Your live audio stream for the duration of a voice session.",
        "United States",
      ],
    ],
  ],
  [
    "Communications",
    [
      [
        "Resend",
        "Sends transactional email from your workspace's address and receives replies for thread-back-to-transaction.",
        "Recipient addresses, message content, and inbound replies.",
        "United States",
      ],
      [
        "Slack Technologies, LLC",
        "Internal alerts to the Freehold team: new signups, support tickets, payment issues.",
        "Operational alerts, which sometimes include a customer's name or email. Never document contents or contract data.",
        "United States",
      ],
    ],
  ],
  [
    "Payments & location",
    [
      [
        "Stripe, Inc.",
        "Processes Freehold Cloud subscription payments.",
        "Billing details and payment method. We never see or store your card number.",
        "United States",
      ],
      [
        "Mapbox, Inc.",
        "Address autocomplete on every address field.",
        "The text you type while searching for an address.",
        "United States",
      ],
    ],
  ],
  [
    "Marketing",
    [
      [
        "Opinly",
        "Blog content hosting and analytics pixel on the marketing blog, measuring page views and which posts lead to sign-ups.",
        "Blog page views and, once you identify yourself (for example, by signing up), your email address associated with that activity.",
        "United States",
      ],
    ],
  ],
];

export default function SubprocessorsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <Wordmark size="sm" />
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Subprocessors</h1>
      <p className="mt-2 text-sm text-stone-500">Last updated August 3, 2026.</p>

      <div className="mt-6 flex max-w-prose flex-col gap-4 text-sm leading-relaxed text-stone-700">
        <p>
          This is the complete list of third parties Freehold Cloud sends data to in order to run
          the service, what each one does, and what they can see. We add a vendor here the same day
          we start sending it data, not months later. If you self-host Freehold, none of this
          applies: your data goes nowhere but your own server, and you choose your own
          infrastructure.
        </p>
        <p>
          <strong>E-signature is built in, not outsourced.</strong> Freehold runs its own instance
          of OpenSign (the open-source e-signature project) on our own infrastructure (DigitalOcean,
          listed below). That means signing documents is included with every plan: no separate
          e-signature subscription, no per-envelope fee, no account to create with another company.
          If you'd rather use your own Documenso account or DocuSign, you can connect one from
          Settings. At that point you have a direct vendor relationship with them, not us, and this
          page doesn't cover what they do with your data.
        </p>
      </div>

      <div className="mt-10 flex flex-col gap-10">
        {GROUPS.map(([group, rows]) => (
          <div key={group}>
            <h2 className="text-lg font-semibold tracking-tight">{group}</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-stone-200">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50">
                    <th className="px-4 py-2.5 font-medium text-stone-700">Subprocessor</th>
                    <th className="px-4 py-2.5 font-medium text-stone-700">What it does</th>
                    <th className="px-4 py-2.5 font-medium text-stone-700">What it sees</th>
                    <th className="px-4 py-2.5 font-medium text-stone-700">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([name, purpose, data, location]) => (
                    <tr key={name} className="border-b border-stone-100 last:border-0">
                      <td className="px-4 py-3 align-top font-medium text-stone-900">{name}</td>
                      <td className="px-4 py-3 align-top text-stone-600">{purpose}</td>
                      <td className="px-4 py-3 align-top text-stone-600">{data}</td>
                      <td className="px-4 py-3 align-top text-stone-500">{location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 flex max-w-prose flex-col gap-4 text-sm leading-relaxed text-stone-700">
        <p>
          Two things not on this list on purpose. First, optional sign-in with Google or Microsoft:
          if you choose one of those at login, that provider only ever sees what any OAuth sign-in
          shares (your name and email), and only if you pick it. Second, any integration you connect
          yourself (Follow Up Boss, Twenty CRM, Zapier, ERPNext, your own Documenso or DocuSign
          account) is a relationship between you and that vendor. We send data there because you
          told us to; we don't add a step of our own in between.
        </p>
        <p>
          We use Vercel Web Analytics (cookieless, aggregate page views, listed above), ship
          PostHog, a product-analytics tool, in our code (though it only activates if we configure
          an API key for it; it is not currently active), and run the Opinly analytics pixel on the
          marketing blog (listed above). None of these are advertising, and we do not sell data to
          anyone, subprocessor or otherwise. See the full{" "}
          <a href="/privacy" className="text-brand-700 hover:text-brand-600">
            privacy policy
          </a>{" "}
          for how we handle what you put into Freehold.
        </p>
        <p>
          Questions, or want notice before we add a new subprocessor: open an issue on{" "}
          <a
            href="https://github.com/restax/freehold"
            className="text-brand-700 hover:text-brand-600"
          >
            GitHub
          </a>{" "}
          or email{" "}
          <a href="mailto:hello@freeholdtc.dev" className="text-brand-700 hover:text-brand-600">
            hello@freeholdtc.dev
          </a>
          .
        </p>
      </div>
    </main>
  );
}
