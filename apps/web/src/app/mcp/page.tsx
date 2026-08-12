import {
  ArrowRight,
  ChatCircleDots,
  Check,
  ClockCounterClockwise,
  Lock,
  MagnifyingGlass,
  NotePencil,
  Plugs,
  ShieldCheck,
  Sparkle,
  UserCircle,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { MarketingFooter, MarketingNav } from "@/components/marketing";
import { mcpResourceUrl } from "@/lib/mcp";

export const metadata = {
  title: "Connect Claude to your transactions | Freehold",
  description:
    "Connect Freehold to Claude and ask about your closings, deadlines, and contacts in plain language. Working today, included with every plan, with permissions you control.",
};

/*
 * The Claude connector's marketing page.
 *
 * The tool list below is written for a coordinator, not lifted from the
 * schema, but it must stay in step with what the connector actually offers:
 * lib/mcp-tools.ts for the reads and lib/mcp-writes.ts for the three writes.
 * Adding a tool without adding a row here is how this page starts lying.
 */

/** The address a coordinator pastes into Claude. Same string the app shows. */
const CONNECTOR_URL = mcpResourceUrl(process.env.BETTER_AUTH_URL || "https://freeholdtc.dev");

const CLI_COMMAND = `claude mcp add --transport http freehold ${CONNECTOR_URL}`;

const READS: Array<[string, string]> = [
  [
    "How business is going",
    "Active files, closed files, clients, contacts, and open tasks, counted across the whole workspace.",
  ],
  ["Find a file", "By property address or by client name, narrowed to one stage when you want it."],
  [
    "What's due",
    "Open tasks and closings landing in the next few days, or the next few months if you ask for them.",
  ],
  [
    "Look up a person",
    "Clients and contacts by name, email, or phone. Who the lender is on a file, and how to reach them.",
  ],
];

const WRITES: Array<[string, string]> = [
  [
    "Add a task",
    "On a file or standing on its own, with a due date and a priority, exactly as if you had typed it in.",
  ],
  [
    "Log a note on a file",
    "It lands on that transaction's activity trail, where the rest of the deal's history lives.",
  ],
  [
    "Move a file's status",
    "Under contract, pending, closed, and the rest. Reversible, and recorded either way.",
  ],
];

const ASKS = [
  "What's closing in the next two weeks?",
  "Anything overdue this morning?",
  "Pull up 412 Maple Avenue. What's still open on it?",
  "What's the lender's number on the Harbor Lane file?",
  "Add a task on 88 Harbor Lane: order the survey, due Friday, high priority.",
  "Which of my clients has the most files open right now?",
];

const CONTROLS: Array<[typeof ShieldCheck, string, string]> = [
  [
    ShieldCheck,
    "Your account, your permissions",
    "Claude signs in as you, through Freehold's own login. It reaches exactly what you reach and nothing else, and the check runs on every single question rather than once when you connect.",
  ],
  [
    UserCircle,
    "Read or write, per person",
    "Members read by default. Write access is granted person by person on the Team page, so the one teammate who should be moving statuses is the only one who can.",
  ],
  [
    ClockCounterClockwise,
    "Every change is signed",
    "Anything Claude changes shows up on the file's activity trail and in your audit log under the person's own name, marked as coming from Claude. Nobody has to guess who moved a date.",
  ],
  [
    Lock,
    "Off in one click",
    "One switch on your dashboard's Integrations page turns the connector off for the whole workspace and disconnects everyone straight away. Anyone can also disconnect themselves at any time.",
  ],
];

const FAQ: Array<[string, string]> = [
  [
    "Do I need to be technical?",
    "No. You copy one web address out of Freehold and paste it into Claude's connector box, then sign in with the account you already use. It takes about a minute, and there is nothing to install.",
  ],
  [
    "Does it cost extra?",
    "No. The connector is part of every Freehold plan at no additional charge, the same as contract reading and voice search. Your Claude subscription is separate and comes from Anthropic.",
  ],
  [
    "Can it change my files?",
    "Only if you let it, and only in three narrow ways: adding a task, logging a note, and moving a status. It cannot send email, sign anything, touch an invoice, delete a record, or change what a client sees in their portal.",
  ],
  [
    "Which assistants can I use?",
    "Claude is the one we build for, test on every release, and recommend: Claude on the web, the Claude desktop and mobile apps, and Claude Code. Freehold speaks the open connector standard, so other assistants that support custom connectors can point at the same address.",
  ],
  [
    "What about my documents and my clients' data?",
    "Nothing in Freehold is used to train AI models, and the connector hands over only the answer to the question asked, scoped to the one workspace you approved. Contracts and stored documents are not handed to the assistant.",
  ],
  [
    "Does the whole team have to use it?",
    "Not at all. It is per person: one coordinator can run their morning from Claude while everyone else works entirely in the dashboard, and outside coverage staff never get connector access regardless.",
  ],
];

/**
 * A short mock conversation, illustrative values, styled the way the product's
 * own preview cards are. It shows the connector answering from real files
 * rather than describing that it can.
 */
function ConversationCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200/70 bg-white shadow-[0_12px_32px_-16px_rgba(28,25,23,0.25)]">
      <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-4 py-2.5">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
          Claude, connected to Freehold
        </p>
        <span className="flex items-center gap-1.5 text-xs text-brand-700">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-600" aria-hidden />
          Connected
        </span>
      </div>
      <div className="flex flex-col gap-4 px-4 py-4">
        <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-brand-700 px-3.5 py-2 text-sm text-white">
          What&apos;s closing this week, and is anything at risk?
        </p>
        <div className="max-w-[92%] text-sm leading-relaxed text-stone-700">
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 font-mono text-[11px] text-stone-500">
            <MagnifyingGlass size={12} aria-hidden className="text-brand-700" />
            upcoming_deadlines
          </p>
          <p>Three closings this week:</p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            <li>
              <span className="font-medium text-stone-900">412 Maple Avenue</span>, Wednesday.
              Clear: every task is done.
            </li>
            <li>
              <span className="font-medium text-stone-900">88 Harbor Lane</span>, Thursday. The
              survey was ordered but nothing has come back, and the walkthrough is unscheduled.
            </li>
            <li>
              <span className="font-medium text-stone-900">17 Cedar Court</span>, Friday. Waiting on
              the lender&apos;s clear to close.
            </li>
          </ul>
          <p className="mt-2">
            Harbor Lane is the one I&apos;d chase this morning. Want me to add a task to follow up
            on the survey?
          </p>
        </div>
      </div>
    </div>
  );
}

export default function McpPage() {
  return (
    <main className="bg-stone-50 text-stone-900">
      <MarketingNav />

      {/* Hero: the pitch on the left, the thing itself on the right. */}
      <section className="border-b border-stone-200/70 bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-12 sm:px-6 lg:grid-cols-[5fr_6fr] lg:gap-12 lg:pb-20 lg:pt-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-600/25 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-600" aria-hidden />
              Working today
            </p>
            <h1 className="font-display mt-4 max-w-xl text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl">
              Ask Claude about your closings.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-stone-600">
              Connect Freehold to Claude and your assistant can search your files, tell you
              what&apos;s due, and look up anyone on a deal. Give it write access and it adds tasks,
              logs notes, and moves a status for you. Included with every plan.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white shadow-xs transition hover:bg-brand-700 active:scale-[0.98]"
              >
                Start free
              </Link>
              <a
                href="#connect"
                className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 font-medium text-stone-700 shadow-xs transition hover:border-stone-400 hover:bg-stone-50 active:scale-[0.98]"
              >
                See how to connect
              </a>
            </div>
            <p className="mt-5 text-sm text-stone-500">
              About a minute to set up. Nothing to install, and no API key to handle.
            </p>
          </div>
          <ConversationCard />
        </div>
      </section>

      {/* What it is, in three plain sentences. */}
      <section className="border-b border-stone-200/70 bg-stone-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">
            Your files, in the assistant you already talk to.
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-stone-600">
            Most coordinators already have Claude open. This puts your workspace on the other end of
            it, so &ldquo;what am I chasing today&rdquo; is a question you ask out loud instead of
            four screens you check.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              [
                Plugs,
                "One address, pasted once",
                "Freehold gives you a web address. Claude takes it, sends you through your normal Freehold sign-in, and asks which workspace it may see. That is the whole setup.",
              ],
              [
                ChatCircleDots,
                "Answers from your own files",
                "Not general advice about real estate. The actual address, the actual date, the actual phone number, pulled from the workspace you approved a second earlier.",
              ],
              [
                Sparkle,
                "Included, not an add-on",
                "Every plan, at no extra charge, alongside contract reading and voice search. There is no usage meter and nothing to buy per seat.",
              ],
            ].map(([Icon, title, body]) => {
              const I = Icon as typeof Plugs;
              return (
                <div
                  key={title as string}
                  className="rounded-xl border border-stone-200/70 bg-white p-6"
                >
                  <I size={26} weight="regular" aria-hidden className="text-brand-700" />
                  <h3 className="mt-3 font-display font-bold">{title as string}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{body as string}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Connect: the dark band, because this is the one step with a URL in it. */}
      <section id="connect" className="scroll-mt-4 bg-stone-900 text-stone-100">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[5fr_6fr] lg:gap-14 lg:py-20">
          <div>
            <p className="text-sm font-medium text-brand-200">Connecting</p>
            <h2 className="font-display mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              A minute, start to finish.
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-stone-300">
              Your workspace owner switches the connector on once, on the dashboard&apos;s
              Integrations page. After that everyone on the team connects themselves.
            </p>
            <div className="mt-8 flex flex-col gap-6">
              {[
                [
                  "Copy the address",
                  "It sits on the Integrations page in your dashboard, with a copy button next to it.",
                ],
                [
                  "Add it in Claude",
                  "Settings, then Connectors, then Add custom connector. Paste the address and save.",
                ],
                [
                  "Sign in and approve",
                  "Claude sends you to Freehold's own login. Pick the workspace it may see, approve, and you are back in Claude with your files behind it.",
                ],
              ].map(([title, body], i) => (
                <div key={title} className="flex gap-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600 font-display text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-display font-bold text-white">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-stone-300">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                The address you paste
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <code className="overflow-x-auto rounded-lg bg-stone-950/60 px-3 py-2 font-mono text-sm text-brand-100">
                  {CONNECTOR_URL}
                </code>
                <CopyButton text={CONNECTOR_URL} label="Copy" />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-stone-400">
                The same address for everyone. Which workspace it opens is decided when you sign in,
                not by the link.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                In Claude Code, one line
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-stone-950/60 p-3 font-mono text-xs leading-relaxed text-stone-100">
                <code>{CLI_COMMAND}</code>
              </pre>
              <div className="mt-3">
                <CopyButton text={CLI_COMMAND} label="Copy command" variant="quiet" />
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                Where it works
              </p>
              <ul className="mt-3 flex flex-col gap-2 text-sm text-stone-300">
                <li className="flex items-start gap-2.5">
                  <Check size={16} weight="bold" aria-hidden className="mt-0.5 text-brand-300" />
                  <span>
                    <span className="font-medium text-white">Claude, everywhere it runs.</span> The
                    web app, the desktop and mobile apps, and Claude Code. This is the one we build
                    for and the one we recommend.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check size={16} weight="bold" aria-hidden className="mt-0.5 text-brand-300" />
                  <span>
                    <span className="font-medium text-white">Other assistants, same address.</span>{" "}
                    Freehold speaks the open connector standard, so anything that supports custom
                    connectors can point at it. Claude is what we test on every release.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* What it can reach. The honest boundary matters as much as the list. */}
      <section className="border-b border-stone-200/70 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <h2 className="font-display max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">
            What it can reach.
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-stone-600">
            A short list on purpose. Everything here is scoped to the one workspace you approved,
            and everything in the second column has to be granted to you before Claude will offer
            it.
          </p>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-stone-200/70 bg-stone-50">
              <div className="flex items-center gap-2.5 border-b border-stone-200/80 bg-[var(--section-header)] px-5 py-3">
                <MagnifyingGlass
                  size={18}
                  weight="regular"
                  aria-hidden
                  className="text-brand-700"
                />
                <h3 className="font-display font-bold">Asking questions</h3>
                <span className="ml-auto text-xs text-stone-500">Everyone with access</span>
              </div>
              <div className="flex flex-col divide-y divide-stone-200/70">
                {READS.map(([title, body]) => (
                  <div key={title} className="px-5 py-4">
                    <h4 className="text-sm font-medium">{title}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-stone-600">{body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-brand-600/20 bg-brand-50/50">
              <div className="flex items-center gap-2.5 border-b border-brand-600/15 bg-[var(--section-header)] px-5 py-3">
                <NotePencil size={18} weight="regular" aria-hidden className="text-brand-700" />
                <h3 className="font-display font-bold">Getting things done</h3>
                <span className="ml-auto text-xs text-stone-500">Only with write access</span>
              </div>
              <div className="flex flex-col divide-y divide-brand-600/10">
                {WRITES.map(([title, body]) => (
                  <div key={title} className="px-5 py-4">
                    <h4 className="text-sm font-medium">{title}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-stone-600">{body}</p>
                  </div>
                ))}
                <div className="px-5 py-4">
                  <h4 className="text-sm font-medium">And nothing else</h4>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600">
                    No sending email, no signing, no invoices, no deleting, and nothing that changes
                    what a client sees. Those are the places a confidently wrong assistant does
                    damage you cannot take back before someone notices.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Things people actually ask it. */}
      <section className="border-b border-stone-200/70 bg-stone-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">
            Things to ask it.
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-stone-600">
            No commands to learn and nothing to phrase a particular way. Ask the way you would ask a
            teammate who has your files open.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {ASKS.map((ask) => (
              <p
                key={ask}
                className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 shadow-xs"
              >
                &ldquo;{ask}&rdquo;
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* Control and privacy. */}
      <section className="border-b border-stone-200/70 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <h2 className="font-display max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">
            You decide what it sees.
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-stone-600">
            An assistant that can reach your workspace is only as safe as the switches around it.
            Here are the four that matter.
          </p>
          <div className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">
            {CONTROLS.map(([Icon, title, body]) => (
              <div key={title} className="flex gap-4">
                <Icon
                  size={24}
                  weight="regular"
                  aria-hidden
                  className="mt-0.5 shrink-0 text-brand-700"
                />
                <div>
                  <h3 className="font-display font-bold">{title}</h3>
                  <p className="mt-1.5 max-w-md text-sm leading-relaxed text-stone-600">{body}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-10 max-w-2xl rounded-xl border border-brand-600/15 bg-brand-50/60 px-5 py-4 text-sm leading-relaxed text-stone-600">
            Your documents are never used to train AI models, and outside coverage staff working
            specific files under an engagement never get connector access at all, whatever else is
            switched on.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-stone-200/70 bg-stone-50/70">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Fair questions
          </h2>
          <div className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
            {FAQ.map(([q, a]) => (
              <div key={q}>
                <h3 className="font-medium">{q}</h3>
                <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-stone-600">{a}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-sm text-stone-600">
            Building something of your own instead?{" "}
            <Link
              href="/docs/api"
              className="font-medium text-brand-700 underline decoration-brand-600/40 underline-offset-4 hover:text-brand-600"
            >
              The REST API and webhooks are documented here
            </Link>
            .
          </p>
        </div>
      </section>

      {/* CTA band */}
      <section className="bg-brand-800">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 lg:py-20">
          <h2 className="font-display mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white md:text-4xl">
            Run your morning from a conversation.
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-brand-100">
            Full Pro free for 14 days, no credit card. The connector is on from your first file, and
            your first 30 days include onboarding help from a real person.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-white px-5 py-2.5 font-medium text-brand-800 shadow-xs transition hover:bg-brand-50 active:scale-[0.98]"
            >
              Start free
            </Link>
            <a
              href="/demo"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-5 py-2.5 font-medium text-white transition hover:border-white/60 hover:bg-white/10 active:scale-[0.98]"
            >
              Try the live demo, no sign-up
              <ArrowRight size={16} weight="bold" aria-hidden />
            </a>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
