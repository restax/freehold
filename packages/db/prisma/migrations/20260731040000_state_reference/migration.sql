-- Platform-wide state reference notes: closing model, dominant MLS, TC
-- licensing norms, and jargon per US state. Cross-tenant, no RLS — same
-- root-table shape as vendor / platform_setting. Editable from /admin/states.
CREATE TYPE "StateClosingModel" AS ENUM ('TITLE_ESCROW', 'ATTORNEY', 'PARTIAL_ATTORNEY');

CREATE TABLE "state_reference" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "closing_model" "StateClosingModel" NOT NULL,
    "closing_model_detail" TEXT NOT NULL,
    "dominant_mls" TEXT NOT NULL,
    "license_summary" TEXT NOT NULL,
    "jargon" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "state_reference_pkey" PRIMARY KEY ("code")
);

ALTER TABLE "platform_setting" ADD COLUMN "tc_license_general_rule" TEXT;
