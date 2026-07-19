-- AlterTable
ALTER TABLE "contact" ADD COLUMN     "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "company" TEXT,
ADD COLUMN     "extra_contacts" JSONB,
ADD COLUMN     "fax" TEXT,
ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "grade" TEXT,
ADD COLUMN     "home_address" JSONB,
ADD COLUMN     "job_title" TEXT,
ADD COLUMN     "last_name" TEXT,
ADD COLUMN     "lead_details" JSONB,
ADD COLUMN     "lead_type" TEXT,
ADD COLUMN     "middle_name" TEXT,
ADD COLUMN     "next_touch_at" DATE,
ADD COLUMN     "person_title" TEXT,
ADD COLUMN     "referral_date" DATE,
ADD COLUMN     "referral_source" TEXT,
ADD COLUMN     "referred_by_id" TEXT,
ADD COLUMN     "secondary" JSONB,
ADD COLUMN     "touch_dates" JSONB,
ADD COLUMN     "website" TEXT,
ADD COLUMN     "work_address" JSONB,
ADD COLUMN     "work_phone" TEXT;

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "restrict_contacts_to_owner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "contact_id" TEXT;

-- CreateTable
CREATE TABLE "contact_note" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "author_id" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_note_tenant_id_contact_id_createdAt_idx" ON "contact_note"("tenant_id", "contact_id", "createdAt");

-- CreateIndex
CREATE INDEX "contact_tenant_id_next_touch_at_idx" ON "contact"("tenant_id", "next_touch_at");

-- AddForeignKey
ALTER TABLE "contact" ADD CONSTRAINT "contact_referred_by_id_fkey" FOREIGN KEY ("referred_by_id") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_note" ADD CONSTRAINT "contact_note_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_note" ADD CONSTRAINT "contact_note_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS for contact_note (same pattern as every domain table)
ALTER TABLE "contact_note" ENABLE ROW LEVEL SECURITY;
CREATE POLICY contact_note_tenant_isolation ON "contact_note"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "contact_note" TO freehold_app;

-- Carry legacy free-text categories into the new tag array
UPDATE "contact" SET "categories" = ARRAY["category"] WHERE "category" IS NOT NULL AND "category" <> 'Other';
