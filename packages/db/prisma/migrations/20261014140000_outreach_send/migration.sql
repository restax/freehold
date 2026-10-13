-- CreateTable
CREATE TABLE "outreach_send" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email_key" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resends" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "outreach_send_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outreach_send_user_id_email_key_key" ON "outreach_send"("user_id", "email_key");
CREATE INDEX "outreach_send_email_key_idx" ON "outreach_send"("email_key");

-- Anyone already sent the setup offer counts as sent.
INSERT INTO "outreach_send" ("id", "user_id", "email_key", "sent_at")
SELECT gen_random_uuid()::text, "user_id", 'setup-offer', "sent_at" FROM "setup_invite";
