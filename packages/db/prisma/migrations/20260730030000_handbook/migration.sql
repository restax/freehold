-- The Handbook: what a team knows about the people and files it works with.
--
-- The feature exists because a coordinating business runs on knowledge that
-- currently lives in one person's head — this client wants a phone call about
-- date changes, that sign installer only covers one county, this brokerage
-- reviews documents before final payment. A business taking on new help
-- either repeats all of it out loud or watches it get missed.
--
-- Design decisions baked in here:
--   * One table for four subject types rather than four tables. The note is
--     the same thing in every case; only what it hangs off differs, and a
--     single table is what lets one query pool everything relevant to a
--     transaction.
--   * subject_id is deliberately NOT a foreign key — it addresses four
--     different tables. An orphaned note after its subject is deleted is
--     harmless: nothing reads it, and every read is tenant-scoped anyway.
--   * relevant_until lets a fact with a shelf life ("on holiday April 2027")
--     age out of summaries on its own, without deleting the record.
--   * handbook_grade sits alongside contact.grade rather than replacing it.
--     The existing column is an A–D prospecting cadence that drives how often
--     to make contact; this one answers whether the business wants the work at
--     all. Merging them would mean grading someone poorly silently changed how
--     often the app told you to call them.

CREATE TYPE "HandbookSubject" AS ENUM ('CLIENT', 'CONTACT', 'MEMBER', 'TRANSACTION');

-- A–F, omitting E, as the school scale does.
CREATE TYPE "HandbookGrade" AS ENUM ('A', 'B', 'C', 'D', 'F');

CREATE TABLE "handbook_note" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "subject_type" "HandbookSubject" NOT NULL,
    "subject_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "author_id" TEXT,
    "author_name" TEXT,
    "relevant_until" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "handbook_note_pkey" PRIMARY KEY ("id")
);

-- Every read is "the notes for this subject", so the index leads with the
-- tenant and covers the lookup exactly.
CREATE INDEX "handbook_note_tenant_id_subject_type_subject_id_idx"
  ON "handbook_note"("tenant_id", "subject_type", "subject_id");

ALTER TABLE "handbook_note" ADD CONSTRAINT "handbook_note_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "handbook_note" ENABLE ROW LEVEL SECURITY;
-- WITH CHECK pins the inserting side to the current tenant, so a tenant can't
-- write a row naming another one. (The older `engagement` policy has a comment
-- claiming this and doesn't do it; not repeating that here.)
CREATE POLICY handbook_note_tenant_isolation ON "handbook_note"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "handbook_note" TO freehold_app;

-- Grades live on the record they describe: exactly one per client/contact,
-- and they drive a badge rather than a list.
ALTER TABLE "client" ADD COLUMN "handbook_grade" "HandbookGrade";
ALTER TABLE "client" ADD COLUMN "handbook_grade_note" TEXT;
ALTER TABLE "contact" ADD COLUMN "handbook_grade" "HandbookGrade";
ALTER TABLE "contact" ADD COLUMN "handbook_grade_note" TEXT;

-- Two switches, not one. Someone who wants nothing to do with AI can still
-- keep notes, which is the half that works with no model call at all.
ALTER TABLE "organization" ADD COLUMN "handbook_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "organization" ADD COLUMN "handbook_summary_enabled" BOOLEAN NOT NULL DEFAULT true;

-- Per-member cache for "Today at a glance". Regenerated lazily on view when
-- older than an hour, which is what delivers "once an hour while signed in"
-- without a scheduled job.
ALTER TABLE "member" ADD COLUMN "handbook_summary" TEXT;
ALTER TABLE "member" ADD COLUMN "handbook_summary_at" TIMESTAMP(3);

-- Operator-tunable model for the summary. Not the extraction model: that
-- reads an unchecked contract and its mistakes land on the file, while this
-- restates work already held and writes nothing.
ALTER TABLE "platform_setting" ADD COLUMN "handbook_model" TEXT NOT NULL DEFAULT 'claude-haiku-4-5';
ALTER TABLE "platform_setting" ADD COLUMN "handbook_thinking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "platform_setting" ADD COLUMN "handbook_style_guide" TEXT;
