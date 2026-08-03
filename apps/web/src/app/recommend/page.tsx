import { ChatCircleText, GithubLogo, PaperPlaneTilt, Star } from "@phosphor-icons/react/dist/ssr";
import { MarketingFooter, MarketingNav } from "@/components/marketing";
import { sendRecommendation } from "@/lib/actions/recommend";

export const metadata = {
  title: "Recommend Freehold | Freehold",
  description:
    "Freehold pays no affiliate commissions: recommendations are earned or they don't happen. If we've earned yours, here's where it helps most.",
};

const SEND_ERROR: Record<string, string> = {
  invalid: "That doesn't look like a valid email address.",
  limit: "Too many sent from here recently. Try again in a few minutes.",
  unavailable: "Sending isn't configured on this instance right now.",
  send: "The email didn't go out. Try again in a moment.",
};

const WAYS = [
  {
    icon: Star,
    title: "Star us on GitHub",
    body: "The single biggest signal for a project like this. Thirty seconds, no account gymnastics if you already have one.",
    cta: "Star restax/freehold",
    href: "https://github.com/restax/freehold",
  },
  {
    icon: ChatCircleText,
    title: "Tell one TC",
    body: "Most coordinators found their current platform through another coordinator. If Freehold saves you time, one honest message to a colleague does more than any ad we could buy.",
    cta: "Share freeholdtc.dev",
    href: "mailto:?subject=Worth%20a%20look%3A%20Freehold&body=I%27ve%20been%20using%20Freehold%20for%20transaction%20management%20%E2%80%94%20open%20source%2C%20AI%20reads%20the%20contract%2C%20free%20to%20self-host%20or%20%2429%2Fmo%20hosted.%20Demo%3A%20https%3A%2F%2Ffreeholdtc.dev",
  },
  {
    icon: GithubLogo,
    title: "Write about your experience",
    body: "A review, a comparison, a forum reply, anywhere TCs read. Good or critical, honest words help people decide. Review platforms are coming; for now, GitHub and your own channels are home.",
    cta: "Open a discussion",
    href: "https://github.com/restax/freehold",
  },
];

export default async function RecommendPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  return (
    <main className="bg-stone-50 text-stone-900">
      <MarketingNav />

      <section className="mx-auto max-w-3xl px-4 pb-20 pt-12 sm:px-6 lg:pt-16">
        <h1 className="font-display max-w-xl text-3xl font-bold leading-[1.1] tracking-tight md:text-4xl">
          Recommend Freehold, because you want to.
        </h1>
        <p className="mt-5 max-w-xl leading-relaxed text-stone-600">
          Here's our deal: we pay no affiliate commissions, ever. Other platforms hand recommenders
          20% of your subscription forever, which is why so many "reviews" in this industry read
          like ads. A Freehold recommendation can't be bought, so if we've earned yours, it means
          something, and here's where it helps most.
        </p>

        <div className="mt-8 max-w-xl rounded-xl border border-brand-600/25 bg-white p-6">
          <p className="flex items-center gap-1.5 font-display font-bold">
            <PaperPlaneTilt size={17} weight="fill" className="text-brand-600" aria-hidden />
            Send them the demo
          </p>
          <p className="mt-1 text-sm leading-relaxed text-stone-600">
            Know one TC who'd want this? Give us their email and we'll send a short, honest
            introduction with a link to the live demo. One email, nothing else follows.
          </p>
          {sent === "1" ? (
            <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800">
              Sent. Thanks for passing it along.
            </p>
          ) : (
            <form action={sendRecommendation} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="friendEmail">
                Friend's email
              </label>
              <input
                id="friendEmail"
                name="friendEmail"
                type="email"
                required
                placeholder="their@email.com"
                className="w-full flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm shadow-xs focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
              />
              {/* Honeypot: invisible to a person, filled by most simple bots. */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute left-[-9999px] h-0 w-0 opacity-0"
              />
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-[var(--color-brand-fg)] shadow-xs transition hover:bg-brand-600 active:scale-[0.98]"
              >
                Send
              </button>
            </form>
          )}
          {error && (
            <p className="mt-3 text-sm text-red-700">
              {SEND_ERROR[error] ?? "Something went wrong. Try again."}
            </p>
          )}
        </div>

        <p className="mt-10 max-w-xl text-sm font-medium text-stone-500">
          Or, other ways that help:
        </p>
        <div className="mt-3 flex flex-col gap-4">
          {WAYS.map((way) => {
            const IconComponent = way.icon;
            return (
              <div
                key={way.title}
                className="flex flex-col gap-3 rounded-xl border border-stone-200/70 bg-white p-6 sm:flex-row sm:items-center sm:gap-6"
              >
                <IconComponent
                  size={28}
                  weight="duotone"
                  className="shrink-0 text-brand-600"
                  aria-hidden
                />
                <div className="flex-1">
                  <h2 className="font-display font-bold">{way.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600">{way.body}</p>
                </div>
                <a
                  href={way.href}
                  target={way.href.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                  className="shrink-0 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-brand-600 hover:text-brand-700"
                >
                  {way.cta}
                </a>
              </div>
            );
          })}
        </div>

        <p className="mt-10 max-w-xl text-sm leading-relaxed text-stone-500">
          Something rubbed you the wrong way instead? Tell us first:{" "}
          <a
            href="mailto:hello@freeholdtc.dev"
            className="font-medium text-brand-700 hover:text-brand-600"
          >
            hello@freeholdtc.dev
          </a>
          . Criticism from working TCs is how the roadmap gets built.
        </p>
      </section>

      <MarketingFooter />
    </main>
  );
}
