import { CheckCircle, EnvelopeSimple, Phone } from "@phosphor-icons/react/dist/ssr";
import { PhoneInput } from "@/components/phone-input";
import type { TenantSiteConfig } from "@/lib/site-config";
import { siteMenu } from "@/lib/site-menu";

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
  publicForms = [],
  formBase = "/f",
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
  /**
   * Published forms the workspace placed on its public website. They appear
   * here automatically — the TC ticks "public website" in the designer and
   * never links anything by hand.
   */
  publicForms?: Array<{ slug: string; title: string; description: string | null }>;
  /**
   * Prefix for form links. The tenant's own host serves them at /f/<slug>;
   * the same page reached at the apex as /t/<slug> needs the full path, or
   * every form link here is a 404.
   */
  formBase?: string;
}) {
  const services = (site.services ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const menu = siteMenu({
    hasServices: services.length > 0,
    forms: publicForms,
    showRegistration: Boolean(site.showRegistration),
    formBase,
  });

  return (
    <main className="min-h-screen bg-white text-stone-900">
      {/* Top bar */}
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-5 sm:px-8">
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
        {/* The menu writes itself from what's published — see lib/site-menu.ts. */}
        {menu.length > 0 && (
          <nav
            aria-label="Site"
            className="order-3 flex flex-wrap items-center gap-x-5 gap-y-2 sm:order-none"
          >
            {menu.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm text-stone-600 transition-colors hover:text-brand-700"
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
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
        <section id="services" className="border-y border-stone-100 bg-stone-50">
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

      {/* Intake forms the workspace published to its public site. */}
      {publicForms.length > 0 && (
        <section id="forms" className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <h2 className="font-display text-2xl font-bold tracking-tight">Get started</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {publicForms.map((f) => (
              <a
                key={f.slug}
                href={`${formBase}/${f.slug}`}
                className="group flex flex-col rounded-2xl border border-stone-200 bg-white p-5 transition-colors hover:border-brand-600/40 hover:bg-brand-50/30"
              >
                <span className="font-display text-lg font-bold tracking-tight text-stone-900">
                  {f.title}
                </span>
                {f.description && (
                  <span className="mt-1.5 text-sm leading-relaxed text-stone-600">
                    {f.description}
                  </span>
                )}
                <span className="mt-3 text-sm font-medium text-brand-700 group-hover:text-brand-600">
                  Start →
                </span>
              </a>
            ))}
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
                      <PhoneInput name="phone" className={inputCls} />
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
