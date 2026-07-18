-- CreateEnum
CREATE TYPE "VaultAction" AS ENUM ('CREATED', 'UPDATED', 'REVEALED', 'DELETED');

-- CreateTable
CREATE TABLE "portal_link" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "show_tasks" BOOLEAN NOT NULL DEFAULT true,
    "show_documents" BOOLEAN NOT NULL DEFAULT false,
    "show_parties" BOOLEAN NOT NULL DEFAULT true,
    "revoked_at" TIMESTAMP(3),
    "last_accessed_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_credential" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "clientId" TEXT,
    "system" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "url" TEXT,
    "notes" TEXT,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "wrapped_key" TEXT NOT NULL,
    "wrap_iv" TEXT NOT NULL,
    "wrap_tag" TEXT NOT NULL,
    "key_version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_access_log" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "credentialId" TEXT,
    "userId" TEXT NOT NULL,
    "action" "VaultAction" NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_access_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "portal_link_token_key" ON "portal_link"("token");

-- CreateIndex
CREATE INDEX "portal_link_tenant_id_idx" ON "portal_link"("tenant_id");

-- CreateIndex
CREATE INDEX "portal_link_transactionId_idx" ON "portal_link"("transactionId");

-- CreateIndex
CREATE INDEX "vault_credential_tenant_id_idx" ON "vault_credential"("tenant_id");

-- CreateIndex
CREATE INDEX "vault_access_log_tenant_id_createdAt_idx" ON "vault_access_log"("tenant_id", "createdAt");

-- AddForeignKey
ALTER TABLE "portal_link" ADD CONSTRAINT "portal_link_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_link" ADD CONSTRAINT "portal_link_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_credential" ADD CONSTRAINT "vault_credential_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_credential" ADD CONSTRAINT "vault_credential_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_access_log" ADD CONSTRAINT "vault_access_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_access_log" ADD CONSTRAINT "vault_access_log_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "vault_credential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS for vault tables. portal_link is deliberately excluded: the public
-- portal route resolves bare tokens with no tenant context (see schema note).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vault_credential','vault_access_log'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))',
      t || '_tenant_isolation', t
    );
  END LOOP;
END $$;
