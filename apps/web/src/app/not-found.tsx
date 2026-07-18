import Link from "next/link";
import { Wordmark } from "@/components/marketing";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <Wordmark />
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="max-w-md text-balance text-sm leading-relaxed text-stone-500">
        This page doesn't exist. If you followed a shared portal link, it may have expired or been
        revoked — ask the person who sent it for a new one.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-xs transition hover:border-stone-400 hover:bg-stone-50 active:scale-[0.98]"
      >
        Go to the homepage
      </Link>
    </main>
  );
}
