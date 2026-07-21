-- CreateEnum
CREATE TYPE "ProposalKind" AS ENUM ('ACCEPT', 'DECLINE', 'SCHEDULE', 'COMPLETE', 'NOTE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'APPLIED', 'DISMISSED');

-- AlterTable
ALTER TABLE "document" ADD COLUMN     "source_order_id" TEXT;

-- AlterTable
ALTER TABLE "email_thread" ADD COLUMN     "order_id" TEXT;

-- AlterTable
ALTER TABLE "vendor_order" ADD COLUMN     "email_to" TEXT;

-- CreateTable
CREATE TABLE "vendor_order_link" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "last_accessed_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_order_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_order_proposal" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "kind" "ProposalKind" NOT NULL DEFAULT 'UNKNOWN',
    "at" TIMESTAMP(3),
    "summary" TEXT NOT NULL,
    "source_text" TEXT NOT NULL,
    "from_addr" TEXT NOT NULL,
    "sender_mismatch" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "vendor_order_proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_email" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "from_addr" TEXT NOT NULL,
    "to_addr" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "token" TEXT,
    "reason" TEXT NOT NULL,
    "attachment_count" INTEGER NOT NULL DEFAULT 0,
    "handled_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_email_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_order_link_order_id_key" ON "vendor_order_link"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_order_link_token_key" ON "vendor_order_link"("token");

-- CreateIndex
CREATE INDEX "vendor_order_proposal_tenant_id_order_id_idx" ON "vendor_order_proposal"("tenant_id", "order_id");

-- CreateIndex
CREATE INDEX "inbound_email_createdAt_idx" ON "inbound_email"("createdAt");

-- CreateIndex
CREATE INDEX "document_source_order_id_idx" ON "document"("source_order_id");

-- CreateIndex
CREATE INDEX "vendor_order_email_to_idx" ON "vendor_order"("email_to");

-- AddForeignKey
ALTER TABLE "vendor_order_link" ADD CONSTRAINT "vendor_order_link_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "vendor_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_order_proposal" ADD CONSTRAINT "vendor_order_proposal_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "vendor_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_source_order_id_fkey" FOREIGN KEY ("source_order_id") REFERENCES "vendor_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Row-level security.
-- vendor_order_proposal is tenant-scoped (single-sided): only the coordinator
-- reviews an emailed vendor's proposed update, so the vendor side never reads it.
ALTER TABLE "vendor_order_proposal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vendor_order_proposal" FORCE ROW LEVEL SECURITY;
CREATE POLICY "vendor_order_proposal_tenant_isolation" ON "vendor_order_proposal"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- vendor_order_link and inbound_email deliberately have NO RLS, the same as
-- portal_link and api_key: the link token IS the capability (looked up before
-- any tenant context), and unmatched inbound mail may have no tenant at all.
-- The app scopes both explicitly.
GRANT SELECT, INSERT, UPDATE, DELETE ON "vendor_order_link" TO freehold_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "vendor_order_proposal" TO freehold_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "inbound_email" TO freehold_app;
