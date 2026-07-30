import Link from "next/link";
import { notFound } from "next/navigation";
import { updatePlatformSettings } from "@/lib/actions/platform-settings";
import { DEFAULT_SUMMARY_STYLE, SUMMARY_MODELS } from "@/lib/handbook/style";
import { isOperator } from "@/lib/operator";
import { getPlatformSettings } from "@/lib/platform-settings";
import { card } from "@/lib/ui";
import { STT_MODEL_GROUPS } from "@/lib/voice-inference-models";

export const dynamic = "force-dynamic";

const field =
  "rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none";

/** Global platform settings — the homepage voice demo's "call the developer"
 *  feature, and the voice pipeline's STT/TTS models. Gated to operators, like
 *  every /admin page. One form, one Save: keeping every field in a single
 *  submission avoids a partial save quietly resetting the fields it left out. */
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

      <form action={updatePlatformSettings} className="flex flex-col gap-6">
        <section className={card}>
          <h2 className="mb-1 font-medium">Homepage voice demo — call the developer</h2>
          <p className="mb-4 text-sm text-stone-500">
            When on, the voice assistant on the homepage may offer to bring you into the call live —
            a real-time demo of "just ask instead of typing." Off by default; only visible to you
            when you flip it on.
          </p>

          <div className="flex flex-col gap-4">
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
                At most one call can connect per cooldown window, across every visitor at once — so
                it can never be spammed even if several people try together.
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
          </div>

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

        <section className={card}>
          <h2 className="mb-1 font-medium">Voice pipeline — speech-to-text</h2>
          <p className="mb-4 text-sm text-stone-500">
            Routed through LiveKit's own hosted inference — billed per-minute through LiveKit, no
            Deepgram key involved. Takes effect on the very next voice session, no redeploy.
            Text-to-speech stays a fixed direct ElevenLabs call for now (LiveKit's inference proxy
            can't reach our private voice), and the language model stays a direct Claude call —
            neither is editable here yet.
          </p>

          <label className="flex max-w-xs flex-col gap-1 text-sm">
            Speech-to-text (STT)
            <select name="voiceSttModel" defaultValue={settings.voiceSttModel} className={field}>
              {STT_MODEL_GROUPS.map((g) => (
                <optgroup key={g.provider} label={g.provider}>
                  {g.models.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <p className="mt-3 text-xs text-stone-400">
            Current per-minute pricing for each model is on LiveKit Cloud's own dashboard — it
            changes over time, so it isn't duplicated here.
          </p>
        </section>

        <section className={card}>
          <h2 className="mb-1 font-medium">Handbook — daily recap</h2>
          <p className="mb-4 text-sm text-stone-500">
            The short written recap at the top of a coordinator's Today screen. Deliberately not the
            contract-extraction model: extraction reads a document nobody has checked and its
            mistakes land on the file, while this only restates work the workspace already holds and
            writes nothing. Haiku is enough for that; raise it if the prose disappoints.
          </p>

          <div className="flex flex-wrap items-end gap-6">
            <label className="flex max-w-xs flex-col gap-1 text-sm">
              Model
              <select name="handbookModel" defaultValue={settings.handbookModel} className={field}>
                {SUMMARY_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                name="handbookThinking"
                defaultChecked={settings.handbookThinking}
                className="h-4 w-4 accent-brand-600"
              />
              Extended thinking
            </label>
          </div>
          <p className="mt-2 text-xs text-stone-400">
            Thinking is off by default — the task is restating supplied facts, not reasoning about
            them, so it mostly buys latency.
          </p>

          <label className="mt-5 flex flex-col gap-1 text-sm">
            House style
            <textarea
              name="handbookStyleGuide"
              rows={10}
              defaultValue={settings.handbookStyleGuide ?? ""}
              placeholder={DEFAULT_SUMMARY_STYLE}
              className={`${field} font-mono text-xs`}
            />
          </label>
          <p className="mt-2 text-xs text-stone-400">
            Leave blank to use the bundled default shown above — it bans greetings, praise,
            exclamation marks and invented facts. It ships as a source file, so a self-hosted
            install always has one.
          </p>
        </section>

        <div>
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Save
          </button>
        </div>
      </form>
    </main>
  );
}
