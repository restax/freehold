import { prisma } from "@freehold/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { updateStateReference } from "@/lib/actions/state-reference";
import { isOperator } from "@/lib/operator";
import { btn, input, label as labelCls } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function AdminStateDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  if (!(await isOperator())) notFound();
  const { code } = await params;
  const state = await prisma.stateReference.findUnique({
    where: { code: code.toUpperCase() },
  });
  if (!state) notFound();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-10 sm:px-6">
      <Breadcrumbs
        items={[{ label: "State reference", href: "/admin/states" }, { label: state.name }]}
      />
      <h1 className="text-xl font-semibold">
        {state.name} <span className="text-base font-normal text-stone-400">{state.code}</span>
      </h1>

      <form action={updateStateReference} className="flex flex-col gap-4">
        <input type="hidden" name="code" value={state.code} />
        <label className={labelCls}>
          State name
          <input name="name" required defaultValue={state.name} className={input} />
        </label>
        <label className={labelCls}>
          Closing model
          <select name="closingModel" defaultValue={state.closingModel} className={input}>
            <option value="TITLE_ESCROW">Title / escrow</option>
            <option value="ATTORNEY">Attorney</option>
            <option value="PARTIAL_ATTORNEY">Partial attorney</option>
          </select>
        </label>
        <label className={labelCls}>
          Closing model detail
          <textarea
            name="closingModelDetail"
            rows={2}
            defaultValue={state.closingModelDetail}
            className={`${input} resize-y`}
          />
        </label>
        <label className={labelCls}>
          Dominant MLS
          <textarea
            name="dominantMls"
            rows={2}
            defaultValue={state.dominantMls}
            className={`${input} resize-y`}
          />
        </label>
        <label className={labelCls}>
          TC license requirement
          <textarea
            name="licenseSummary"
            rows={3}
            defaultValue={state.licenseSummary}
            className={`${input} resize-y`}
          />
        </label>
        <label className={labelCls}>
          Jargon / lingo
          <textarea
            name="jargon"
            rows={3}
            defaultValue={state.jargon}
            className={`${input} resize-y`}
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-stone-700">
          <input
            type="checkbox"
            name="verified"
            defaultChecked={state.verified}
            className="accent-brand-600"
          />
          Confirmed accurate
        </label>
        <div className="flex items-center gap-3 border-t border-stone-100 pt-3">
          <button type="submit" className={btn}>
            Save
          </button>
          <Link href="/admin/states" className="text-sm text-stone-400 hover:text-stone-600">
            Back to list
          </Link>
        </div>
      </form>
    </main>
  );
}
