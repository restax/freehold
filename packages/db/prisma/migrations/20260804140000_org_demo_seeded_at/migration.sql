-- AlterTable: anchor date for the operator demo dataset
-- (lib/demo-workspace.ts). Null means the demo data was never seeded here.
ALTER TABLE "organization" ADD COLUMN "demo_seeded_at" TIMESTAMP(3);
