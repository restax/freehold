-- CreateTable
CREATE TABLE "friend_recommendation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clicked_at" TIMESTAMP(3),

    CONSTRAINT "friend_recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "friend_recommendation_token_key" ON "friend_recommendation"("token");

-- CreateIndex
CREATE INDEX "friend_recommendation_sent_at_idx" ON "friend_recommendation"("sent_at");

-- friend_recommendation has no tenant scoping and no RLS (platform-wide,
-- like vendor_ad), so it needs the same explicit grant those tables get.
GRANT SELECT, INSERT, UPDATE, DELETE ON "friend_recommendation" TO freehold_app;
