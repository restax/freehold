-- Named signature blocks: a small library of "Your transaction coordinator"
-- contact cards a workspace keeps, instead of one signature auto-derived
-- from whoever is logged in. One is marked default — used by every
-- automated system email, which has no sender to ask.
CREATE TABLE "email_signature" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "title" TEXT,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_signature_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_signature_tenant_id_idx" ON "email_signature"("tenant_id");

ALTER TABLE "email_signature" ADD CONSTRAINT "email_signature_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_signature" ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_signature_tenant_isolation ON "email_signature"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "email_signature" TO freehold_app;

-- Admin setting: let non-admin members edit signature blocks. Off by default.
ALTER TABLE "organization" ADD COLUMN "members_can_edit_signatures" BOOLEAN NOT NULL DEFAULT false;
