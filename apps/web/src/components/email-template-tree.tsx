import { Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { createTemplateGroup, deleteTemplateGroup } from "@/lib/actions/template-groups";
import { btnGhost, input } from "@/lib/ui";

export interface TreeTemplate {
  id: string;
  name: string;
  groupId: string | null;
}

export interface TreeGroup {
  id: string;
  name: string;
}

const NO_FOLDER = "none";

function hrefFor(templateId: string) {
  return `/dashboard/templates?tab=emails&templateId=${templateId}`;
}

function hrefForNew(folderId: string) {
  return `/dashboard/templates?tab=emails&templateId=new&folder=${folderId}`;
}

/**
 * The left pane for the email templates editor: every template listed under
 * its folder, not a filter that hides everything else — clicking a name
 * opens it in the compose pane on the right via `?templateId=`. Replaces the
 * old "pick a group to filter the flat list" rail plus per-row accordion.
 */
export function EmailTemplateTree({
  templates,
  groups,
  selectedId,
  selectedGroupId,
}: {
  templates: TreeTemplate[];
  groups: TreeGroup[];
  /** The open template's id, or "new" while composing an unsaved one. */
  selectedId?: string;
  /** Which folder to default-open — the selected template's, or a "new in this folder" target. */
  selectedGroupId?: string | null;
}) {
  const byGroup = (groupId: string | null) => templates.filter((t) => t.groupId === groupId);
  const unfiled = byGroup(null);

  const folderRow = (folderId: string, name: string, items: TreeTemplate[]) => {
    const isOpenByDefault = items.some((t) => t.id === selectedId) || selectedGroupId === folderId;
    return (
      <details key={folderId} className="group" open={isOpenByDefault || items.length === 0}>
        <summary className="flex cursor-pointer select-none items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide text-stone-400 hover:text-stone-600">
          <span className="inline-block transition-transform group-open:rotate-90">▸</span>
          <span className="truncate">{name}</span>
          <span className="ml-auto font-normal normal-case text-stone-300">{items.length}</span>
        </summary>
        <div className="ml-2.5 mt-0.5 flex flex-col gap-0.5 border-l border-stone-100 pl-2.5">
          {items.map((t) => (
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
          Email templates
        </span>
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-md px-1.5 py-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
            <Plus size={14} weight="bold" />
          </summary>
          <form
            action={createTemplateGroup}
            className="absolute right-0 z-10 mt-1 flex w-48 flex-col gap-2 rounded-lg border border-stone-200 bg-white p-2 shadow-md"
          >
            <input type="hidden" name="kind" value="EMAIL" />
            <input name="name" required placeholder="Folder name" className={input} />
            <button type="submit" className={btnGhost}>
              Add folder
            </button>
          </form>
        </details>
      </div>

      <Link
        href="/dashboard/templates?tab=emails&templateId=new"
        className={`flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium transition-colors ${
          selectedId === "new" && !selectedGroupId
            ? "border-brand-600 bg-brand-50 text-brand-800"
            : "border-stone-300 text-stone-600 hover:border-brand-600 hover:text-brand-700"
        }`}
      >
        <Plus size={14} weight="bold" /> New template
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
