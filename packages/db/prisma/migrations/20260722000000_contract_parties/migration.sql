-- AlterEnum
ALTER TYPE "FieldTarget" ADD VALUE 'PARTY';

-- AlterTable
ALTER TABLE "transaction" ADD COLUMN     "contract_parties" JSONB;

