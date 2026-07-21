"use server";

import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { str } from "@/lib/forms";
import { isOperator } from "@/lib/operator";

/** Operator marks a captured unmatched inbound email as dealt with. */
export async function markInboundHandled(formData: FormData) {
  if (!(await isOperator())) return;
  const id = str(formData, "id");
  if (!id) return;
  // inbound_email has no RLS (unmatched mail may have no tenant); operator-only.
  await prisma.inboundEmail.update({
    where: { id },
    data: { handledAt: new Date() },
  });
  revalidatePath("/admin/inbound");
}
