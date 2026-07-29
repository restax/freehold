import Link from "next/link";
import { CloudWordmark } from "@/components/marketing";
import { SectionCard } from "@/components/section-card";
import changelog from "@/content/changelog.json";

/**
 * System Updates panel (server component). When FREEHOLD_HUB_URL is set,
 * pulls the central feed (release notes, Cloud announcements) — cached an
 * hour and fail-silent, so a down or absent Hub never affects the dashboard.
 * Falls back to changelog.json otherwise, which scripts/generate-changelog.mjs
 * regenerates from `Changelog:` commit trailers on every build — see that
 * script for why this is git-driven rather than a hand-maintained array.
 */

interface NewsItem {
  date: string;
  text: string;
}

const FALLBACK = changelog as NewsItem[];

async function fetchHubFeed(): Promise<NewsItem[] | null> {
  const hub = process.env.FREEHOLD_HUB_URL;
  if (!hub) return null;
  try {
    const res = await fetch(`${hub.replace(/\/$/, "")}/feed.json`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { items?: NewsItem[] };
    return Array.isArray(json.items) && json.items.length > 0 ? json.items.slice(0, 6) : null;
  } catch {
    return null;
  }
}

function fmtNewsDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export async function HubNews() {
  const items = (await fetchHubFeed()) ?? FALLBACK;
  return (
    <div className="max-w-2xl">
      <SectionCard
        title="System updates"
        action={
          <span className="flex items-center gap-1.5 text-xs text-stone-400">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            Updates automatically
          </span>
        }
        bodyClassName=""
      >
        <ul className="divide-y divide-stone-100 px-4">
          {items.map((item, i) => (
            <li key={item.text} className="flex items-baseline gap-2 py-2 text-sm">
              <span className="w-12 shrink-0 text-xs font-medium tabular-nums text-stone-400">
                {fmtNewsDate(item.date)}
              </span>
              <span className="text-stone-700">{item.text}</span>
              {i === 0 && (
                <span className="shrink-0 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                  New
                </span>
              )}
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-center gap-1.5 border-t border-stone-100 px-4 py-2.5">
          <span className="text-xs text-stone-400">Powered by</span>
          <CloudWordmark size="sm" />
        </div>
      </SectionCard>
      <p className="mt-2 text-center text-xs text-stone-400">
        Love Freehold?{" "}
        <Link
          href="/recommend"
          className="font-medium text-stone-500 underline decoration-stone-300 underline-offset-2 hover:text-brand-700"
        >
          Recommend us
        </Link>
      </p>
    </div>
  );
}
