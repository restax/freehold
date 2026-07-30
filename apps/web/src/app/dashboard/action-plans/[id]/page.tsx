import { redirect } from "next/navigation";

/** Task template detail moved into the Templates hub. */
export default async function ActionPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/templates?tab=tasks&planId=${id}`);
}
