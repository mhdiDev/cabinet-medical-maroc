-- Premier cabinet : reçoit toutes les données existantes
CREATE TABLE "cabinets" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,
    "ville" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cabinets_pkey" PRIMARY KEY ("id")
);

INSERT INTO "cabinets" ("id", "nom", "adresse", "ville", "telephone", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000001', 'Cabinet de démonstration', 'À renseigner', 'Casablanca', 'À renseigner', CURRENT_TIMESTAMP);

-- Colonnes, remplies avec le premier cabinet
ALTER TABLE "users" ADD COLUMN "cabinetId" TEXT;
ALTER TABLE "users" ADD COLUMN "estTitulaire" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "audit_logs" ADD COLUMN "cabinetId" TEXT;
ALTER TABLE "patients" ADD COLUMN "cabinetId" TEXT;
ALTER TABLE "rendez_vous" ADD COLUMN "cabinetId" TEXT;
ALTER TABLE "consultations" ADD COLUMN "cabinetId" TEXT;
ALTER TABLE "ordonnances" ADD COLUMN "cabinetId" TEXT;
ALTER TABLE "paiements" ADD COLUMN "cabinetId" TEXT;
ALTER TABLE "stock_articles" ADD COLUMN "cabinetId" TEXT;
ALTER TABLE "stock_mouvements" ADD COLUMN "cabinetId" TEXT;
ALTER TABLE "documents" ADD COLUMN "cabinetId" TEXT;
ALTER TABLE "notifications" ADD COLUMN "cabinetId" TEXT;
ALTER TABLE "parametres" ADD COLUMN "cabinetId" TEXT;

UPDATE "users" SET "cabinetId" = '00000000-0000-0000-0000-000000000001';
UPDATE "audit_logs" SET "cabinetId" = '00000000-0000-0000-0000-000000000001';
UPDATE "patients" SET "cabinetId" = '00000000-0000-0000-0000-000000000001';
UPDATE "rendez_vous" SET "cabinetId" = '00000000-0000-0000-0000-000000000001';
UPDATE "consultations" SET "cabinetId" = '00000000-0000-0000-0000-000000000001';
UPDATE "ordonnances" SET "cabinetId" = '00000000-0000-0000-0000-000000000001';
UPDATE "paiements" SET "cabinetId" = '00000000-0000-0000-0000-000000000001';
UPDATE "stock_articles" SET "cabinetId" = '00000000-0000-0000-0000-000000000001';
UPDATE "stock_mouvements" SET "cabinetId" = '00000000-0000-0000-0000-000000000001';
UPDATE "documents" SET "cabinetId" = '00000000-0000-0000-0000-000000000001';
UPDATE "notifications" SET "cabinetId" = '00000000-0000-0000-0000-000000000001';
UPDATE "parametres" SET "cabinetId" = '00000000-0000-0000-0000-000000000001';

ALTER TABLE "patients" ALTER COLUMN "cabinetId" SET NOT NULL;
ALTER TABLE "rendez_vous" ALTER COLUMN "cabinetId" SET NOT NULL;
ALTER TABLE "consultations" ALTER COLUMN "cabinetId" SET NOT NULL;
ALTER TABLE "ordonnances" ALTER COLUMN "cabinetId" SET NOT NULL;
ALTER TABLE "paiements" ALTER COLUMN "cabinetId" SET NOT NULL;
ALTER TABLE "stock_articles" ALTER COLUMN "cabinetId" SET NOT NULL;
ALTER TABLE "stock_mouvements" ALTER COLUMN "cabinetId" SET NOT NULL;
ALTER TABLE "documents" ALTER COLUMN "cabinetId" SET NOT NULL;
ALTER TABLE "notifications" ALTER COLUMN "cabinetId" SET NOT NULL;
ALTER TABLE "parametres" ALTER COLUMN "cabinetId" SET NOT NULL;

-- ADMIN devient médecin titulaire
UPDATE "users" SET "estTitulaire" = true WHERE "role" = 'ADMIN';

ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'MEDECIN', 'SECRETAIRE');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role"
  USING (CASE WHEN "role"::text = 'ADMIN' THEN 'MEDECIN' ELSE "role"::text END)::"Role";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'SECRETAIRE';
DROP TYPE "Role_old";

-- Seul un SUPER_ADMIN n'a pas de cabinet
ALTER TABLE "users" ADD CONSTRAINT "users_cabinet_selon_role"
  CHECK (("role" = 'SUPER_ADMIN') = ("cabinetId" IS NULL));

-- Unicité par cabinet
DROP INDEX "stock_articles_reference_key";
DROP INDEX "parametres_cle_key";
CREATE UNIQUE INDEX "stock_articles_cabinetId_reference_key" ON "stock_articles"("cabinetId", "reference");
CREATE UNIQUE INDEX "parametres_cabinetId_cle_key" ON "parametres"("cabinetId", "cle");

-- Index
CREATE INDEX "users_cabinetId_idx" ON "users"("cabinetId");
CREATE INDEX "audit_logs_cabinetId_idx" ON "audit_logs"("cabinetId");
CREATE INDEX "patients_cabinetId_idx" ON "patients"("cabinetId");
CREATE INDEX "rendez_vous_cabinetId_idx" ON "rendez_vous"("cabinetId");
CREATE INDEX "consultations_cabinetId_idx" ON "consultations"("cabinetId");
CREATE INDEX "ordonnances_cabinetId_idx" ON "ordonnances"("cabinetId");
CREATE INDEX "paiements_cabinetId_idx" ON "paiements"("cabinetId");
CREATE INDEX "stock_mouvements_cabinetId_idx" ON "stock_mouvements"("cabinetId");
CREATE INDEX "documents_cabinetId_idx" ON "documents"("cabinetId");
CREATE INDEX "notifications_cabinetId_idx" ON "notifications"("cabinetId");

-- Clés étrangères
ALTER TABLE "users" ADD CONSTRAINT "users_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "patients" ADD CONSTRAINT "patients_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rendez_vous" ADD CONSTRAINT "rendez_vous_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ordonnances" ADD CONSTRAINT "ordonnances_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_articles" ADD CONSTRAINT "stock_articles_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_mouvements" ADD CONSTRAINT "stock_mouvements_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "parametres" ADD CONSTRAINT "parametres_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
