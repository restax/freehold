import Link from "next/link";
import type { TemplateTab } from "@/components/template-hub-tabs";
import { createTemplateGroup, deleteTemplateGroup } from "@/lib/actions/template-groups";
import { btnGhost, input } from "@/lib/ui";

export interface RailGroup {
  id: string;
  name: string;
  count: number;
}

/**
 * Left rail shared by every hub tab: "All Templates", "No Group", then the
 * tenant's named groups, each with a live count. Selecting one filters the
 * list on the right via `?group=`; omitted or "all" shows everything.
 */
export function TemplateGroupRail({
  kind,
  tab,
  groups,
  noGroupCount,
  totalCount,
  activeGroupId,
}: {
  kind: string;
  tab: TemplateTab;
  groups: RailGroup[];
  noGroupCount: number;
  totalCount: number;
  activeGroupId?: string;
}) {
  const href = (group?: string) =>
    `/dashboard/templates?tab=${tab}${group ? `&group=${group}` : ""}`;
  const rowClass = (isActive: boolean) =>
    `flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
      isActive ? "bg-stone-100 font-medium text-stone-900" : "text-stone-600 hover:bg-stone-50"
    }`;

  return (
    <div className="flex w-56 shrink-0 flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">Groups</span>
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-md px-1.5 py-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
            +
          </summary>
          <form
            action={createTemplateGroup}
            className="absolute right-0 z-10 mt-1 flex w-48 flex-col gap-2 rounded-lg border border-stone-200 bg-white p-2 shadow-md"
          >
            <input type="hidden" name="kind" value={kind} />
            <input name="name" required placeholder="Group name" className={input} />
            <button type="submit" className={btnGhost}>
              Add group
            </button>
          </form>
        </details>
      </div>

      <nav className="flex flex-col gap-0.5">
        <Link href={href()} className={rowClass(!activeGroupId)}>
          All Templates
          <span className="text-xs text-stone-400">{totalCount}</span>
        </Link>
        <Link href={href("none")} className={rowClass(activeGroupId === "none")}>
          No Group
          <span className="text-xs text-stone-400">{noGroupCount}</span>
        </Link>
        {groups.map((g) => (
          <div key={g.id} className="group flex items-center">
            <Link href={href(g.id)} className={`flex-1 ${rowClass(activeGroupId === g.id)}`}>
              <span className="truncate">{g.name}</span>
              <span className="text-xs text-stone-400">{g.count}</span>
            </Link>
            <form action={deleteTemplateGroup}>
              <input type="hidden" name="id" value={g.id} />
              <button
                type="submit"
                aria-label={`Delete ${g.name}`}
                className="ml-0.5 shrink-0 rounded px-1 text-xs text-stone-300 opacity-0 transition hover:text-red-600 group-hover:opacity-100"
              >
                ✕
              </button>
            </form>
          </div>
        ))}
      </nav>
    </div>
  );
}
