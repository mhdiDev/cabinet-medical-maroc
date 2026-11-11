-- CreateTable
CREATE TABLE "constantes" (
    "id" TEXT NOT NULL,
    "cabinetId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "consultationId" TEXT,
    "priseParId" TEXT NOT NULL,
    "datePrise" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tensionSystolique" INTEGER,
    "tensionDiastolique" INTEGER,
    "pouls" INTEGER,
    "spo2" INTEGER,
    "temperature" DOUBLE PRECISION,
    "poids" DOUBLE PRECISION,
    "taille" DOUBLE PRECISION,
    "glycemie" DOUBLE PRECISION,
    "perimetreCranien" DOUBLE PRECISION,
    "tourDeTaille" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "constantes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "constantes_consultationId_key" ON "constantes"("consultationId");

-- CreateIndex
CREATE INDEX "constantes_cabinetId_patientId_datePrise_idx" ON "constantes"("cabinetId", "patientId", "datePrise");

-- AddForeignKey
ALTER TABLE "constantes" ADD CONSTRAINT "constantes_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constantes" ADD CONSTRAINT "constantes_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constantes" ADD CONSTRAINT "constantes_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constantes" ADD CONSTRAINT "constantes_priseParId_fkey" FOREIGN KEY ("priseParId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
