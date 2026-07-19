-- AlterTable
ALTER TABLE "transaction" ADD COLUMN     "co_agent_client_id" TEXT,
ADD COLUMN     "expire_date" DATE,
ADD COLUMN     "list_date" DATE,
ADD COLUMN     "list_price" INTEGER,
ADD COLUMN     "mls_id" TEXT,
ADD COLUMN     "on_market_date" DATE,
ADD COLUMN     "payout" JSONB,
ADD COLUMN     "tc1_user_id" TEXT,
ADD COLUMN     "tc2_user_id" TEXT;
