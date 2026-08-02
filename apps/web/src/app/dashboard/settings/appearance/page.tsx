import { Flag, PaintBrushBroad, Rows, TextAa } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SaveButton } from "@/components/save-button";
import { SectionCard } from "@/components/section-card";
import { ThemeChoice } from "@/components/theme-choice";
import { saveAppearance } from "@/lib/actions/appearance";
import {
  FONTS,
  type FontKey,
  HIGHLIGHT_SWATCHES,
  PRIORITY_SWATCHES,
  priorityVars,
  tenantAppearance,
} from "@/lib/appearance";
import { requireAdminTenant } from "@/lib/tenant";
import { btn, input, label } from "@/lib/ui";

export const dynamic = "force-dynamic";

const HIGHLIGHT_SCOPES: { value: string; label: string }[] = [
  { value: "none", label: "Off — no row tint" },
  { value: "critical", label: "Critical rows only" },
  { value: "high", label: "High & Critical rows" },
];

function ColorSwatch({
  name,
  value,
  swatchLabel,
  checked,
  soft = false,
}: {
  name: string;
  value: string;
  /** Named so the swatch isn't a colour-only control — it carries a tooltip
   *  and a screen-reader label, not just a hue. */
  swatchLabel: string;
  checked: boolean;
  soft?: boolean;
}) {
  return (
    <label className="cursor-pointer" title={swatchLabel}>
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={checked}
        className="peer sr-only"
      />
      <span className="sr-only">{swatchLabel}</span>
      <span
        className={`block rounded-full ring-2 ring-transparent ring-offset-2 transition peer-checked:ring-stone-900 peer-focus-visible:ring-stone-400 ${
          soft ? "h-8 w-8 border border-stone-200" : "h-7 w-7"
        }`}
        style={{ background: value }}
        aria-hidden
      />
    </label>
  );
}

export default async function AppearancePage() {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) redirect("/dashboard/settings");
  const a = await tenantAppearance(tenantId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/dashboard/settings" className="text-sm text-stone-500 hover:underline">
          ← Settings
        </Link>
        <h1 className="text-xl font-semibold">Appearance</h1>
        <p className="text-sm text-stone-500">
          Brand your dashboard and the client portal, and colour-code your task lists. Changes apply
          everywhere this workspace is shown.
        </p>
      </div>

      <form action={saveAppearance} className="flex flex-col gap-4">
        <SectionCard
          title="Colour theme"
          icon={<PaintBrushBroad size={15} weight="fill" aria-hidden />}
        >
          <p className="mb-3 text-sm text-stone-500">
            One accent colour drives the whole workspace: section titles, the top bar, buttons,
            links, and address pills, on your dashboard and in the client portal. Each option below
            previews a card the way it will actually look.
          </p>
          {/* Keyed on the saved values so the picker resets to them after a
              save. Without it the client state survives the server
              re-render, leaving the tick on the previously-selected theme
              while the page around it had already repainted to the new one. */}
          <ThemeChoice
            key={`${a.theme}:${a.customAccent}`}
            value={a.theme}
            customAccent={a.customAccent}
          />
          <p className="mt-3 text-xs text-stone-400">
            Any colour works — text and fills are darkened automatically where they would otherwise
            be too pale to read.
          </p>
        </SectionCard>

        <SectionCard title="Portal font" icon={<TextAa size={15} weight="fill" aria-hidden />}>
          <p className="mb-3 text-sm text-stone-500">
            The typeface for headings and text in the client portal. All three are bundled — no
            load-time cost.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(FONTS) as FontKey[]).map((key) => (
              <label key={key} className="cursor-pointer" title={FONTS[key].label}>
                <input
                  type="radio"
                  name="portalFont"
                  value={key}
                  defaultChecked={a.portalFont === key}
                  className="peer sr-only"
                />
                <span className="block rounded-xl border border-stone-200 px-4 py-3 ring-2 ring-transparent transition peer-checked:border-transparent peer-checked:ring-stone-900 peer-focus-visible:ring-stone-400">
                  <span
                    className="block text-lg text-stone-900"
                    style={{ fontFamily: FONTS[key].stack }}
                  >
                    Aa
                  </span>
                  <span className="mt-0.5 block text-xs text-stone-500">{FONTS[key].label}</span>
                </span>
              </label>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Task priority colours"
          icon={<Flag size={15} weight="fill" aria-hidden />}
        >
          <div style={priorityVars(a)}>
            <p className="mb-3 text-sm text-stone-500">
              How High and Critical tasks are flagged across your dashboard and transaction lists.
              These stay independent of the colour theme — urgency should not change meaning when
              you rebrand.
            </p>

            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex w-28 items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{
                      color: "var(--priority-high)",
                      background: "color-mix(in srgb, var(--priority-high) 14%, white)",
                    }}
                  >
                    High
                  </span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {PRIORITY_SWATCHES.map((s) => (
                    <ColorSwatch
                      key={s.value}
                      name="priorityHigh"
                      value={s.value}
                      swatchLabel={`High priority: ${s.label}`}
                      checked={a.priorityColors.HIGH.toLowerCase() === s.value.toLowerCase()}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex w-28 items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{
                      color: "var(--priority-critical)",
                      background: "color-mix(in srgb, var(--priority-critical) 14%, white)",
                    }}
                  >
                    Critical
                  </span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {PRIORITY_SWATCHES.map((s) => (
                    <ColorSwatch
                      key={s.value}
                      name="priorityCritical"
                      value={s.value}
                      swatchLabel={`Critical priority: ${s.label}`}
                      checked={a.priorityColors.CRITICAL.toLowerCase() === s.value.toLowerCase()}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Row highlight" icon={<Rows size={15} weight="fill" aria-hidden />}>
          <p className="mb-3 text-sm text-stone-500">
            Tint whole task rows so the urgent ones stand out at a glance. Choose which priorities
            get the tint and what colour it is.
          </p>
          <div className="flex flex-wrap items-end gap-6">
            <label className={label}>
              Highlight
              <select
                name="highlightScope"
                defaultValue={a.rowHighlight.scope}
                title="Which task rows get a background tint"
                className={input}
              >
                {HIGHLIGHT_SCOPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <span className="mb-1 block text-sm font-medium text-stone-700">Tint colour</span>
              <div className="flex flex-wrap gap-2.5">
                {HIGHLIGHT_SWATCHES.map((s) => (
                  <ColorSwatch
                    key={s.value}
                    name="highlightColor"
                    value={s.value}
                    swatchLabel={`Row tint: ${s.label}`}
                    checked={a.rowHighlight.color.toLowerCase() === s.value.toLowerCase()}
                    soft
                  />
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        <div>
          <SaveButton className={btn} label="Save appearance" />
        </div>
      </form>
    </div>
  );
}
