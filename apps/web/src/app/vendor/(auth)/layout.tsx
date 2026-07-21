import Link from "next/link";
import { Wordmark } from "@/components/marketing";

/** Auth shell for the vendor site — same face as the main product. */
export default function VendorAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-6">
      <div className="mb-2">
        <Wordmark />
      </div>
      <p className="mb-6 text-sm font-medium text-brand-700">for vendors</p>
      <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        {children}
      </div>
      <p className="mt-6 text-xs text-stone-400">
        A transaction coordinator uses Freehold?{" "}
        <Link href="/" className="text-brand-600 hover:underline">
          See the main site
        </Link>
      </p>
    </main>
  );
}
