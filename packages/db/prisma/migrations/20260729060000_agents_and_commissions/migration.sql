-- Agents & commissions become first-class fields on a transaction.
--
-- Commission was a `payout` JSON blob holding a sell-side and a buy-side
-- percentage. Now that the side is explicit on the file, a second percentage
-- only ever described the other party's money — which isn't ours to track. It
-- collapses to one number: what our client earns on this file.
--
-- The gross figures are typed rather than computed. The old tab derived an
-- estimate from percentage x price, but a contract rarely states the gross,
-- and the *actual* figure only exists once the broker pays the agent. Storing
-- both is the point: the gap between them is what a coordinator chases.

ALTER TABLE "transaction"
  ADD COLUMN "primary_agent_contact_id" TEXT,
  ADD COLUMN "co_agent_contact_id"      TEXT,
  ADD COLUMN "commission_pct"           DOUBLE PRECISION,
  ADD COLUMN "estimated_gross_cents"    INTEGER,
  ADD COLUMN "actual_gross_cents"       INTEGER,
  ADD COLUMN "commission_note"          TEXT;

ALTER TABLE "transaction"
  ADD CONSTRAINT "transaction_primary_agent_contact_id_fkey"
    FOREIGN KEY ("primary_agent_contact_id") REFERENCES "contact"("id")
    ON UPDATE CASCADE ON DELETE SET NULL,
  ADD CONSTRAINT "transaction_co_agent_contact_id_fkey"
    FOREIGN KEY ("co_agent_contact_id") REFERENCES "contact"("id")
    ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX "transaction_primary_agent_contact_id_idx"
  ON "transaction"("primary_agent_contact_id");
CREATE INDEX "transaction_co_agent_contact_id_idx"
  ON "transaction"("co_agent_contact_id");

-- Carry the stored percentages across, keeping the one that describes our own
-- side. The regex guard is deliberate: these values came from a JSON blob, and
-- a single non-numeric entry would abort the whole migration on a cast.
UPDATE "transaction" SET
  "commission_pct" = CASE
    WHEN "side" = 'SELL_SIDE' THEN COALESCE(
      CASE WHEN "payout"->>'listPct' ~ '^[0-9]+(\.[0-9]+)?$' THEN ("payout"->>'listPct')::double precision END,
      CASE WHEN "payout"->>'buyPct'  ~ '^[0-9]+(\.[0-9]+)?$' THEN ("payout"->>'buyPct')::double precision END
    )
    WHEN "side" = 'BUY_SIDE' THEN COALESCE(
      CASE WHEN "payout"->>'buyPct'  ~ '^[0-9]+(\.[0-9]+)?$' THEN ("payout"->>'buyPct')::double precision END,
      CASE WHEN "payout"->>'listPct' ~ '^[0-9]+(\.[0-9]+)?$' THEN ("payout"->>'listPct')::double precision END
    )
    -- Dual: both percentages are ours, so the file earns the sum.
    ELSE NULLIF(
      COALESCE(CASE WHEN "payout"->>'listPct' ~ '^[0-9]+(\.[0-9]+)?$' THEN ("payout"->>'listPct')::double precision END, 0)
      + COALESCE(CASE WHEN "payout"->>'buyPct' ~ '^[0-9]+(\.[0-9]+)?$' THEN ("payout"->>'buyPct')::double precision END, 0),
      0)
  END,
  "commission_note" = NULLIF("payout"->>'note', '')
WHERE "payout" IS NOT NULL;

-- payout and co_agent_client_id are deliberately NOT dropped here.
--
-- Everything above is additive: the new columns are populated from payout, and
-- the old data stays exactly where it is. If the backfill turns out to have
-- read a percentage wrongly, the original JSON is still on the row to re-run
-- against — which it wouldn't be if this migration destroyed it in the same
-- step that read it. Production commission data gets one attempt at a
-- conversion, so it shouldn't be a one-way door.
--
-- Both columns stop being written the moment this ships. A follow-up migration
-- drops them once the new fields are seen carrying real data.
