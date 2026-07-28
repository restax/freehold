"use server";

import { prisma, withTenant } from "@freehold/db";
import { redirect } from "next/navigation";
import { clampRating, reviewLinkUsable } from "@/lib/reviews";

/**
 * The client's answer. No session, no admin gate — the token itself is the
 * authorization, same posture as portal and form-access links. One-shot:
 * reviewLinkUsable refuses a link that's already answered, so this can't be
 * replayed to overwrite a rating.
 */
export async function submitReview(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!token) return;

  const review = await prisma.clientReview.findUnique({ where: { token } });
  if (!review || !reviewLinkUsable(review)) return;

  const businessRating = clampRating(formData.get("businessRating"));
  if (!businessRating) redirect(`/r/${token}?invalid=1`);

  const coordinatorRating = review.coordinatorId
    ? clampRating(formData.get("coordinatorRating"))
    : null;
  const comment =
    String(formData.get("comment") ?? "")
      .trim()
      .slice(0, 2000) || null;
  const publishAllowed = formData.get("publishAllowed") === "on";

  await withTenant(review.tenantId, (tx) =>
    tx.clientReview.update({
      where: { id: review.id },
      data: {
        businessRating,
        coordinatorRating,
        comment,
        publishAllowed,
        answeredAt: new Date(),
      },
    }),
  );
  redirect(`/r/${token}?sent=1`);
}
