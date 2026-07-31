import { DEFAULT_SIDE_LABELS, type SideLabels, sideLabel } from "@/lib/side-labels";
import { THEMES } from "@/lib/theme";

/**
 * Which side of the deal a file is worked from, as a single letter in a
 * circle: B, S, or D.
 *
 * A TC's whole job is shaped by this — whose agent they answer to, whose
 * paperwork is theirs to chase — so it travels with the property address
 * everywhere a transaction is listed, not just on the transaction's own
 * settings form.
 *
 * The letter comes from the enum, not the tenant's wording: a workspace that
 * renames "Sell side" to "List side" still gets S, because the letter has to
 * stay stable to be recognisable at a glance. The tenant's wording is the
 * tooltip.
 */

/**
 * The three colours come from the accent presets in lib/theme, not from
 * Tailwind's stock palette: a saturated blue/orange/violet trio sat on these
 * earthy surfaces looking like a different product bolted on — the same
 * mistake the greens were retuned to fix.
 *
 * Buy is the cool one and sell the warm one so they read as opposites at a
 * glance; dual takes the muted purple that sits between them. All three
 * clear 4.5:1 against the white letter.
 */
const SIDE_STYLE: Record<string, { letter: string; color: string }> = {
  BUY_SIDE: { letter: "B", color: THEMES.cobalt.accent },
  SELL_SIDE: { letter: "S", color: THEMES.clay.accent },
  DUAL: { letter: "D", color: THEMES.lilac.accent },
};

export function SideBadge({
  side,
  labels = DEFAULT_SIDE_LABELS,
  size = "sm",
}: {
  side: string;
  labels?: SideLabels;
  size?: "sm" | "md";
}) {
  const style = SIDE_STYLE[side];
  if (!style) return null;
  const dim = size === "md" ? "h-6 w-6 text-[0.7rem]" : "h-[1.15rem] w-[1.15rem] text-[0.6rem]";
  return (
    <span
      role="img"
      title={sideLabel(side, labels)}
      aria-label={sideLabel(side, labels)}
      style={{ backgroundColor: style.color }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold leading-none text-white ${dim}`}
    >
      {style.letter}
    </span>
  );
}
