import { prisma, withTenant } from "@freehold/db";
import { CheckCircle, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormBody } from "@/components/form-render";
import { submitIdentifiedForm } from "@/lib/actions/public-forms";
import { linkRejection, prefillFromClient } from "@/lib/form-access";
import { layoutFields, parseLayout } from "@/lib/form-schema";
import { publicTenantWhere } from "@/lib/public-tenant";

export const dynamic = "force-dynamic";
// A capability URL should never be indexed or cached anywhere.
export const metadata: Metadata = { robots: { index: false, follow: false } };

type Props = {
  params: Promise<{ slug: string; token: string }>;
  searchParams: Promise<{ sent?: string; invalid?: string }>;
};

/**
 * An emailed form link: opens one form, filled in for one known client.
 *
 * This is not a sign-in. Nothing on this page reads the client's
 * transactions, documents, or anything else — only their own name and
 * contact details, which the recipient's inbox already established.
 */
export default async function FormLinkPage({ params, searchParams }: Props) {
  const { slug, token } = await params;
  const { sent, invalid } = await searchParams;

  // `slug` is a workspace slug, or a hostname when the workspace serves its
  // forms from its own domain — see lib/public-tenant.ts.
  const org = await prisma.organization.findFirst({
    where: publicTenantWhere(slug),
    select: { id: true, name: true, slug: true },
  });
  if (!org) notFound();

  const link = await withTenant(org.id, (tx) =>
    tx.formAccessLink.findFirst({
      where: { token },
      include: {
        form: true,
        client: { select: { id: true, name: true, email: true, phone: true, address: true } },
      },
    }),
  );
  if (!link) notFound();

  const rejection = linkRejection(link);
  if (rejection) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-stone-50 px-5">
        <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-stone-900">
            {rejection === "expired" ? "This link has expired" : "This link is no longer active"}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-stone-600">
            {rejection === "expired"
              ? "Links last three days. Start again and we'll send you a fresh one."
              : `${org.name} turned this link off. Ask them for a new one.`}
          </p>
          <a
            href={`/f/${link.form.slug}`}
            className="mt-4 inline-block rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            Start again
          </a>
        </div>
      </main>
    );
  }

  // Touch the link so the workspace can see it was opened.
  await withTenant(org.id, (tx) =>
    tx.formAccessLink.update({ where: { id: link.id }, data: { lastAccessedAt: new Date() } }),
  );

  const layout = parseLayout(link.form.layout);
  const values = prefillFromClient(link.client);
  const invalidField = invalid
    ? (layoutFields(layout).find((f) => f.key === invalid) ?? null)
    : null;

  return (
    <main className="min-h-[100dvh] bg-stone-50 py-10">
      <div className="mx-auto w-full max-w-2xl px-5">
        <header className="mb-6">
          <p className="mb-1 text-sm font-medium text-stone-500">{org.name}</p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-stone-900">
            {link.form.title}
          </h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-brand-800">
            <ShieldCheck size={15} weight="fill" className="text-brand-600" aria-hidden />
            Filling this in as <strong className="font-semibold">{link.client.name}</strong>
          </p>
          {link.form.description && (
            <p className="mt-1.5 text-[15px] leading-relaxed text-stone-600">
              {link.form.description}
            </p>
          )}
        </header>

        {sent ? (
          <div className="rounded-xl border border-brand-600/30 bg-white p-6 shadow-sm">
            <p className="flex items-center gap-2 text-base font-semibold text-stone-900">
              <CheckCircle size={20} weight="fill" className="text-brand-600" aria-hidden />
              Thank you — we have it.
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-stone-600">
              {org.name} will look this over and be in touch.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            {invalidField && (
              <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                Please check <strong>{invalidField.label}</strong> and send again.
              </p>
            )}
            <form action={submitIdentifiedForm} className="flex flex-col gap-5">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="orgSlug" value={org.slug} />
              <FormBody layout={layout} values={values} />
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
          This link is just for this form — it doesn't sign you in to anything.
        </footer>
      </div>
    </main>
  );
}
