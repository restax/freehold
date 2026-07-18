-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('LISTING', 'UNDER_CONTRACT', 'PENDING', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionSide" AS ENUM ('BUY_SIDE', 'SELL_SIDE', 'DUAL');

-- CreateEnum
CREATE TYPE "PartyRole" AS ENUM ('BUYER', 'SELLER', 'BUYER_AGENT', 'LISTING_AGENT', 'LENDER', 'TITLE_COMPANY', 'INSPECTOR', 'APPRAISER', 'ATTORNEY', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'DONE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "DateAnchor" AS ENUM ('CONTRACT_DATE', 'CLOSE_DATE');

-- AlterTable
ALTER TABLE "client" ADD COLUMN     "isSample" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "contact" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "rating" INTEGER,
    "touch_date" DATE,
    "notes" TEXT,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "clientId" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'UNDER_CONTRACT',
    "side" "TransactionSide" NOT NULL DEFAULT 'BUY_SIDE',
    "property_address" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "purchase_price" INTEGER,
    "contract_date" DATE,
    "close_date" DATE,
    "notes" TEXT,
    "custom_fields" JSONB,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_party" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" "PartyRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transactionId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "due_date" DATE,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "assigneeId" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_plan" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_plan_task" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "actionPlanId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "anchor" "DateAnchor" NOT NULL DEFAULT 'CLOSE_DATE',
    "offset_days" INTEGER NOT NULL DEFAULT 0,
    "assignee_role" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "action_plan_task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_tenant_id_category_idx" ON "contact"("tenant_id", "category");

-- CreateIndex
CREATE INDEX "transaction_tenant_id_status_idx" ON "transaction"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "transaction_party_tenant_id_idx" ON "transaction_party"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_party_transactionId_contactId_role_key" ON "transaction_party"("transactionId", "contactId", "role");

-- CreateIndex
CREATE INDEX "task_tenant_id_status_due_date_idx" ON "task"("tenant_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "action_plan_tenant_id_idx" ON "action_plan"("tenant_id");

-- CreateIndex
CREATE INDEX "action_plan_task_tenant_id_idx" ON "action_plan_task"("tenant_id");

-- AddForeignKey
ALTER TABLE "contact" ADD CONSTRAINT "contact_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact" ADD CONSTRAINT "contact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_party" ADD CONSTRAINT "transaction_party_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_party" ADD CONSTRAINT "transaction_party_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_party" ADD CONSTRAINT "transaction_party_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_plan" ADD CONSTRAINT "action_plan_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_plan_task" ADD CONSTRAINT "action_plan_task_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_plan_task" ADD CONSTRAINT "action_plan_task_actionPlanId_fkey" FOREIGN KEY ("actionPlanId") REFERENCES "action_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security for Stage 01 domain tables (same pattern as client).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['contact','transaction','transaction_party','task','action_plan','action_plan_task'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))',
      t || '_tenant_isolation', t
    );
  END LOOP;
END $$;
