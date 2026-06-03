/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `medicaments` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "medicaments" ADD COLUMN     "code" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "ppv" DOUBLE PRECISION,
ADD COLUMN     "presentation" TEXT,
ADD COLUMN     "princepsGenerique" TEXT,
ADD COLUMN     "tauxRemboursement" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "medicaments_code_key" ON "medicaments"("code");
