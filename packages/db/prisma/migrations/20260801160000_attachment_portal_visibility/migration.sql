-- Whether an outstanding attachment row is shown to the client.
--
-- Defaults to false, so turning this feature on changes nothing anyone can
-- see until a coordinator opts a row in. The checklist is written in internal
-- language and often carries names and chase notes; publishing it wholesale
-- to clients because the portal gained the ability to render it would be a
-- disclosure nobody asked for.
--
-- Rows that already hold a document are unaffected: those follow the
-- document's own visible_to_client, which the portal has always honoured.
ALTER TABLE "transaction_attachment"
  ADD COLUMN "visible_to_client" BOOLEAN NOT NULL DEFAULT false;
