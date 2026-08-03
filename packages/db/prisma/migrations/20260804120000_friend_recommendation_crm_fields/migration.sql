-- AlterTable: capture fields for an operator-sent recommendation
-- (name/phone/note) and whether it was pushed to Twenty CRM.
ALTER TABLE "friend_recommendation" ADD COLUMN "name" TEXT;
ALTER TABLE "friend_recommendation" ADD COLUMN "phone" TEXT;
ALTER TABLE "friend_recommendation" ADD COLUMN "note" TEXT;
ALTER TABLE "friend_recommendation" ADD COLUMN "crm_synced_at" TIMESTAMP(3);
