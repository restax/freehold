import { prisma, withTenant } from "@freehold/db";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { submitReview } from "@/lib/actions/reviews";
import { reviewLinkUsable } from "@/lib/reviews";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ sent?: string; invalid?: string }>;
};

/**
 * Two steps, like resolvePortal: the bare token lookup (client_review has no
 * RLS, so this works before the tenant is known) gets scalar fields only,
 * then a withTenant fetch pulls the property address and org name — those
 * tables DO have RLS, so joining them straight off the bare query would
 * silently come back empty.
 */
async function load(token: string) {
  const review = await prisma.clientReview.findUnique({ where: { token } });
  if (!review) return null;
  const details = await withTenant(review.tenantId, async (tx) => {
    const [txn, org] = await Promise.all([
      tx.transaction.findUnique({
        where: { id: review.transactionId },
        select: { propertyAddress: true },
      }),
      tx.organization.findUniqueOrThrow({ where: { id: review.tenantId }, select: { name: true } }),
    ]);
    return { propertyAddress: txn?.propertyAddress ?? "your transaction", orgName: org.name };
  });
  return { ...review, ...details };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const review = await load(token);
  return {
    title: review ? `How did we do? — ${review.orgName}` : "Review",
    robots: { index: false },
  };
}

function StarField({ name }: { name: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-4">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="flex flex-col items-center gap-1 text-xs text-stone-500 has-[:checked]:text-brand-700"
          >
            <input
              type="radio"
              name={name}
              value={n}
              required={name === "businessRating"}
              className="h-5 w-5 accent-brand-600"
            />
            {n}
          </label>
        ))}
      </div>
    </div>
  );
}

export default async function ReviewPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { sent, invalid } = await searchParams;
  const review = await load(token);
  if (!review) notFound();

  const usable = reviewLinkUsable(review);
  const alreadyAnswered = Boolean(review.answeredAt);

  return (
    <main className="flex min-h-[100dvh] flex-col bg-stone-50 py-10">
      <div className="mx-auto w-full max-w-xl px-5">
        <header className="mb-6">
          <p className="mb-1 text-sm font-medium text-stone-500">{review.orgName}</p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-stone-900">
            How did we do?
          </h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-stone-600">
            {review.propertyAddress}
          </p>
        </header>

        {sent || alreadyAnswered ? (
          <div className="rounded-xl border border-brand-600/30 bg-white p-6 shadow-sm">
            <p className="flex items-center gap-2 text-base font-semibold text-stone-900">
              <CheckCircle size={20} weight="fill" className="text-brand-600" aria-hidden />
              Thank you — that's recorded.
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-stone-600">
              {review.orgName} appreciates you taking the time.
            </p>
          </div>
        ) : !usable ? (
          <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            <p className="text-[15px] leading-relaxed text-stone-600">
              This link has expired. If you'd still like to leave feedback, reply to the original
              email and {review.orgName} can send a new one.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            {invalid && (
              <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                Please pick a rating for the business before sending.
              </p>
            )}
            <form action={submitReview} className="flex flex-col gap-6">
              <input type="hidden" name="token" value={token} />

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-stone-800">
                  Overall, how was your experience with {review.orgName}?
                </span>
                <StarField name="businessRating" />
              </div>

              {review.coordinatorId && (
                <div className="flex flex-col gap-2 border-t border-stone-100 pt-5">
                  <span className="text-sm font-medium text-stone-800">
                    And with {review.coordinatorName}, specifically?
                  </span>
                  <span className="text-xs text-stone-500">
                    Optional — skip if you're not sure.
                  </span>
                  <StarField name="coordinatorRating" />
                </div>
              )}

              <label className="flex flex-col gap-1.5 border-t border-stone-100 pt-5">
                <span className="text-sm font-medium text-stone-800">Anything you'd add?</span>
                <textarea
                  name="comment"
                  rows={4}
                  maxLength={2000}
                  placeholder="Optional"
                  className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-[15px] text-stone-900 shadow-xs transition-colors placeholder:text-stone-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
                />
              </label>

              <label className="flex items-start gap-2.5 text-sm text-stone-700">
                <input
                  type="checkbox"
                  name="publishAllowed"
                  className="mt-0.5 h-4 w-4 accent-brand-600"
                />
                <span>
                  {review.orgName} may quote this publicly. Leave unchecked to keep it private.
                </span>
              </label>

              <div>
                <button
                  type="submit"
                  className="w-full rounded-md bg-brand-700 px-4 py-2.5 text-[15px] font-medium text-white shadow-xs transition hover:bg-brand-600 active:scale-[0.99] sm:w-auto"
                >
                  Send
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
