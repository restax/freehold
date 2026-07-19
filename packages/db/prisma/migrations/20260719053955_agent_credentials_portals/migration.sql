-- AlterTable
ALTER TABLE "contact" ADD COLUMN     "photo_url" TEXT,
ADD COLUMN     "social_links" JSONB;

-- AlterTable
ALTER TABLE "portal_link" ADD COLUMN     "contact_id" TEXT;

-- AlterTable
ALTER TABLE "vault_credential" ADD COLUMN     "contact_id" TEXT;

-- CreateTable
CREATE TABLE "client_agent" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_agent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_agent_tenant_id_idx" ON "client_agent"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_agent_client_id_contact_id_key" ON "client_agent"("client_id", "contact_id");

-- AddForeignKey
ALTER TABLE "client_agent" ADD CONSTRAINT "client_agent_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_agent" ADD CONSTRAINT "client_agent_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_agent" ADD CONSTRAINT "client_agent_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_link" ADD CONSTRAINT "portal_link_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_credential" ADD CONSTRAINT "vault_credential_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "client_agent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY client_agent_tenant_isolation ON "client_agent"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "client_agent" TO freehold_app;
