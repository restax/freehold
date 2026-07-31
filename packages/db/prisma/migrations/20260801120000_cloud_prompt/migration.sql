-- The Freehold Cloud prompt shown on self-hosted installs.
-- Operator-editable copy, one row for the whole install; null or blank falls
-- back to the bundled default in lib/cloud-prompt.ts. The enabled flag is the
-- lever a self-hoster pulls to remove the upsell entirely — self-hosting is a
-- supported choice, not a trial.
ALTER TABLE "platform_setting" ADD COLUMN "cloud_prompt_text" TEXT;
ALTER TABLE "platform_setting" ADD COLUMN "cloud_prompt_enabled" BOOLEAN NOT NULL DEFAULT true;

-- Per-workspace answer: {off?: boolean, snoozedAt?: ISO string}. Null means
-- never answered, which is why a fresh workspace sees the prompt at all.
ALTER TABLE "organization" ADD COLUMN "cloud_prompt_config" JSONB;
