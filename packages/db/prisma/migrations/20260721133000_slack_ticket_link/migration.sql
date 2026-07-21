-- CreateTable
CREATE TABLE "slack_ticket_link" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "slack_channel" TEXT NOT NULL,
    "slack_thread_ts" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slack_ticket_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slack_ticket_link_ticket_id_key" ON "slack_ticket_link"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "slack_ticket_link_slack_channel_slack_thread_ts_key" ON "slack_ticket_link"("slack_channel", "slack_thread_ts");

-- AddForeignKey
ALTER TABLE "slack_ticket_link" ADD CONSTRAINT "slack_ticket_link_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- No RLS: bare lookup by (slack_channel, slack_thread_ts) resolves the tenant
-- before any tenant-scoped read/write happens, same as vendor_order_link.
GRANT SELECT, INSERT, UPDATE, DELETE ON "slack_ticket_link" TO freehold_app;
