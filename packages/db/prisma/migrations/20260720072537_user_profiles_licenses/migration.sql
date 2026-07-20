-- AlterTable
ALTER TABLE "user" ADD COLUMN     "avatar_data" BYTEA,
ADD COLUMN     "avatar_type" TEXT;

-- CreateTable
CREATE TABLE "user_license" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "license_number" TEXT,
    "label" TEXT,
    "expires_at" DATE,
    "filename" TEXT,
    "content_type" TEXT,
    "size_bytes" INTEGER,
    "data" BYTEA,
    "storage_key" TEXT,
    "storage_provider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_license_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_license_tenant_id_idx" ON "user_license"("tenant_id");

-- CreateIndex
CREATE INDEX "user_license_tenant_id_user_id_idx" ON "user_license"("tenant_id", "user_id");

-- AddForeignKey
ALTER TABLE "user_license" ADD CONSTRAINT "user_license_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_license" ADD CONSTRAINT "user_license_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security (same pattern as prior stages).
DO $$
BEGIN
  EXECUTE 'ALTER TABLE user_license ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE user_license FORCE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY user_license_tenant_isolation ON user_license USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))';
END $$;

-- Local parity with the deploy script, which re-grants every table each deploy.
GRANT SELECT, INSERT, UPDATE, DELETE ON "user_license" TO freehold_app;
