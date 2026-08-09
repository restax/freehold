-- Compliance, phases 1 and 2: checklists know which side they cover, and a
-- client can hold a different default per side.
--
-- Nothing existing changes behaviour. Every current checklist becomes BOTH,
-- which is exactly what it was before the field existed, and the original
-- single `compliance_checklist_id` stays as the fallback used whenever no
-- side-specific default matches. A workspace that never touches the new
-- columns keeps working the way it does today.

CREATE TYPE "ComplianceSide" AS ENUM ('BUY_SIDE', 'SELL_SIDE', 'DUAL', 'BOTH');

ALTER TABLE "compliance_checklist"
  ADD COLUMN "side" "ComplianceSide" NOT NULL DEFAULT 'BOTH';

ALTER TABLE "client" ADD COLUMN "compliance_buy_id" TEXT;
ALTER TABLE "client" ADD COLUMN "compliance_sell_id" TEXT;
ALTER TABLE "client" ADD COLUMN "compliance_dual_id" TEXT;

ALTER TABLE "client"
  ADD CONSTRAINT "client_compliance_buy_id_fkey"
  FOREIGN KEY ("compliance_buy_id") REFERENCES "compliance_checklist"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client"
  ADD CONSTRAINT "client_compliance_sell_id_fkey"
  FOREIGN KEY ("compliance_sell_id") REFERENCES "compliance_checklist"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client"
  ADD CONSTRAINT "client_compliance_dual_id_fkey"
  FOREIGN KEY ("compliance_dual_id") REFERENCES "compliance_checklist"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
