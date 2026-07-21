import Link from "next/link";
import { notFound } from "next/navigation";
import { updatePlatformSettings } from "@/lib/actions/platform-settings";
import { isOperator } from "@/lib/operator";
import { getPlatformSettings } from "@/lib/platform-settings";
import { card } from "@/lib/ui";

export const dynamic = "force-dynamic";

const field =
  "rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none";

/** Global platform settings — currently just the homepage voice demo's
 *  "call the developer" feature. Gated to operators, like every /admin page. */
export default async function AdminSettingsPage() {
  if (!(await isOperator())) notFound();

  const settings = await getPlatformSettings();
  const onCooldown =
    settings.founderLastCallAt &&
    Date.now() - settings.founderLastCallAt.getTime() <
      settings.founderCallCooldownMinutes * 60 * 1000;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">
          ← Admin
        </Link>
        <h1 className="text-xl font-semibold">Platform settings</h1>
      </div>

      <section className={card}>
        <h2 className="mb-1 font-medium">Homepage voice demo — call the developer</h2>
        <p className="mb-4 text-sm text-stone-500">
          When on, the voice assistant on the homepage may offer to bring you into the call live — a
          real-time demo of "just ask instead of typing." Off by default; only visible to you when
          you flip it on.
        </p>

        <form action={updatePlatformSettings} className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
            <input
              type="checkbox"
              name="founderCallsAvailable"
              defaultChecked={settings.founderCallsAvailable}
              className="h-4 w-4 accent-brand-600"
            />
            Available for demo calls
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Cooldown between calls (minutes)
            <input
              type="number"
              name="founderCallCooldownMinutes"
              min={1}
              max={1440}
              defaultValue={settings.founderCallCooldownMinutes}
              className={`${field} w-32`}
            />
            <span className="text-xs text-stone-400">
              At most one call can connect per cooldown window, across every visitor at once — so it
              can never be spammed even if several people try together.
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Key selling points for the homepage and demo to talk about
            <textarea
              name="founderCallSellingPoints"
              rows={6}
              defaultValue={settings.founderCallSellingPoints ?? ""}
              placeholder={
                "One point per line — the voice assistant weaves these in naturally, in its own words:\n" +
                "- AI reads a purchase contract and page-cites every date and dollar\n" +
                "- Clients get their own branded portal\n" +
                "- Fully source-available — self-host it free forever"
              }
              className={field}
            />
          </label>

          <div>
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Save
            </button>
          </div>
        </form>

        <div className="mt-4 border-t border-stone-100 pt-3 text-xs text-stone-400">
          {settings.founderLastCallAt ? (
            <>
              Last call: {settings.founderLastCallAt.toLocaleString()}
              {onCooldown && (
                <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
                  cooling down
                </span>
              )}
            </>
          ) : (
            "No call has connected yet."
          )}
        </div>
      </section>
    </main>
  );
}
