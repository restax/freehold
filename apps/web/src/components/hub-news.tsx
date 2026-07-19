import Link from "next/link";
import { CloudWordmark } from "@/components/marketing";

/**
 * Hub news panel (server component). When FREEHOLD_HUB_URL is set, pulls the
 * central feed (release notes, Cloud announcements) — cached an hour and
 * fail-silent, so a down or absent Hub never affects the dashboard. Falls
 * back to built-in release notes otherwise.
 */

interface NewsItem {
  title: string;
  body: string;
  date?: string;
}

const FALLBACK: NewsItem[] = [
  {
    title: "Ask Claude about your deals",
    body: "A ready-made Claude skill queries your workspace through the API — closings this week, client portal activity, workspace stats. Grab it from the repo's skills/ folder.",
    date: "2026-07-19",
  },
  {
    title: "Portals, calendars, and a real CRM",
    body: "Agent portals with pipeline stats, buyer/seller timelines, subscribe-once calendar feeds, per-item visibility, and dual-person contact records with auto-prospecting.",
    date: "2026-07-19",
  },
  {
    title: "Your day, redesigned",
    body: "The dashboard now leads with today: closings, overdue items, and a 7-day agenda. Completed tasks stay visible and undoable.",
    date: "2026-07-19",
  },
  {
    title: "Branded client portal subdomains",
    body: "Every workspace now has its own address — yourname.freeholdtc.dev — and portal links carry your brand.",
    date: "2026-07-19",
  },
  {
    title: "AI contract extraction is live",
    body: "Upload a purchase contract on any transaction — every date and figure comes back page-cited for your review.",
    date: "2026-07-18",
  },
  {
    title: "Client portals & credential vault",
    body: "Share read-only closing trackers with buyers and sellers, and keep client logins encrypted with audited reveals.",
    date: "2026-07-18",
  },
];

async function fetchHubFeed(): Promise<NewsItem[] | null> {
  const hub = process.env.FREEHOLD_HUB_URL;
  if (!hub) return null;
  try {
    const res = await fetch(`${hub.replace(/\/$/, "")}/feed.json`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { items?: NewsItem[] };
    return Array.isArray(json.items) && json.items.length > 0 ? json.items.slice(0, 5) : null;
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
    <div>
      <section className="rounded-xl border border-stone-200/70 bg-white shadow-[0_1px_2px_rgb(41_37_36/0.04),0_2px_8px_rgb(41_37_36/0.04)]">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
          <h2 className="font-medium">What's new</h2>
          <span className="flex items-center gap-1.5 text-xs text-stone-400">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            Updates automatically
          </span>
        </div>
        <ul className="flex flex-col divide-y divide-stone-100 px-5 py-1">
          {items.map((item, i) => (
            <li key={item.title} className="py-3 text-sm">
              <div className="flex items-baseline gap-2">
                {item.date && (
                  <span className="w-12 shrink-0 text-xs font-medium tabular-nums text-stone-400">
                    {fmtNewsDate(item.date)}
                  </span>
                )}
                <span className="font-medium">{item.title}</span>
                {i === 0 && (
                  <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                    New
                  </span>
                )}
              </div>
              <p
                className={`max-w-prose leading-relaxed text-stone-500 ${item.date ? "pl-14" : ""}`}
              >
                {item.body}
              </p>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-stone-100 px-5 py-3">
          <span className="text-xs text-stone-400">Powered by</span>
          <CloudWordmark size="sm" />
        </div>
      </section>
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
