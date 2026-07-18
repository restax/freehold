import Image from "next/image";
import Link from "next/link";
import { MarketingFooter, MarketingNav } from "@/components/marketing";
import brokerageDusk from "../../../public/marketing/brokerage-dusk.jpg";
import closingKeys from "../../../public/marketing/closing-keys.jpg";
import movingDay from "../../../public/marketing/moving-day.jpg";

export const metadata = {
  title: "Cloud vs self-hosting: the honest comparison | Freehold",
  description:
    "Three honest ways to run Freehold: Cloud, your own server, or through the IT provider you already trust. Same open-source software either way.",
};

const ROWS: Array<[string, string, string, string]> = [
  ["Software", "Same open-source code", "Same open-source code", "Same open-source code"],
  ["Features", "All of them", "All of them", "All of them"],
  [
    "Transactions",
    "Free: 10 active · paid: unlimited",
    "Unlimited, always",
    "Per plan, unlimited on paid",
  ],
  [
    "Team members",
    "Free: 2 · paid: seats you choose",
    "Unlimited, always",
    "Per plan, seats you choose",
  ],
  [
    "AI contract extraction",
    "Included in every plan",
    "Bring your own Anthropic API key",
    "Included, billed through your provider",
  ],
  [
    "Hosting, backups, updates",
    "We run it",
    "You run it (Docker Compose)",
    "Your IT provider runs it",
  ],
  [
    "Where your data lives",
    "Freehold Cloud's database",
    "Your server, your database",
    "Your provider's infrastructure",
  ],
  [
    "Support",
    "Email support; priority on Business",
    "GitHub issues and community",
    "Your provider, backed by us",
  ],
  [
    "Price",
    "$0, $29, or $80 a month — flat, users included",
    "$0 forever; an unused PC you already own works",
    "Standard plan rates on one consolidated invoice",
  ],
];

export default function ComparePage() {
  return (
    <main className="bg-stone-50 text-stone-900">
      <MarketingNav />

      <section className="mx-auto max-w-6xl px-4 pb-20 pt-12 sm:px-6 lg:pt-16">
        <h1 className="font-display max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
          Three honest ways to run Freehold.
        </h1>
        <p className="mt-5 max-w-xl leading-relaxed text-stone-600">
          Cloud, your own server, or the IT provider you already trust. All three run the identical
          open-source software with every feature. Self-hosting is not a crippled trial and never
          will be. The real difference is who runs the server, who handles backups and updates, and
          who pays for the AI calls.
        </p>

        {/* Choose-if cards with imagery */}
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="flex flex-col overflow-hidden rounded-2xl border border-stone-200/70 bg-white">
            <div className="relative aspect-[16/9]">
              <Image
                src={movingDay}
                alt="Moving boxes on the doorstep of a home with a green front door"
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <h2 className="font-display font-bold">Freehold Cloud</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                Open a browser and work. No server, no updates, no API keys, AI included. Most solo
                TCs and small teams land here.
              </p>
              <Link href="/signup" className="mt-auto pt-5">
                <span className="block rounded-lg bg-brand-600 px-4 py-2 text-center text-sm font-medium text-white shadow-xs transition hover:bg-brand-700 active:scale-[0.98]">
                  Start free
                </span>
              </Link>
            </div>
          </div>
          <div className="flex flex-col overflow-hidden rounded-2xl border border-stone-200/70 bg-white">
            <div className="relative aspect-[16/9]">
              <Image
                src={closingKeys}
                alt="House keys resting on a signed closing document"
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <h2 className="font-display font-bold">Self-hosted</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                Your brokerage wants data on its own infrastructure, or you have IT help and want
                full control. Same software, no limits, free forever, and an unused office PC is all
                the server it needs. Your only real costs are electricity and pennies per contract
                for your own AI key.
              </p>
              <a
                href="https://github.com/restax/freehold/blob/main/docs/SELF-HOSTING.md"
                className="mt-auto pt-5"
              >
                <span className="block rounded-lg bg-stone-900 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-stone-700 active:scale-[0.98]">
                  Self-hosting guide
                </span>
              </a>
            </div>
          </div>
          <div className="flex flex-col overflow-hidden rounded-2xl border border-stone-200/70 bg-white">
            <div className="relative aspect-[16/9]">
              <Image
                src={brokerageDusk}
                alt="A brokerage office interior at dusk"
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <h2 className="font-display font-bold">Through your IT provider</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                The provider who already manages your office runs Freehold for you, on their
                infrastructure or ours, billed on one consolidated invoice.
              </p>
              <a href="mailto:partners@freeholdtc.dev" className="mt-auto pt-5">
                <span className="block rounded-lg border border-stone-300 bg-white px-4 py-2 text-center text-sm font-medium text-stone-700 shadow-xs transition hover:border-stone-400 hover:bg-stone-50 active:scale-[0.98]">
                  Connect your provider
                </span>
              </a>
            </div>
          </div>
        </div>

        {/* The honest table */}
        <div className="mt-12 overflow-x-auto rounded-2xl border border-stone-200/70 bg-white shadow-[0_1px_2px_rgb(41_37_36/0.04),0_2px_8px_rgb(41_37_36/0.04)]">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left">
                <th className="px-4 py-3.5 font-medium text-stone-500" />
                <th className="font-display px-4 py-3.5 font-bold">Freehold Cloud</th>
                <th className="font-display px-4 py-3.5 font-bold">Self-hosted</th>
                <th className="font-display px-4 py-3.5 font-bold">Via IT provider</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, cloud, self, it], i) => (
                <tr key={label} className={i % 2 ? "bg-stone-50/60" : ""}>
                  <td className="px-4 py-3 font-medium text-stone-600">{label}</td>
                  <td className="px-4 py-3">{cloud}</td>
                  <td className="px-4 py-3">{self}</td>
                  <td className="px-4 py-3">{it}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 rounded-2xl border border-brand-600/15 bg-brand-50/60 px-6 py-5">
          <p className="font-display font-bold">None of these doors lock behind you.</p>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-stone-600">
            Start on Cloud and move to your own server later, or run your own server until you're
            tired of it and let Cloud take over. An IT provider can pick up either one mid-stream.
            Your data exports in full at every step, so wherever you start, you can always end up
            somewhere else. See{" "}
            <Link href="/pricing" className="font-medium text-brand-700 hover:text-brand-600">
              pricing
            </Link>{" "}
            for what each plan costs.
          </p>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
