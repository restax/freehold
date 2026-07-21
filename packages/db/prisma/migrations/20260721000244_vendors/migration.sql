-- CreateEnum
CREATE TYPE "VendorCategory" AS ENUM ('TITLE', 'INSPECTION', 'PHOTOGRAPHY', 'SIGNAGE', 'LEGAL', 'OTHER');

-- CreateTable
CREATE TABLE "vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "VendorCategory" NOT NULL DEFAULT 'OTHER',
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "service_area" TEXT,
    "blurb" TEXT,
    "logo" TEXT,
    "listed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_user" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_email_key" ON "vendor"("email");

-- CreateIndex
CREATE INDEX "vendor_category_idx" ON "vendor"("category");

-- CreateIndex
CREATE INDEX "vendor_user_user_id_idx" ON "vendor_user"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_user_vendor_id_user_id_key" ON "vendor_user"("vendor_id", "user_id");

-- AddForeignKey
ALTER TABLE "vendor_user" ADD CONSTRAINT "vendor_user_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_user" ADD CONSTRAINT "vendor_user_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- No RLS by design: vendor and vendor_user are root entities (like organization
-- and member), scoped by the app through VendorUser membership, not by
-- app.tenant_id -- a vendor has no tenant. The app role still needs access.
GRANT SELECT, INSERT, UPDATE, DELETE ON "vendor" TO freehold_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "vendor_user" TO freehold_app;
