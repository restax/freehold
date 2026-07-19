import { ChatCircleText, GithubLogo, Star } from "@phosphor-icons/react/dist/ssr";
import { MarketingFooter, MarketingNav } from "@/components/marketing";

export const metadata = {
  title: "Recommend Freehold | Freehold",
  description:
    "Freehold pays no affiliate commissions — recommendations are earned or they don't happen. If we've earned yours, here's where it helps most.",
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
    body: "A review, a comparison, a forum reply — anywhere TCs read. Good or critical, honest words help people decide. Review platforms are coming; for now, GitHub and your own channels are home.",
    cta: "Open a discussion",
    href: "https://github.com/restax/freehold",
  },
];

export default function RecommendPage() {
  return (
    <main className="bg-stone-50 text-stone-900">
      <MarketingNav />

      <section className="mx-auto max-w-3xl px-4 pb-20 pt-12 sm:px-6 lg:pt-16">
        <h1 className="font-display max-w-xl text-4xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
          Recommend Freehold — because you want to.
        </h1>
        <p className="mt-5 max-w-xl leading-relaxed text-stone-600">
          Here's our deal: we pay no affiliate commissions, ever. Other platforms hand recommenders
          20% of your subscription forever, which is why so many "reviews" in this industry read
          like ads. A Freehold recommendation can't be bought — so if we've earned yours, it means
          something, and here's where it helps most.
        </p>

        <div className="mt-10 flex flex-col gap-4">
          {WAYS.map((way) => {
            const IconComponent = way.icon;
            return (
              <div
                key={way.title}
                className="flex flex-col gap-3 rounded-2xl border border-stone-200/70 bg-white p-6 sm:flex-row sm:items-center sm:gap-6"
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
