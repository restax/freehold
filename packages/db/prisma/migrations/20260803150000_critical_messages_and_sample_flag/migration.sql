-- Organization.hasSampleData: denormalized flag maintained by
-- seedSampleData/removeSampleData (lib/actions/sample-data.ts), the only two
-- places any isSample row is created or deleted. Backfilled below for
-- workspaces that already have sample data seeded.
ALTER TABLE "organization" ADD COLUMN "has_sample_data" BOOLEAN NOT NULL DEFAULT false;

UPDATE "organization" SET "has_sample_data" = true
WHERE "id" IN (
  SELECT "tenant_id" FROM "transaction" WHERE "isSample" = true
  UNION
  SELECT "tenant_id" FROM "contact" WHERE "isSample" = true
);

-- Dismiss for the onboarding ad widget: on the person, not the membership,
-- since the ad shows their own phone number.
ALTER TABLE "user" ADD COLUMN "onboarding_ad_dismissed_at" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "CriticalMessageTrigger" AS ENUM ('IMMEDIATE', 'HAS_SAMPLE_DATA', 'FIFTH_REAL_TRANSACTION', 'DAYS_AFTER_MESSAGE');

-- critical_message: operator-authored broadcast content, composed on
-- /admin/messages. No tenant column and no RLS — the content is
-- platform-wide, the same root-table shape as vendor_ad and platform_setting.
-- What varies per workspace (whether it's currently due, whether a given
-- member has dismissed it) lives in the two tables below instead.
CREATE TABLE "critical_message" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link_url" TEXT,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "trigger" "CriticalMessageTrigger" NOT NULL DEFAULT 'IMMEDIATE',
    "trigger_delay_days" INTEGER,
    "trigger_after_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "critical_message_pkey" PRIMARY KEY ("id")
);

-- critical_message_dismissal: one row per (message, membership), created
-- only when a member closes a message. Tenant-scoped and RLS'd like every
-- other workspace-owned table, even though the content it points at is not.
CREATE TABLE "critical_message_dismissal" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "dismissed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "critical_message_dismissal_pkey" PRIMARY KEY ("id")
);

-- message_shown_at: the first time a given workspace was shown a given
-- message. Its own table rather than folded into the dismissal above,
-- because the grain differs — this is per-workspace (needed for
-- DAYS_AFTER_MESSAGE's "N days after this workspace saw it" math),
-- dismissal is per-member.
CREATE TABLE "message_shown_at" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "first_shown_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_shown_at_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "critical_message_dismissal_tenant_id_idx" ON "critical_message_dismissal"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "critical_message_dismissal_message_id_member_id_key" ON "critical_message_dismissal"("message_id", "member_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_shown_at_message_id_tenant_id_key" ON "message_shown_at"("message_id", "tenant_id");

-- AddForeignKey
ALTER TABLE "critical_message" ADD CONSTRAINT "critical_message_trigger_after_message_id_fkey" FOREIGN KEY ("trigger_after_message_id") REFERENCES "critical_message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "critical_message_dismissal" ADD CONSTRAINT "critical_message_dismissal_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "critical_message_dismissal" ADD CONSTRAINT "critical_message_dismissal_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "critical_message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "critical_message_dismissal" ADD CONSTRAINT "critical_message_dismissal_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_shown_at" ADD CONSTRAINT "message_shown_at_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_shown_at" ADD CONSTRAINT "message_shown_at_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "critical_message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "critical_message_dismissal" ENABLE ROW LEVEL SECURITY;
CREATE POLICY critical_message_dismissal_tenant_isolation ON "critical_message_dismissal"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "critical_message_dismissal" TO freehold_app;

ALTER TABLE "message_shown_at" ENABLE ROW LEVEL SECURITY;
CREATE POLICY message_shown_at_tenant_isolation ON "message_shown_at"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "message_shown_at" TO freehold_app;

-- critical_message itself has no tenant scoping, so it needs an explicit
-- grant the same way vendor_ad and platform_setting do — RLS is what
-- usually implies one, and this table deliberately has none.
GRANT SELECT, INSERT, UPDATE, DELETE ON "critical_message" TO freehold_app;
