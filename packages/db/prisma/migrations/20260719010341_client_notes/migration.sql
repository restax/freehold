-- CreateTable
CREATE TABLE "client_note" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "author_id" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_note_tenant_id_client_id_createdAt_idx" ON "client_note"("tenant_id", "client_id", "createdAt");

-- AddForeignKey
ALTER TABLE "client_note" ADD CONSTRAINT "client_note_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_note" ADD CONSTRAINT "client_note_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_note" ENABLE ROW LEVEL SECURITY;
CREATE POLICY client_note_tenant_isolation ON "client_note"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "client_note" TO freehold_app;
