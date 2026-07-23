import Link from "next/link";
import { redirect } from "next/navigation";
import { saveAppearance } from "@/lib/actions/appearance";
import {
  FONTS,
  type FontKey,
  HIGHLIGHT_SWATCHES,
  PRIORITY_SWATCHES,
  priorityVars,
  THEMES,
  type ThemeKey,
  tenantAppearance,
} from "@/lib/appearance";
import { requireAdminTenant } from "@/lib/tenant";
import { btn, card, label } from "@/lib/ui";

export const dynamic = "force-dynamic";

const HIGHLIGHT_SCOPES: { value: string; label: string }[] = [
  { value: "none", label: "Off — no row tint" },
  { value: "critical", label: "Critical rows only" },
  { value: "high", label: "High & Critical rows" },
];

function ColorSwatch({
  name,
  value,
  checked,
  soft = false,
}: {
  name: string;
  value: string;
  checked: boolean;
  soft?: boolean;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={checked}
        className="peer sr-only"
      />
      <span
        className={`block rounded-full ring-2 ring-transparent ring-offset-2 transition peer-checked:ring-stone-900 peer-focus-visible:ring-stone-400 ${
          soft ? "h-8 w-8 border border-stone-200" : "h-7 w-7"
        }`}
        style={{ background: value }}
      />
    </label>
  );
}

export default async function AppearancePage() {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) redirect("/dashboard/settings");
  const a = await tenantAppearance(tenantId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/dashboard/settings" className="text-sm text-stone-500 hover:underline">
          ← Settings
        </Link>
        <h1 className="text-xl font-semibold">Appearance</h1>
        <p className="text-sm text-stone-500">
          Brand the client portal and colour-code your task lists. Changes apply everywhere this
          workspace is shown.
        </p>
      </div>

      <form action={saveAppearance} className="flex flex-col gap-6">
        {/* ---------------- Portal theme ---------------- */}
        <section className={card}>
          <h2 className="mb-1 font-medium">Portal theme</h2>
          <p className="mb-4 text-sm text-stone-500">
            The accent colour clients see on their portal — header, buttons, and links.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(Object.keys(THEMES) as ThemeKey[]).map((key) => {
              const t = THEMES[key];
              return (
                <label key={key} className="cursor-pointer">
                  <input
                    type="radio"
                    name="theme"
                    value={key}
                    defaultChecked={a.theme === key}
                    className="peer sr-only"
                  />
                  <span className="block overflow-hidden rounded-xl border border-stone-200 ring-2 ring-transparent transition peer-checked:border-transparent peer-checked:ring-stone-900 peer-focus-visible:ring-stone-400">
                    <span
                      className="block h-14"
                      style={{
                        background: `radial-gradient(120% 140% at 50% 0%, ${t.accent} 0%, ${t.dark} 100%)`,
                      }}
                    />
                    <span className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm font-medium text-stone-700">{t.label}</span>
                      <span
                        className="h-3.5 w-3.5 rounded-full"
                        style={{ background: t.accent }}
                        aria-hidden
                      />
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        {/* ---------------- Portal font ---------------- */}
        <section className={card}>
          <h2 className="mb-1 font-medium">Portal font</h2>
          <p className="mb-4 text-sm text-stone-500">
            The typeface for portal headings and text. All three are bundled — no load-time cost.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(FONTS) as FontKey[]).map((key) => (
              <label key={key} className="cursor-pointer">
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
        </section>

        {/* ---------------- Task priority colours ---------------- */}
        <section className={card} style={priorityVars(a)}>
          <h2 className="mb-1 font-medium">Task priority colours</h2>
          <p className="mb-4 text-sm text-stone-500">
            How High and Critical tasks are flagged across your dashboard and transaction lists.
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
                    checked={a.priorityColors.CRITICAL.toLowerCase() === s.value.toLowerCase()}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- Row highlight ---------------- */}
        <section className={card}>
          <h2 className="mb-1 font-medium">Row highlight</h2>
          <p className="mb-4 text-sm text-stone-500">
            Tint whole task rows so the urgent ones jump out. Choose which priorities get the tint
            and its colour.
          </p>
          <div className="flex flex-wrap items-end gap-6">
            <label className={label}>
              Highlight
              <select
                name="highlightScope"
                defaultValue={a.rowHighlight.scope}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm shadow-xs focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/15"
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
                    checked={a.rowHighlight.color.toLowerCase() === s.value.toLowerCase()}
                    soft
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <div>
          <button type="submit" className={btn}>
            Save appearance
          </button>
        </div>
      </form>
    </div>
  );
}
