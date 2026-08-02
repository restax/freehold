import { prisma, withTenant } from "@freehold/db";
import { CheckCircle, EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormBody } from "@/components/form-render";
import { identifyForForm } from "@/lib/actions/form-identify";
import { submitPublicForm } from "@/lib/actions/public-forms";
import { layoutFields, parseLayout } from "@/lib/form-schema";
import { publicTenantWhere } from "@/lib/public-tenant";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string; formSlug: string }>;
  searchParams: Promise<{
    sent?: string;
    invalid?: string;
    tooMany?: string;
    sentLink?: string;
    bademail?: string;
    new?: string;
    email?: string;
  }>;
};

/**
 * A tenant's public intake form. Reachable only when the form is published
 * AND placed on the public website — a draft or portal-only form is a 404
 * out here, not a redirect, so its existence isn't advertised.
 */
async function load(slug: string, formSlug: string) {
  // `slug` is a workspace slug, or a hostname when the workspace serves its
  // forms from its own domain — see lib/public-tenant.ts.
  const org = await prisma.organization.findFirst({
    where: publicTenantWhere(slug),
    select: { id: true, name: true, slug: true, logo: true },
  });
  if (!org) return null;
  const form = await withTenant(org.id, (tx) => tx.form.findFirst({ where: { slug: formSlug } }));
  if (form?.status !== "published" || !form.showPublic) return null;
  return { org, form };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, formSlug } = await params;
  const found = await load(slug, formSlug);
  if (!found) return { title: "Form", robots: { index: false } };
  return {
    title: `${found.form.title} — ${found.org.name}`,
    description: found.form.description ?? undefined,
  };
}

export default async function PublicFormPage({ params, searchParams }: Props) {
  const { slug, formSlug } = await params;
  const { sent, invalid, tooMany, sentLink, bademail, new: isNew, email } = await searchParams;
  const found = await load(slug, formSlug);
  if (!found) notFound();
  const { org, form } = found;
  const layout = parseLayout(form.layout);

  const invalidField = invalid
    ? (layoutFields(layout).find((f) => f.key === invalid) ?? null)
    : null;

  // Email first: a returning client gets a link so they never retype their
  // business; anyone else drops straight into the form on this same page.
  const showForm = Boolean(isNew) || Boolean(invalid);
  const knownEmail = typeof email === "string" ? email : undefined;

  return (
    <main className="min-h-[100dvh] bg-stone-50 py-10">
      <div className="mx-auto w-full max-w-2xl px-5">
        <header className="mb-6">
          {org.logo ? (
            // biome-ignore lint/performance/noImgElement: tenant logos are arbitrary remote URLs
            <img src={org.logo} alt={org.name} className="mb-3 h-9 w-auto" />
          ) : (
            <p className="mb-1 text-sm font-medium text-stone-500">{org.name}</p>
          )}
          <h1 className="font-display text-2xl font-bold tracking-tight text-stone-900">
            {form.title}
          </h1>
          {form.description && (
            <p className="mt-1.5 text-[15px] leading-relaxed text-stone-600">{form.description}</p>
          )}
        </header>

        {sent ? (
          <div className="rounded-xl border border-brand-600/30 bg-white p-6 shadow-sm">
            <p className="flex items-center gap-2 text-base font-semibold text-stone-900">
              <CheckCircle size={20} weight="fill" className="text-brand-600" aria-hidden />
              Thank you — we have it.
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-stone-600">
              {org.name} will look this over and be in touch. Nothing else is needed from you right
              now.
            </p>
          </div>
        ) : sentLink ? (
          <div className="rounded-xl border border-brand-600/30 bg-white p-6 shadow-sm">
            <p className="flex items-center gap-2 text-base font-semibold text-stone-900">
              <EnvelopeSimple size={20} weight="fill" className="text-brand-600" aria-hidden />
              You're already with us — check your email.
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-stone-600">
              We've sent a link to <strong>{knownEmail}</strong> that opens this form with your
              details already filled in. It works for the next three days, and there's nothing to
              sign in to.
            </p>
          </div>
        ) : !showForm ? (
          <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            {tooMany && (
              <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                That's a lot of tries in a short time. Give it a few minutes, or email {org.name}{" "}
                directly.
              </p>
            )}
            {bademail && (
              <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                That doesn't look like an email address — mind checking it?
              </p>
            )}
            <form action={identifyForForm} className="flex flex-col gap-4">
              <input type="hidden" name="orgSlug" value={org.slug} />
              <input type="hidden" name="formSlug" value={formSlug} />
              <input
                type="text"
                name="company_website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
              />
              <label htmlFor="identify-email" className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-stone-800">
                  What's your email address?
                </span>
                <span className="text-xs text-stone-500">
                  If you've worked with {org.name} before, we'll skip the questions we already know
                  the answers to.
                </span>
                <input
                  id="identify-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-[15px] text-stone-900 shadow-xs transition-colors placeholder:text-stone-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
                />
              </label>
              <div>
                <button
                  type="submit"
                  className="w-full rounded-md bg-brand-700 px-4 py-2.5 text-[15px] font-medium text-white shadow-xs transition hover:bg-brand-600 active:scale-[0.99] sm:w-auto"
                >
                  Continue
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            {tooMany && (
              <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                That's a lot of submissions in a short time. Give it a few minutes and try again —
                or email {org.name} directly.
              </p>
            )}
            {invalidField && (
              <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                Please check <strong>{invalidField.label}</strong> and send again.
              </p>
            )}
            <form action={submitPublicForm} className="flex flex-col gap-5">
              <input type="hidden" name="orgSlug" value={org.slug} />
              <input type="hidden" name="formSlug" value={formSlug} />
              {/* Honeypot — hidden from people, irresistible to bots. */}
              <input
                type="text"
                name="company_website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
              />
              <FormBody layout={layout} values={knownEmail ? { email: knownEmail } : {}} />
              <div className="border-t border-stone-100 pt-4">
                <button
                  type="submit"
                  className="w-full rounded-md bg-brand-700 px-4 py-2.5 text-[15px] font-medium text-white shadow-xs transition hover:bg-brand-600 active:scale-[0.99] sm:w-auto"
                >
                  Send to {org.name}
                </button>
              </div>
            </form>
          </div>
        )}

        <footer className="mt-6 text-center text-xs text-stone-400">
          Powered by{" "}
          <a href="https://freeholdtc.dev" className="font-medium hover:text-stone-600">
            Freehold
          </a>
        </footer>
      </div>
    </main>
  );
}
