-- Per-client switch for reading intake contracts with AI.
--
-- Off for everyone, including existing clients: a contract that arrived from
-- a form was uploaded by someone the workspace hasn't vetted yet, and
-- spending a workspace's AI on it silently is not a default anyone asked for.
-- The TC turns it on per client, on a plan that includes pro AI.
ALTER TABLE "client"
  ADD COLUMN "intake_ai_extraction" BOOLEAN NOT NULL DEFAULT false;
