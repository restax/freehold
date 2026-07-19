-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "billing_suspended_at" TIMESTAMP(3),
ADD COLUMN     "comp_expires_at" TIMESTAMP(3),
ADD COLUMN     "comp_tier" "PlanTier",
ADD COLUMN     "subscription_status" TEXT;

-- CreateTable
CREATE TABLE "comp_code" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tier" "PlanTier" NOT NULL,
    "duration_months" INTEGER,
    "expires_at" TIMESTAMP(3),
    "max_redemptions" INTEGER NOT NULL DEFAULT 1,
    "times_redeemed" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comp_code_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "comp_code_code_key" ON "comp_code"("code");

-- comp_code is a platform table (no RLS): the app role needs direct access,
-- redemption is gated in the action layer, minting is operator-only.
GRANT SELECT, INSERT, UPDATE, DELETE ON "comp_code" TO freehold_app;
