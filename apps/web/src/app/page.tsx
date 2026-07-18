import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <h1 className="text-5xl font-semibold tracking-tight text-brand-700">Freehold</h1>
        <p className="mt-3 max-w-md text-stone-600">
          Open-source AI transaction management and CRM for real estate brokerages and transaction
          coordinators. Own it outright.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/signup"
          className="rounded-lg bg-brand-700 px-5 py-2.5 font-medium text-white shadow-xs transition hover:bg-brand-600 active:scale-[0.98]"
        >
          Create account
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 font-medium text-stone-700 shadow-xs transition hover:border-stone-400 hover:bg-stone-50 active:scale-[0.98]"
        >
          Sign in
        </Link>
      </div>
      <p className="text-sm text-stone-400">Pre-alpha — open source, Apache-2.0</p>
    </main>
  );
}
