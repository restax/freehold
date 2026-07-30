import Link from "next/link";

export type TemplateTab = "tasks" | "emails" | "attachments" | "dates" | "docs";

const TABS: Array<{ key: TemplateTab; label: string }> = [
  { key: "tasks", label: "Tasks" },
  { key: "emails", label: "Emails" },
  { key: "attachments", label: "Attachments" },
  { key: "dates", label: "Key dates" },
  { key: "docs", label: "Doc templates" },
];

/** The five-tab nav at the top of the Templates hub. Plain links (?tab=) so
 *  each tab is a normal, bookmarkable, server-rendered page. */
export function TemplateHubTabs({ active }: { active: TemplateTab }) {
  return (
    <div className="flex gap-5 border-b border-stone-200">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={`/dashboard/templates?tab=${t.key}`}
          className={`-mb-px border-b-2 pb-2 text-sm font-medium transition-colors ${
            active === t.key
              ? "border-brand-600 text-stone-900"
              : "border-transparent text-stone-500 hover:text-stone-700"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
