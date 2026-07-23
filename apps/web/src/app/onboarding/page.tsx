import { ArrowUpRight, Cloud } from "@phosphor-icons/react/dist/ssr";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { LAUNCH_OFFER, launchWindowOpen } from "@/lib/launch-offer";
import { isCloud } from "@/lib/plans";
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

      {/* Self-host installs only: a soft pointer to the hosted version. Cloud
          installs never see this. */}
      {!isCloud() && (
        <div className="mt-5 w-full max-w-sm rounded-xl border border-brand-200 bg-brand-50/50 p-5">
          <div className="flex items-center gap-2">
            <Cloud size={18} weight="fill" className="text-brand-600" aria-hidden />
            <span className="font-medium text-brand-800">Freehold Cloud</span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
            Rather not run the server yourself? Cloud is the same Freehold, hosted and kept current
            by us — backups, upgrades, and email deliverability handled.
          </p>
          {launchWindowOpen() && (
            <p className="mt-2 text-sm font-medium text-brand-800">
              Launch offer: 50% off, locked in through 2027 — sign up before{" "}
              {LAUNCH_OFFER.deadlineLabel}.
            </p>
          )}
          <a
            href="https://freeholdtc.dev/pricing"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-600"
          >
            See Freehold Cloud
            <ArrowUpRight size={14} weight="bold" aria-hidden />
          </a>
        </div>
      )}
    </main>
  );
}
