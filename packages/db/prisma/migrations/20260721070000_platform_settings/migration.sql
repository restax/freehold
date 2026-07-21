-- CreateTable
CREATE TABLE "platform_setting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "founder_calls_available" BOOLEAN NOT NULL DEFAULT false,
    "founder_call_cooldown_minutes" INTEGER NOT NULL DEFAULT 15,
    "founder_call_selling_points" TEXT,
    "founder_last_call_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_setting_pkey" PRIMARY KEY ("id")
);


-- No RLS: platform_setting is a single-row, non-tenant table read/written only
-- by operator-gated code (/admin/settings) and the voice tool dispatcher.
GRANT SELECT, INSERT, UPDATE, DELETE ON "platform_setting" TO freehold_app;
