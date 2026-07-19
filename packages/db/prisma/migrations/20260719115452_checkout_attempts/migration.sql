-- CreateTable
CREATE TABLE "checkout_attempt" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "expired_at" TIMESTAMP(3),
    "recovery_url" TEXT,

    CONSTRAINT "checkout_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checkout_attempt_createdAt_idx" ON "checkout_attempt"("createdAt");

GRANT SELECT, INSERT, UPDATE, DELETE ON "checkout_attempt" TO freehold_app;
