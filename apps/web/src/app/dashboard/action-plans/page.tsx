import { redirect } from "next/navigation";

/** Task templates moved into the Templates hub. */
export default function ActionPlansPage() {
  redirect("/dashboard/templates?tab=tasks");
}
