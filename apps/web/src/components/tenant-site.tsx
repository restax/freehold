import { CheckCircle, EnvelopeSimple, Phone } from "@phosphor-icons/react/dist/ssr";
import type { TenantSiteConfig } from "@/lib/site-config";

/**
 * The published tenant mini-site, shared by /t/[slug] (real workspaces) and
 * /example-site (the fictional always-on demo). White theme, two
 * art-directed photographs (public/site/), one brand-green accent.
 * Zero-JS: server-rendered, plain form post.
 */

const inputCls =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";
const labelCls = "flex flex-col gap-1.5 text-sm font-medium text-stone-700";

export function TenantSiteView({
  name,
  logoUrl,
  site,
  thanks,
  leadAction,
  hiddenFields,
  heroImageSrc = "/site/site-hero.jpg",
  about,
}: {
  name: string;
  logoUrl?: string | null;
  site: TenantSiteConfig;
  thanks: boolean;
  leadAction: (formData: FormData) => Promise<void>;
  hiddenFields: Record<string, string>;
  /** Hero photograph; the demo swaps in its team photo here. */
  heroImageSrc?: string;
  /** Optional short "About us" block rendered right under the hero. */
  about?: { heading: string; body: string };
}) {
  const services = (site.services ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <main className="min-h-screen bg-white text-stone-900">
      {/* Top bar */}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={`${name} logo`}
              className="h-9 w-auto max-w-40 object-contain"
            />
          ) : (
            <span className="font-display text-lg font-bold tracking-tight">{name}</span>
          )}
        </div>
        <div className="flex items-center gap-5 text-sm text-stone-600">
          {site.phone && (
            <a
              href={`tel:${site.phone}`}
              className="flex items-center gap-1.5 hover:text-stone-900"
            >
              <Phone size={15} aria-hidden /> <span className="hidden sm:inline">{site.phone}</span>
            </a>
          )}
          {site.email && (
            <a
              href={`mailto:${site.email}`}
              className="flex items-center gap-1.5 hover:text-stone-900"
            >
              <EnvelopeSimple size={15} aria-hidden />
              <span className="hidden sm:inline">{site.email}</span>
            </a>
          )}
        </div>
      </header>

      {/* Hero: split, image right */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[5fr_6fr] lg:gap-14">
        <div>
          {logoUrl && (
            <p className="font-display mb-3 text-sm font-bold tracking-tight text-stone-500">
              {name}
            </p>
          )}
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
            {site.tagline || name}
          </h1>
          {site.about && (
            <p className="mt-5 max-w-md leading-relaxed text-stone-600">{site.about}</p>
          )}
          {site.showRegistration && (
            <a
              href="#work-with-us"
              className="mt-7 inline-block rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
            >
              Work with us
            </a>
          )}
        </div>
        <img src={heroImageSrc} alt="" className="aspect-[16/10] w-full rounded-2xl object-cover" />
      </section>

      {/* About */}
      {about && (
        <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-bold tracking-tight">{about.heading}</h2>
            <p className="mt-3 leading-relaxed text-stone-600">{about.body}</p>
          </div>
        </section>
      )}

      {/* Services */}
      {services.length > 0 && (
        <section className="border-y border-stone-100 bg-stone-50">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
            <h2 className="font-display text-2xl font-bold tracking-tight">What we handle</h2>
            <ul className="mt-6 grid gap-x-10 gap-y-4 sm:grid-cols-2">
              {services.map((s) => (
                <li key={s} className="flex items-start gap-3 text-stone-700">
                  <CheckCircle
                    size={20}
                    weight="duotone"
                    className="mt-0.5 shrink-0 text-brand-600"
                    aria-hidden
                  />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Registration: form left, detail image right */}
      {site.showRegistration && (
        <section id="work-with-us" className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-[6fr_5fr] lg:gap-14">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">
                Tell us about your move
              </h2>
              {thanks ? (
                <p className="mt-5 rounded-2xl border border-brand-100 bg-brand-50 px-6 py-5 text-sm leading-relaxed text-brand-900">
                  Thanks — you're on the list. {name} will reach out shortly.
                </p>
              ) : (
                <form action={leadAction} className="mt-6 flex flex-col gap-4">
                  {Object.entries(hiddenFields).map(([k, v]) => (
                    <input key={k} type="hidden" name={k} value={v} />
                  ))}
                  {/* Honeypot: humans never see or fill this. */}
                  <input
                    type="text"
                    name="company_website"
                    tabIndex={-1}
                    autoComplete="off"
                    className="hidden"
                    aria-hidden
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={labelCls}>
                      Your name *
                      <input name="name" required className={inputCls} />
                    </label>
                    <label className={labelCls}>
                      I'm interested in
                      <select name="interest" className={inputCls} defaultValue="">
                        <option value="">Choose one…</option>
                        <option value="BUYER">Buying</option>
                        <option value="SELLER">Selling</option>
                        <option value="OTHER">Something else</option>
                      </select>
                    </label>
                    <label className={labelCls}>
                      Email
                      <input name="email" type="email" className={inputCls} />
                    </label>
                    <label className={labelCls}>
                      Phone
                      <input name="phone" className={inputCls} />
                    </label>
                  </div>
                  <label className={labelCls}>
                    Anything we should know?
                    <textarea name="message" rows={3} className={inputCls} />
                  </label>
                  <button
                    type="submit"
                    className="self-start rounded-xl bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 active:translate-y-px"
                  >
                    Send
                  </button>
                </form>
              )}
            </div>
            <img
              src="/site/site-keys.jpg"
              alt=""
              className="hidden aspect-[3/2] w-full rounded-2xl object-cover lg:block"
            />
          </div>
        </section>
      )}

      <footer className="border-t border-stone-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-xs text-stone-400 sm:px-8">
          <span>
            © {new Date().getFullYear()} {name}
          </span>
          <span>
            Powered by{" "}
            <a
              href="https://freeholdtc.dev"
              className="font-medium text-stone-500 hover:text-stone-800"
            >
              Freehold
            </a>
          </span>
        </div>
      </footer>
    </main>
  );
}
