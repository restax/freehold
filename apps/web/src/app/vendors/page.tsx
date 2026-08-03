import { Check } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { MarketingFooter, MarketingNav } from "@/components/marketing";
import { SponsoredAds } from "@/components/sponsored-ads";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "For vendors | Freehold",
  description:
    "Title companies, inspectors, photographers, sign installers, and law offices: register once, connect to any coordinator, and take orders without the email back-and-forth.",
};

const POINTS: Array<[string, string]> = [
  [
    "Register once, work with everyone",
    "One account connects you to every coordinator who works with you, like accepting a friend request. No new login per client.",
  ],
  [
    "Orders, not email threads",
    "Accept an order, set the appointment, mark it done. The coordinator and their client see it instantly. No forwarding, no re-typing.",
  ],
  [
    "Upload once, it lands on the file",
    "Send back the title commitment or the photos and they attach straight to the transaction. No 'did you get my email?'",
  ],
  [
    "Not registered yet? Just reply.",
    "A coordinator can order from you by plain email before you ever sign up. You reply like normal and it still gets tracked. Registering just makes it better.",
  ],
];

export default function VendorsPage() {
  return (
    <main className="bg-stone-50 text-stone-900">
      <MarketingNav />

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 lg:pt-16">
        <p className="text-sm font-medium text-brand-600">FreeholdVendors</p>
        <h1 className="font-display mt-2 max-w-2xl text-3xl font-bold leading-[1.1] tracking-tight md:text-4xl">
          Get off email. Take orders where the work already lives.
        </h1>
        <p className="mt-5 max-w-xl leading-relaxed text-stone-600">
          Coordinators run their transactions in Freehold. Register your business once and their
          orders come straight to you: accept, schedule, update, and send documents back without a
          single forwarded email or re-typed appointment.
        </p>
        <div className="mt-7 flex flex-wrap gap-4">
          <Link
            href="/vendor/register"
            className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white shadow-xs transition hover:bg-brand-700 active:scale-[0.98]"
          >
            Register your business
          </Link>
          <Link
            href="/vendor/login"
            className="px-2 py-2.5 font-medium text-brand-700 transition hover:text-brand-600"
          >
            Vendor sign in &rarr;
          </Link>
        </div>

        <div className="mt-14 grid gap-x-8 gap-y-6 md:grid-cols-2">
          {POINTS.map(([title, body]) => (
            <div key={title} className="flex gap-3">
              <Check
                size={20}
                weight="bold"
                aria-hidden
                className="mt-0.5 shrink-0 text-brand-600"
              />
              <div>
                <h2 className="font-medium">{title}</h2>
                <p className="mt-0.5 text-sm leading-relaxed text-stone-600">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-xl border border-brand-600/15 bg-brand-50/60 px-6 py-6">
          <h2 className="font-display text-xl font-bold tracking-tight">Free for vendors.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
            There's no charge to register or take orders. You're here because a coordinator wants to
            work with you, and that's the whole point. Later, if you want more visibility, you can
            list in the coordinator directory and buy a spot in it. That's optional and always
            clearly marked as advertising.
          </p>
        </div>

        <div className="mt-14">
          <SponsoredAds />
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
