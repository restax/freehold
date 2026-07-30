-- The contract-extraction signature check.
--
-- Stores whether the uploaded PDF is actually executed, which parties have
-- signed, and which still have to. Nullable with no backfill: extractions
-- that ran before this column existed genuinely have no answer, and the
-- review screen reports that as "can't tell whether this is signed" rather
-- than assuming the document was signed.
ALTER TABLE "contract_extraction" ADD COLUMN "execution" JSONB;
