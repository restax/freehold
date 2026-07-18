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
    title: "AI contract extraction is live",
    body: "Upload a purchase contract on any transaction — every date and figure comes back page-cited for your review.",
  },
  {
    title: "Client portals & credential vault",
    body: "Share read-only closing trackers with buyers and sellers, and keep client logins encrypted with audited reveals.",
  },
  {
    title: "E-signatures via Documenso",
    body: "Send generated documents for signature without leaving Freehold; DocuSign support lands with provider credentials.",
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

export async function HubNews() {
  const items = (await fetchHubFeed()) ?? FALLBACK;
  return (
    <section className="rounded-xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_2px_rgb(41_37_36/0.04),0_2px_8px_rgb(41_37_36/0.04)]">
      <h2 className="mb-3 font-medium">What's new in Freehold</h2>
      <ul className="flex flex-col divide-y divide-stone-100">
        {items.map((item) => (
          <li key={item.title} className="py-2 text-sm first:pt-0 last:pb-0">
            <span className="font-medium">{item.title}</span>
            {item.date && (
              <span className="ml-2 text-xs tabular-nums text-stone-400">{item.date}</span>
            )}
            <p className="max-w-prose leading-relaxed text-stone-500">{item.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
