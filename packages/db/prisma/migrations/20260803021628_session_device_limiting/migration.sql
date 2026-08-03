-- Concurrent-desktop-session limiting: classify each session's device type,
-- mark superseded sessions revoked, and track lifetime kick count per user.

ALTER TABLE "session"
  ADD COLUMN "device_type" TEXT,
  ADD COLUMN "revoked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "revoked_reason" TEXT;

CREATE INDEX "session_userId_device_type_revoked_idx" ON "session" ("userId", "device_type", "revoked");

ALTER TABLE "user"
  ADD COLUMN "session_kick_count" INTEGER NOT NULL DEFAULT 0;
