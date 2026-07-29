-- Drop the commission columns the previous migration superseded.
--
-- 20260729060000 added commission_pct / commission_note and copied payout's
-- percentages into them, deliberately leaving the original JSON in place so
-- the conversion stayed re-runnable. This is the other half: the new fields
-- are in use, so the old ones go.
--
-- Before destroying anything, refuse if the conversion left something behind.
-- The backfill picked the side-relevant percentage and summed for dual files;
-- if any row still holds a percentage or a note that never reached the new
-- columns, that's a bug in the conversion and dropping the source would put
-- it out of reach for good. Failing here fails the build, which leaves the
-- previous deployment serving and the data intact — the safe direction.
DO $$
DECLARE stranded integer;
BEGIN
  SELECT count(*) INTO stranded
  FROM "transaction"
  WHERE "payout" IS NOT NULL
    AND (
      (
        "commission_pct" IS NULL
        AND (
          "payout"->>'listPct' ~ '^[0-9]+(\.[0-9]+)?$'
          OR "payout"->>'buyPct' ~ '^[0-9]+(\.[0-9]+)?$'
        )
      )
      OR (
        "commission_note" IS NULL
        AND NULLIF("payout"->>'note', '') IS NOT NULL
      )
    );

  IF stranded > 0 THEN
    RAISE EXCEPTION
      'Refusing to drop payout: % transaction(s) still hold commission data that never reached commission_pct/commission_note',
      stranded;
  END IF;
END $$;

-- co_agent_client_id needs no such check. It pointed at a Client while its
-- replacement points at a Contact, so there was never a conversion to verify,
-- and it was write-only — set by the create form and read by nothing, on any
-- screen, ever.
ALTER TABLE "transaction"
  DROP COLUMN "payout",
  DROP COLUMN "co_agent_client_id";
