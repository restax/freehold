import { dependencyTree } from "@freehold/workflows";
import { dateRuleText } from "@/lib/task-template-labels";

/**
 * The plan drawn as chains: each task nested under the one it waits on.
 *
 * A flat list can't show a chain — reading "waits on X" four rows apart and
 * assembling the order in your head is exactly the work this view exists to
 * remove. Tasks dated from a transaction date are roots; a task whose
 * dependency was deleted, or which is stuck in a loop, also surfaces as a
 * root rather than disappearing (see `dependencyTree`).
 */

export interface DependencyTreeEntry {
  id: string;
  title: string;
  anchor: string;
  offsetDays: number;
  dependsOnId: string | null;
  sortOrder: number;
}

export function ActionPlanDependencyTree({ tasks }: { tasks: DependencyTreeEntry[] }) {
  const chained = tasks.filter((t) => t.dependsOnId);
  if (chained.length === 0) {
    return (
      <p className="text-sm text-stone-400">
        No task in this template waits on another one yet. Set a task's “Dated from” to “After
        another task” to start a chain.
      </p>
    );
  }
  const titleById = new Map(tasks.map((t) => [t.id, t.title]));
  // Roots with no chain under them are noise here — the point of this view is
  // the chains, and the row list above already shows everything.
  const forest = dependencyTree(tasks).filter((n) => n.children.length > 0);

  return <Branches nodes={forest} titleById={titleById} depth={0} />;
}

interface Node {
  entry: DependencyTreeEntry;
  children: Node[];
}

function Branches({
  nodes,
  titleById,
  depth,
}: {
  nodes: Node[];
  titleById: Map<string, string>;
  depth: number;
}) {
  return (
    <ul
      className={`flex flex-col gap-1.5 ${depth > 0 ? "mt-1.5 border-l border-stone-200 pl-4" : ""}`}
    >
      {nodes.map((n) => (
        <li key={n.entry.id}>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm text-stone-800">{n.entry.title}</span>
            <span className="text-xs text-stone-500">
              {dateRuleText(
                n.entry.anchor,
                n.entry.offsetDays,
                n.entry.dependsOnId ? (titleById.get(n.entry.dependsOnId) ?? null) : null,
              )}
            </span>
          </div>
          {n.children.length > 0 && (
            <Branches nodes={n.children} titleById={titleById} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}
