import { prisma } from "@freehold/db";

/**
 * Global, non-tenant configuration editable from /admin. A single row —
 * there's exactly one Freehold — created on first read rather than seeded, so
 * nothing has to remember to provision it.
 */

const SINGLETON_ID = "singleton";

export async function getPlatformSettings() {
  return prisma.platformSetting.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID },
    update: {},
  });
}

/**
 * Atomically claim the founder-call slot: available, and the cooldown window
 * since the last call has elapsed. A single conditional UPDATE is the whole
 * mechanism — Postgres serializes concurrent statements against the same row,
 * so two visitors racing for the slot can't both have their WHERE match; only
 * one UPDATE affects a row, and that caller is the one who gets the call.
 * Returns true iff this call won the slot (and thereby claimed it — the
 * timestamp is already updated).
 */
export async function claimFounderCallSlot(): Promise<boolean> {
  const settings = await getPlatformSettings();
  const cooldownCutoff = new Date(Date.now() - settings.founderCallCooldownMinutes * 60 * 1000);
  const result = await prisma.platformSetting.updateMany({
    where: {
      id: SINGLETON_ID,
      founderCallsAvailable: true,
      OR: [{ founderLastCallAt: null }, { founderLastCallAt: { lt: cooldownCutoff } }],
    },
    data: { founderLastCallAt: new Date() },
  });
  return result.count === 1;
}
