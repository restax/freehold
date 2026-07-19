-- CreateTable
CREATE TABLE "email_thread" (
    "token" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transaction_id" TEXT,
    "contact_id" TEXT,
    "provider_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_thread_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE INDEX "email_thread_provider_id_idx" ON "email_thread"("provider_id");

-- No RLS by design (see schema comment); the app role still needs access.
GRANT SELECT, INSERT, UPDATE, DELETE ON "email_thread" TO freehold_app;
