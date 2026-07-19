import { HouseLine, UserSquare } from "@phosphor-icons/react/dist/ssr";
import { setItemVisibility } from "@/lib/actions/portal";

/**
 * The two per-audience portal switches shown beside every task and document:
 * person-in-a-square = the managed agent portal, person-in-a-house = the
 * buyer/seller portal. Filled green = visible, hollow grey = hidden.
 */
export function VisibilityToggles({
  kind,
  id,
  transactionId,
  visibleToAgent,
  visibleToClient,
}: {
  kind: "task" | "document";
  id: string;
  transactionId: string;
  visibleToAgent: boolean;
  visibleToClient: boolean;
}) {
  const toggle = (
    audience: "agent" | "client",
    on: boolean,
    title: string,
    Icon: typeof HouseLine,
  ) => (
    <form action={setItemVisibility}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="transactionId" value={transactionId} />
      <input type="hidden" name="audience" value={audience} />
      <input type="hidden" name="value" value={on ? "0" : "1"} />
      <button
        type="submit"
        title={title}
        className={`transition-colors ${on ? "text-brand-600 hover:text-stone-400" : "text-stone-300 hover:text-brand-600"}`}
      >
        <Icon size={16} weight={on ? "fill" : "regular"} aria-hidden />
        <span className="sr-only">{title}</span>
      </button>
    </form>
  );

  return (
    <span className="flex shrink-0 items-center gap-1">
      {toggle(
        "agent",
        visibleToAgent,
        visibleToAgent
          ? "Visible in the agent portal — click to hide"
          : "Hidden from the agent portal — click to show",
        UserSquare,
      )}
      {toggle(
        "client",
        visibleToClient,
        visibleToClient
          ? "Visible in the buyer/seller portal — click to hide"
          : "Hidden from the buyer/seller portal — click to show",
        HouseLine,
      )}
    </span>
  );
}
