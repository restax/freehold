import { redirect } from "next/navigation";

/** Doc template detail moved into the Templates hub. */
export default async function TemplateEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/templates?tab=docs&docId=${id}`);
}
