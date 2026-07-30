import { Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { createTemplateGroup, deleteTemplateGroup } from "@/lib/actions/template-groups";
import { input } from "@/lib/ui";

export interface TreeItem {
  id: string;
  name: string;
  groupId: string | null;
}

export interface TreeGroup {
  id: string;
  name: string;
}

const NO_FOLDER = "none";

/**
 * The left pane shared by every Templates-hub tab: every item listed under
 * its folder — not a filter that hides the rest — so clicking a name opens
 * it in the detail pane via `?<idParam>=`. One component so a folder, a
 * "+ New" affordance, and a selected row look and behave identically whether
 * you're looking at emails, task plans, doc templates, attachment
 * checklists, or key-date sets.
 */
export function TemplateTree({
  kind,
  tab,
  idParam,
  label,
  newLabel = "New template",
  items,
  groups,
  selectedId,
  selectedGroupId,
}: {
  /** TemplateGroup.kind this tree's folders belong to. */
  kind: "EMAIL" | "TASK" | "DOC" | "ATTACHMENT" | "DATE";
  /** The hub tab query value, e.g. "emails". */
  tab: string;
  /** The query-string key selection is carried in, e.g. "templateId". */
  idParam: string;
  label: string;
  newLabel?: string;
  items: TreeItem[];
  groups: TreeGroup[];
  /** The open item's id, or "new" while composing an unsaved one. */
  selectedId?: string;
  /** Which folder to default-open — the selected item's, or a "new in this folder" target. */
  selectedGroupId?: string | null;
}) {
  const base = `/dashboard/templates?tab=${tab}`;
  const hrefFor = (id: string) => `${base}&${idParam}=${id}`;
  const hrefForNew = (folderId: string) => `${base}&${idParam}=new&folder=${folderId}`;

  const byGroup = (groupId: string | null) => items.filter((t) => t.groupId === groupId);
  const unfiled = byGroup(null);

  const folderRow = (folderId: string, name: string, rows: TreeItem[]) => {
    const isOpenByDefault = rows.some((t) => t.id === selectedId) || selectedGroupId === folderId;
    return (
      <details key={folderId} className="group" open={isOpenByDefault || rows.length === 0}>
        <summary className="flex cursor-pointer select-none items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide text-stone-400 hover:text-stone-600">
          <span className="inline-block transition-transform group-open:rotate-90">▸</span>
          <span className="truncate">{name}</span>
          <span className="ml-auto font-normal normal-case text-stone-300">{rows.length}</span>
        </summary>
        <div className="ml-2.5 mt-0.5 flex flex-col gap-0.5 border-l border-stone-100 pl-2.5">
          {rows.map((t) => (
            <Link
              key={t.id}
              href={hrefFor(t.id)}
              className={`truncate rounded-md px-2 py-1 text-sm transition-colors ${
                t.id === selectedId
                  ? "bg-brand-50 font-medium text-brand-800"
                  : "text-stone-600 hover:bg-stone-50"
              }`}
            >
              {t.name.replace(" (Sample)", "")}
            </Link>
          ))}
          <Link
            href={hrefForNew(folderId)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-stone-400 hover:text-brand-700"
          >
            <Plus size={11} weight="bold" /> New in this folder
          </Link>
        </div>
      </details>
    );
  };

  return (
    <div className="flex w-64 shrink-0 flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          {label}
        </span>
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-md px-1.5 py-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
            <Plus size={14} weight="bold" />
          </summary>
          <form
            action={createTemplateGroup}
            className="absolute right-0 z-10 mt-1 flex w-48 flex-col gap-2 rounded-lg border border-stone-200 bg-white p-2 shadow-md"
          >
            <input type="hidden" name="kind" value={kind} />
            <input name="name" required placeholder="Folder name" className={input} />
            <button
              type="submit"
              className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-sm text-stone-700 shadow-xs transition hover:border-stone-400 hover:bg-stone-50"
            >
              Add folder
            </button>
          </form>
        </details>
      </div>

      {/* Styled to match the global "+ Create" button in the top bar — the
          same affordance for starting something new, wherever it appears. */}
      <Link
        href={`${base}&${idParam}=new`}
        className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition ${
          selectedId === "new" && !selectedGroupId
            ? "bg-brand-500"
            : "bg-brand-600 hover:bg-brand-500"
        }`}
      >
        <Plus size={14} weight="bold" /> {newLabel}
      </Link>

      <nav className="flex max-h-[65vh] flex-col gap-1 overflow-y-auto">
        {groups.map((g) => folderRow(g.id, g.name, byGroup(g.id)))}
        {folderRow(NO_FOLDER, "No folder", unfiled)}
      </nav>

      {groups.length > 0 && (
        <details className="text-xs text-stone-400">
          <summary className="cursor-pointer select-none hover:text-stone-600">
            Manage folders
          </summary>
          <ul className="mt-1 flex flex-col gap-0.5">
            {groups.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2 px-1">
                <span className="truncate">{g.name}</span>
                <form action={deleteTemplateGroup}>
                  <input type="hidden" name="id" value={g.id} />
                  <button type="submit" className="text-stone-300 hover:text-red-600">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
