-- Fields the contact form asks for that had nowhere to go.
--
-- team_name sits beside company: an agent's team is a different thing from
-- their brokerage, and mail-merges address one or the other.
--
-- The two licence numbers are reference data a coordinator copies off a
-- contract constantly. They were going into the free-text note, which meant
-- they couldn't be searched or merged.
--
-- mailing_address records which of the two addresses post actually goes to.
-- Storing both and guessing is how a mailer ends up at an office that closed.
ALTER TABLE "contact"
  ADD COLUMN "team_name"           TEXT,
  ADD COLUMN "brokerage_license"   TEXT,
  ADD COLUMN "salesperson_license" TEXT,
  ADD COLUMN "mailing_address"     TEXT NOT NULL DEFAULT 'work';
