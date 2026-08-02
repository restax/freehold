-- Platform contact phone (shown at the top of every workspace's Support
-- page) and per-integration branding (logo + link) for /dashboard/integrations.
-- Both are global, operator-edited config — no tenant scoping, no RLS, same
-- shape as the rest of platform_setting.

ALTER TABLE "platform_setting"
  ADD COLUMN "contact_phone" TEXT NOT NULL DEFAULT '774-240-4715';

CREATE TABLE "integration_branding" (
  "key"        TEXT NOT NULL,
  "logo"       TEXT,
  "url"        TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "integration_branding_pkey" PRIMARY KEY ("key")
);
