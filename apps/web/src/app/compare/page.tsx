import Link from "next/link";

export const metadata = {
  title: "Freehold Cloud vs self-hosting: the honest comparison",
  description:
    "Both run the same open-source software with every feature. The difference is who runs the server and who pays for the AI.",
};

const ROWS: Array<[string, string, string]> = [
  ["Software", "Same open-source code", "Same open-source code"],
  ["Features", "All of them", "All of them"],
  ["Transactions", "Free: 10 active · Pro and up: unlimited", "Unlimited, always"],
  ["Team members", "Free: 2 · paid plans: seats you choose", "Unlimited, always"],
  ["AI contract extraction", "Included in every plan", "Bring your own Anthropic API key"],
  ["Hosting, backups, updates", "We run it", "You run it (Docker Compose, one machine)"],
  ["Where your data lives", "Freehold Cloud's database", "Your server, your database"],
  [
    "E-signatures",
    "Documenso or DocuSign with your accounts",
    "Same, plus a bundled local Documenso setup",
  ],
  ["Support", "Email support; priority on Business", "GitHub issues and community"],
  ["Price", "$0, $29, or $59 per user per month", "$0 forever, plus your server costs"],
];

export default function ComparePage() {
  return (
    <main className="bg-stone-50 text-stone-900">
      <header className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="font-serif text-xl font-semibold tracking-tight text-brand-700">
          Freehold
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/login" className="text-stone-600 transition-colors hover:text-stone-900">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-brand-700 px-3.5 py-1.5 font-medium text-white shadow-xs transition hover:bg-brand-600 active:scale-[0.98]"
          >
            Start free
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-4 pb-20 pt-10 sm:px-6">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight md:text-5xl">
          Cloud or self-host? Here&apos;s the honest version.
        </h1>
        <p className="mt-4 max-w-xl leading-relaxed text-stone-600">
          Both run the identical open-source software with every feature. Self-hosting is not a
          crippled trial and never will be. The real difference is who runs the server, who handles
          backups and updates, and who pays for the AI calls.
        </p>

        <div className="mt-10 overflow-x-auto rounded-xl border border-stone-200/70 bg-white shadow-[0_1px_2px_rgb(41_37_36/0.04),0_2px_8px_rgb(41_37_36/0.04)]">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left">
                <th className="px-4 py-3 font-medium text-stone-500" />
                <th className="px-4 py-3 font-medium">Freehold Cloud</th>
                <th className="px-4 py-3 font-medium">Self-hosted</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, cloud, self], i) => (
                <tr key={label} className={i % 2 ? "bg-stone-50/60" : ""}>
                  <td className="px-4 py-3 font-medium text-stone-600">{label}</td>
                  <td className="px-4 py-3">{cloud}</td>
                  <td className="px-4 py-3">{self}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-stone-200/70 bg-white p-6">
            <h2 className="font-medium">Choose Cloud if</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
              You want to open a browser and work. No server, no updates, no API keys. Most solo TCs
              and small teams land here.
            </p>
            <Link
              href="/signup"
              className="mt-4 inline-block rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-xs transition hover:bg-brand-600 active:scale-[0.98]"
            >
              Start free
            </Link>
          </div>
          <div className="rounded-xl border border-stone-200/70 bg-white p-6">
            <h2 className="font-medium">Choose self-hosting if</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
              Your brokerage requires data on its own infrastructure, or you have IT staff and want
              full control. You lose nothing: same software, no limits.
            </p>
            <a
              href="https://github.com/restax/freehold"
              className="mt-4 inline-block rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-xs transition hover:border-stone-400 hover:bg-stone-50 active:scale-[0.98]"
            >
              View on GitHub
            </a>
          </div>
        </div>

        <p className="mt-8 text-sm leading-relaxed text-stone-500">
          You can switch later in either direction. Your data exports from Cloud any time, and a
          self-hosted database can move to Cloud when you stop wanting to run a server.
        </p>
      </section>
    </main>
  );
}
