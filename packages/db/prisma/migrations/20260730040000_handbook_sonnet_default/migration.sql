-- The Handbook briefing moves from Haiku to Sonnet.
--
-- Decided by running both over the same real day. The difference wasn't the
-- writing: Sonnet spotted that a file with five overdue dates was exactly the
-- case a client's "phone call if a date moves, never just an email" note was
-- written for, and folded that into the advice. Haiku listed the same overdue
-- dates and never mentioned the note. Applying what the team wrote down to
-- what is happening today is the reason the feature exists, so it is worth
-- roughly half a cent a briefing (~$1 per person per month) instead of a
-- tenth of one.
--
-- Both the column default and the existing row move, so operators who never
-- touched the setting get the better model. An operator who has deliberately
-- chosen something else is left alone.
ALTER TABLE "platform_setting" ALTER COLUMN "handbook_model" SET DEFAULT 'claude-sonnet-5';
UPDATE "platform_setting" SET "handbook_model" = 'claude-sonnet-5'
  WHERE "handbook_model" = 'claude-haiku-4-5';
