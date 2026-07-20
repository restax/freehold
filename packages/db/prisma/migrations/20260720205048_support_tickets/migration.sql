-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');

-- CreateTable
CREATE TABLE "support_ticket" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "page_path" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_reply" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "from_operator" BOOLEAN NOT NULL DEFAULT false,
    "author_email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_reply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_ticket_tenant_id_status_idx" ON "support_ticket"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "support_ticket_reply_tenant_id_ticket_id_idx" ON "support_ticket_reply"("tenant_id", "ticket_id");

-- AddForeignKey
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_reply" ADD CONSTRAINT "support_ticket_reply_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_reply" ADD CONSTRAINT "support_ticket_reply_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security (same pattern as prior stages).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['support_ticket','support_ticket_reply'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))',
      t || '_tenant_isolation', t
    );
  END LOOP;
END $$;

-- Local parity with the deploy script, which re-grants every table each deploy.
GRANT SELECT, INSERT, UPDATE, DELETE ON "support_ticket" TO freehold_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "support_ticket_reply" TO freehold_app;
