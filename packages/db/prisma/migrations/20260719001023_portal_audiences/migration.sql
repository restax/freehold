-- CreateEnum
CREATE TYPE "PortalAudience" AS ENUM ('CLIENT', 'AGENT');

-- AlterTable
ALTER TABLE "document" ADD COLUMN     "visible_to_agent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "visible_to_client" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "portal_link" ADD COLUMN     "audience" "PortalAudience" NOT NULL DEFAULT 'CLIENT',
ADD COLUMN     "client_id" TEXT,
ALTER COLUMN "transactionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "visible_to_agent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "visible_to_client" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "portal_link" ADD CONSTRAINT "portal_link_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
