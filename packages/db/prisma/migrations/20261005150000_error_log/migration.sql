-- CreateTable
CREATE TABLE "error_log" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "user_id" TEXT,
    "user_email" TEXT,
    "tenant_id" TEXT,
    "path" TEXT,
    "action" TEXT,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "digest" TEXT,
    "user_agent" TEXT,
    "detail" JSONB,
    "resolved_at" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "error_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "error_log_createdAt_idx" ON "error_log"("createdAt");
CREATE INDEX "error_log_digest_idx" ON "error_log"("digest");
CREATE INDEX "error_log_user_id_idx" ON "error_log"("user_id");
