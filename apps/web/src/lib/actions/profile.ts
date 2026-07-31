"use server";

import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { optStr, str } from "@/lib/forms";
import { requireTenant } from "@/lib/tenant";

/** Profile photos stay small — they render as 32–96px avatars. */
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Update the signed-in user's own display name and contact number. */
export async function updateProfile(formData: FormData) {
  const { userId } = await requireTenant();
  const name = str(formData, "name");
  if (!name) return;
  // Blank clears it — the signature card just drops the line, rather than
  // keeping a number the coordinator deliberately removed.
  const phone = optStr(formData, "phone");
  await prisma.user.update({ where: { id: userId }, data: { name, phone } });
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/team");
}

/**
 * Upload the signed-in user's profile photo. Stored inline on the auth user
 * (photos are tiny and user-global — never routed to a tenant bucket); `image`
 * gets the serving path so anything reading the auth user renders it.
 */
export async function uploadAvatar(formData: FormData) {
  const { userId } = await requireTenant();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  if (file.size > MAX_AVATAR_BYTES || !AVATAR_TYPES.has(file.type)) return;

  const bytes = Buffer.from(await file.arrayBuffer());
  await prisma.user.update({
    where: { id: userId },
    data: {
      avatarData: bytes,
      avatarType: file.type,
      image: `/api/users/${userId}/avatar`,
    },
  });
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/team");
}

/** Remove the signed-in user's profile photo. */
export async function removeAvatar() {
  const { userId } = await requireTenant();
  await prisma.user.update({
    where: { id: userId },
    data: { avatarData: null, avatarType: null, image: null },
  });
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/team");
}
