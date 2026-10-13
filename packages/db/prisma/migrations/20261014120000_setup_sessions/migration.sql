-- CreateTable
CREATE TABLE "setup_invite" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "setup_invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setup_booking" (
    "id" TEXT NOT NULL,
    "invite_id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "setup_booking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "setup_invite_user_id_key" ON "setup_invite"("user_id");
CREATE UNIQUE INDEX "setup_invite_token_hash_key" ON "setup_invite"("token_hash");
CREATE UNIQUE INDEX "setup_booking_starts_at_key" ON "setup_booking"("starts_at");
CREATE INDEX "setup_booking_invite_id_idx" ON "setup_booking"("invite_id");

ALTER TABLE "setup_booking"
  ADD CONSTRAINT "setup_booking_invite_id_fkey"
  FOREIGN KEY ("invite_id") REFERENCES "setup_invite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
