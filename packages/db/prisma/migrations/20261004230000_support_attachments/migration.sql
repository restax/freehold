-- CreateTable
CREATE TABLE "support_attachment" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "reply_id" TEXT,
    "filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BYTEA,
    "storage_key" TEXT,
    "storage_provider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_attachment_tenant_id_ticket_id_idx" ON "support_attachment"("tenant_id", "ticket_id");

-- AddForeignKey
ALTER TABLE "support_attachment" ADD CONSTRAINT "support_attachment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_attachment" ADD CONSTRAINT "support_attachment_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_attachment" ADD CONSTRAINT "support_attachment_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "support_ticket_reply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security: WITH CHECK pinned to the inserting tenant, so a row
-- cannot be written naming another workspace's id.
ALTER TABLE "support_attachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_attachment" FORCE ROW LEVEL SECURITY;
CREATE POLICY "support_attachment_tenant_isolation" ON "support_attachment"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Local parity with the deploy script, which re-grants every table each deploy.
GRANT SELECT, INSERT, UPDATE, DELETE ON "support_attachment" TO freehold_app;
