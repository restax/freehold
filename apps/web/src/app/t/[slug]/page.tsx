import { prisma } from "@freehold/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const org = await prisma.organization.findUnique({ where: { slug }, select: { name: true } });
  return {
    title: org ? `${org.name} — Client portal` : "Client portal",
    robots: { index: false },
  };
}

/**
 * The branded entry page a client sees at <slug>.freeholdtc.dev. Access to
 * actual transaction data is only ever through a private /portal/<token>
 * link, so this page shows nothing but the workspace's name and how to get
 * in.
 */
export default async function TenantPortalHome({ params }: Props) {
  const { slug } = await params;
  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { name: true },
  });
  if (!org) notFound();

  return (
    <main className="flex min-h-screen flex-col bg-[radial-gradient(90%_120%_at_50%_0%,#0b7a49_0%,#054f30_100%)] text-white">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-brand-200">
          Client portal
        </p>
        <h1 className="font-display mt-4 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
          {org.name}
        </h1>
        <p className="mt-6 max-w-md leading-relaxed text-brand-50/90">
          This is the secure portal where clients of {org.name} follow their transactions: key
          dates, documents, and progress, all in one place.
        </p>
        <div className="mt-8 rounded-2xl border border-white/15 bg-white/10 px-6 py-5 text-sm leading-relaxed text-brand-50/90">
          Access is by private link only. Check your email for a link from your transaction
          coordinator that looks like{" "}
          <code className="font-mono text-xs text-white">/portal/…</code>, or ask them to send it
          again — links can be reissued at any time.
        </div>
      </div>
      <footer className="pb-8 text-center text-xs text-brand-50/60">
        Powered by{" "}
        <a href="https://freeholdtc.dev" className="font-medium text-brand-50/90 hover:text-white">
          Freehold
        </a>
      </footer>
    </main>
  );
}
