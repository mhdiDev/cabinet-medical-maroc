-- AlterTable
ALTER TABLE "paiements" ADD COLUMN     "consultationId" TEXT;

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "estAssure" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
