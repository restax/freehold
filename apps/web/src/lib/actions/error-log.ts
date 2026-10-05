"use server";

import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { optStr, str } from "@/lib/forms";
import { isOperator } from "@/lib/operator";

/** Operator: mark an error handled (with what was found), or reopen it. */
export async function adminResolveError(formData: FormData) {
  if (!(await isOperator())) return;
  const id = str(formData, "id");
  if (!id) return;
  const reopen = str(formData, "reopen") === "1";
  await prisma.errorLog.update({
    where: { id },
    data: reopen
      ? { resolvedAt: null }
      : { resolvedAt: new Date(), note: optStr(formData, "note") },
  });
  revalidatePath("/admin/errors");
}
