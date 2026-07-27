-- TC-designed intake forms and their submissions.
--
-- Design rules this migration bakes in:
--   * A submission snapshots the layout it was filled against. Editing (or
--     deleting) a form later never changes what a past submission means —
--     the queue and the one-click converter read the snapshot, never the
--     live form. form_id is therefore SET NULL on delete, with form_name and
--     form_kind denormalized so an orphaned submission still reads.
--   * Private variants resolve deterministically: unique (tenant, kind,
--     client) collides only for real client ids, because Postgres treats
--     NULLs as distinct in unique indexes — so a tenant may keep many shared
--     forms of a kind but at most one private variant per client per kind.
--   * Nothing a public form produces enters the live pipeline on its own.
--     Submissions land with status 'new' and a person converts them.

CREATE TABLE "form" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "layout" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "show_public" BOOLEAN NOT NULL DEFAULT false,
    "show_portal" BOOLEAN NOT NULL DEFAULT false,
    "client_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "form_tenant_id_slug_key" ON "form"("tenant_id", "slug");
CREATE UNIQUE INDEX "form_tenant_id_kind_client_id_key" ON "form"("tenant_id", "kind", "client_id");
CREATE INDEX "form_tenant_id_idx" ON "form"("tenant_id");

ALTER TABLE "form" ADD CONSTRAINT "form_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "form" ADD CONSTRAINT "form_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "form_submission" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "form_id" TEXT,
    "form_name" TEXT NOT NULL,
    "form_kind" TEXT NOT NULL,
    "schema_snapshot" JSONB NOT NULL,
    "data" JSONB NOT NULL,
    "submitter_name" TEXT,
    "submitter_email" TEXT,
    "submitter_phone" TEXT,
    "client_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "converted_client_id" TEXT,
    "converted_transaction_id" TEXT,
    "document_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_submission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "form_submission_tenant_id_status_idx" ON "form_submission"("tenant_id", "status");
CREATE INDEX "form_submission_tenant_id_form_id_idx" ON "form_submission"("tenant_id", "form_id");

ALTER TABLE "form_submission" ADD CONSTRAINT "form_submission_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "form_submission" ADD CONSTRAINT "form_submission_form_id_fkey"
  FOREIGN KEY ("form_id") REFERENCES "form"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "form_submission" ADD CONSTRAINT "form_submission_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tenant isolation. WITH CHECK pins the inserting side too, so a tenant
-- cannot write a row naming another tenant.
ALTER TABLE "form" ENABLE ROW LEVEL SECURITY;
CREATE POLICY form_tenant_isolation ON "form"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "form" TO freehold_app;

ALTER TABLE "form_submission" ENABLE ROW LEVEL SECURITY;
CREATE POLICY form_submission_tenant_isolation ON "form_submission"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "form_submission" TO freehold_app;
