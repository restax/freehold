import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { getSession, listTenants } from "@/lib/session";
import { vendorIdForUser } from "@/lib/vendor-auth";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const tenants = await listTenants();
  if (tenants.length > 0) redirect("/dashboard");
  // A vendor who lands here (e.g. by typing the URL) goes to the vendor site.
  if (await vendorIdForUser(session.user.id)) redirect("/vendor/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-brand-700">
        Welcome to Freehold
      </h1>
      <p className="mb-6 max-w-md text-center text-stone-600">
        Set up your workspace — your brokerage, title company, or TC business. You can invite your
        team and add the clients you serve afterward.
      </p>
      <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <OnboardingForm />
      </div>
    </main>
  );
}
