-- Private lending as a distinct line of work.
--
-- PRIVATE_LENDER is deliberately not the existing LENDER. LENDER is the
-- mortgage company on the other side of a normal sale, a party you coordinate
-- with. A PRIVATE_LENDER is the client paying you, and their files are loans
-- rather than purchases, which is why they get their own transaction screen.
--
-- Off by default: switching it on changes what a transaction looks like, so no
-- existing workspace should wake up to a different screen. Agents and offices
-- stay on, which is what every workspace already does today.

ALTER TYPE "ClientType" ADD VALUE 'PRIVATE_LENDER';

ALTER TABLE "organization"
  ADD COLUMN "client_type_agent_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "organization"
  ADD COLUMN "client_type_office_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "organization"
  ADD COLUMN "private_lending_enabled" BOOLEAN NOT NULL DEFAULT false;
