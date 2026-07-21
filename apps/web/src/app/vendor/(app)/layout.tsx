import { prisma } from "@freehold/db";
import Link from "next/link";
import { Wordmark } from "@/components/marketing";
import { SignOutButton } from "@/components/sign-out-button";
import { requireVendor } from "@/lib/vendor-auth";

export const dynamic = "force-dynamic";

/**
 * Shell for the signed-in vendor. requireVendor is the gate — a TC user with
 * no vendor never reaches here; they're bounced to /vendor/register.
 */
export default async function VendorDashboardLayout({ children }: { children: React.ReactNode }) {
  const { vendorId } = await requireVendor();
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { name: true },
  });

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <Wordmark href="/vendor/dashboard" />
            <span className="hidden text-sm text-stone-400 sm:inline">for vendors</span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/vendor/dashboard" className="text-stone-600 hover:text-stone-900">
              Orders
            </Link>
            <Link href="/vendor/profile" className="text-stone-600 hover:text-stone-900">
              Profile
            </Link>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <p className="mb-6 text-sm text-stone-500">
          Signed in as <span className="font-medium text-stone-700">{vendor?.name}</span>
        </p>
        {children}
      </main>
    </div>
  );
}
