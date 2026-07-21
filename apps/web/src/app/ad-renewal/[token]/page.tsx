import Link from "next/link";
import { notFound } from "next/navigation";
import { Wordmark } from "@/components/marketing";
import { unsubscribeAdRenewalAction } from "@/lib/actions/ad-renewal";
import { resolveAdRenewalToken } from "@/lib/vendor-ad-renewals";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ad reminders | Freehold",
  robots: { index: false, follow: false },
};

/**
 * The landing for the unsubscribe link in a renewal email. The token is the
 * capability — no login. A vendor can stop the reminders here, or head to their
 * profile to set up billing and relight the ad. Mutating happens only on the
 * explicit "stop" button (a POST), never on load, so an email client prefetch
 * can't silently unsubscribe them.
 */
export default async function AdRenewalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ad = await resolveAdRenewalToken(token);
  if (!ad) notFound();

  const done = Boolean(ad.renewalUnsubscribedAt);

  return (
    <main className="grid min-h-screen place-items-center bg-stone-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <div className="flex justify-center">
          <Wordmark />
        </div>

        {done ? (
          <>
            <h1 className="mt-6 text-lg font-semibold text-stone-900">You're unsubscribed</h1>
            <p className="mt-2 text-sm text-stone-600">
              We won't send any more renewal reminders for {ad.vendor.name}. Your ad stays paused —
              you can start it again any time from your profile.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-lg font-semibold text-stone-900">
              Renewal reminders for {ad.vendor.name}
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              Your free ad trial has ended, so the ad is paused. Keep it running, or stop these
              reminders.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/vendor/profile"
                className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Keep advertising — set up billing
              </Link>
              <form action={unsubscribeAdRenewalAction}>
                <input type="hidden" name="token" value={token} />
                <button
                  type="submit"
                  className="text-sm text-stone-500 underline underline-offset-2 hover:text-stone-700"
                >
                  Stop these reminders
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
