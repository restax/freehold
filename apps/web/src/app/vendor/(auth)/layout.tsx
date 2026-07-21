import { Handshake, Lightning, Storefront } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Wordmark } from "@/components/marketing";

/**
 * Auth shell for the vendor site (vendor.freeholdtc.dev). Sells the network up
 * top — a coordinator-facing pitch a vendor lands on cold — then keeps the
 * sign-in / register card centered below it. Same brand face as the main
 * product; wraps both the login and register pages.
 */

const VALUE_PROPS = [
  [
    Handshake,
    "Register once",
    "One account connects you to every coordinator you work with — no new login per client.",
  ],
  [
    Lightning,
    "Orders, not email",
    "Accept, schedule, and send documents back — it all lands on the file instantly, no re-typing.",
  ],
  [
    Storefront,
    "Get found",
    "List in the coordinator directory and advertise by region, so new coordinators find you.",
  ],
] as const;

export default function VendorAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-stone-50">
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(80%_120%_at_50%_-10%,rgba(13,146,87,0.10),transparent)]"
        />
        <div className="relative mx-auto max-w-3xl px-6 pb-2 pt-10 text-center">
          <div className="flex justify-center">
            <Wordmark />
          </div>
          <span className="mt-3 inline-block rounded-full bg-brand-600/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
            FreeholdVendors
          </span>
          <h1 className="font-display mx-auto mt-4 max-w-2xl text-balance text-3xl font-extrabold tracking-tight text-stone-900 md:text-4xl">
            Get on every coordinator's short list.
          </h1>
          <p className="mx-auto mt-3 max-w-xl leading-relaxed text-stone-600">
            Title companies, inspectors, photographers, sign installers, law offices — register once
            and take orders from every coordinator who works with you, without the email
            back-and-forth.
          </p>

          <div className="mx-auto mt-8 grid max-w-2xl gap-5 sm:grid-cols-3">
            {VALUE_PROPS.map(([Icon, title, body]) => (
              <div key={title} className="flex flex-col items-center gap-1.5 px-2 text-center">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-brand-700 shadow-sm ring-1 ring-stone-200">
                  <Icon size={20} weight="duotone" aria-hidden />
                </span>
                <h2 className="text-sm font-semibold text-stone-800">{title}</h2>
                <p className="text-xs leading-relaxed text-stone-500">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-sm flex-col items-center px-6 pb-16 pt-8">
        <div className="w-full rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          {children}
        </div>
        <p className="mt-6 text-xs text-stone-400">
          A transaction coordinator using Freehold?{" "}
          <Link href="/" className="text-brand-600 hover:underline">
            See the main site
          </Link>
        </p>
      </section>
    </main>
  );
}
