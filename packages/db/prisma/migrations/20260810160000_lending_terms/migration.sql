-- The loan itself, on a private lending file.
--
-- A lending screen without the loan on it is just a sale screen with the sale
-- parts removed. This is the amount, rate, term, points, appraised value, and
-- the borrowing entity plus whoever guarantees it.
--
-- One JSON column rather than nine sparse ones: only workspaces in private
-- lending fill any of it, the shape is still settling after one design pass,
-- and the same reasoning already applies to contract_parties. If loan volume
-- ever needs reporting across files, the fields that get queried can be
-- promoted to real columns then. Read through parseLendingTerms, which treats
-- the column as untrusted.

ALTER TABLE "transaction" ADD COLUMN "lending_terms" JSONB;
