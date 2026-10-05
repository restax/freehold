import { billingEnabled, cardCheckPassed } from "@freehold/ee-billing";
import Link from "next/link";
import { clearFlag, userForFlagToken } from "@/lib/account-flags";
import { startCardCheck } from "@/lib/actions/account-flag";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify your account", robots: { index: false } };

/**
 * Where the flagged-account email lands. Public on purpose: the person can't
 * sign in, so the long random link is what proves it's them. Coming back from
 * Stripe with ?session_id= clears the flag once the card check really passed
 * for this user.
 */
export default async function VerifyAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { token } = await params;
  const { session_id: sessionId } = await searchParams;
  const user = await userForFlagToken(token);

  if (!user) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-lg font-semibold">This link is no longer active</h1>
        <p className="text-sm text-stone-600">
          It has already been used, or we sent you a newer one. If your account is verified, you can
          sign in now.
        </p>
        <Link href="/login" className="text-sm text-brand-600 hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }

  if (sessionId && (await cardCheckPassed(sessionId, user.id).catch(() => false))) {
    await clearFlag(user.id, "card");
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-lg font-semibold">Thank you, you are verified</h1>
        <p className="text-sm text-stone-600">
          Your card was not charged. You can sign in as normal.
        </p>
        <Link
          href="/login"
          className="rounded-lg bg-brand-600 px-4 py-2 text-center font-medium text-white hover:bg-brand-700"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Verify your account</h1>
      <p className="text-sm text-stone-600">
        Hi {user.name}. Your account has been flagged as suspicious and sign-in is paused. Nothing
        has been deleted.
      </p>
      {sessionId && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          We could not confirm that card. Please try again, or reply to our email.
        </p>
      )}
      {billingEnabled() && (
        <form action={startCardCheck} className="flex flex-col gap-2">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
          >
            Verify a credit card
          </button>
          <span className="text-xs text-stone-500">
            Your card is checked with your bank and is not charged.
          </span>
        </form>
      )}
      <p className="text-sm text-stone-600">
        Or reply to the email we sent you and tell us a little about how you plan to use Freehold.
        We will clear the account once we have read it.
      </p>
    </div>
  );
}
