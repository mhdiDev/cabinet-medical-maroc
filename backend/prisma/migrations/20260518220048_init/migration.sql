-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEDECIN', 'SECRETAIRE');

-- CreateEnum
CREATE TYPE "Sexe" AS ENUM ('MASCULIN', 'FEMININ');

-- CreateEnum
CREATE TYPE "StatutRDV" AS ENUM ('EN_ATTENTE', 'CONFIRME', 'ARRIVE', 'FACTURE', 'ANNULE');

-- CreateEnum
CREATE TYPE "TypePaiement" AS ENUM ('ESPECE', 'CARTE', 'CHEQUE', 'VIREMENT', 'ASSURANCE');

-- CreateEnum
CREATE TYPE "TypeMouvement" AS ENUM ('ENTREE', 'SORTIE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "motDePasse" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'SECRETAIRE',
    "telephone" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "dateNaissance" TIMESTAMP(3) NOT NULL,
    "sexe" "Sexe" NOT NULL,
    "cin" TEXT,
    "telephone" TEXT NOT NULL,
    "email" TEXT,
    "adresse" TEXT,
    "ville" TEXT,
    "codePostal" TEXT,
    "groupeSanguin" TEXT,
    "allergies" TEXT[],
    "antecedents" TEXT,
    "numeroAssurance" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rendez_vous" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "medecinId" TEXT NOT NULL,
    "dateHeure" TIMESTAMP(3) NOT NULL,
    "dureeMinutes" INTEGER NOT NULL DEFAULT 30,
    "statut" "StatutRDV" NOT NULL DEFAULT 'EN_ATTENTE',
    "motif" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rendez_vous_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultations" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "medecinId" TEXT NOT NULL,
    "rendezVousId" TEXT,
    "dateConsultation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motif" TEXT,
    "anamnese" TEXT,
    "examenClinique" TEXT,
    "diagnostic" TEXT,
    "traitement" TEXT,
    "notes" TEXT,
    "actes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordonnances" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "consultationId" TEXT,
    "medecinNom" TEXT NOT NULL,
    "medecinSpec" TEXT,
    "medecinRPPM" TEXT,
    "contenu" JSONB NOT NULL,
    "notes" TEXT,
    "fichierUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordonnances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicaments" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "denomination" TEXT,
    "forme" TEXT,
    "dosage" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "medicaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordonnance_medicaments" (
    "id" TEXT NOT NULL,
    "ordonnanceId" TEXT NOT NULL,
    "medicamentId" TEXT,
    "nomLibre" TEXT,
    "posologie" TEXT NOT NULL,
    "duree" TEXT,
    "quantite" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ordonnance_medicaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paiements" (
    "id" TEXT NOT NULL,
    "rendezVousId" TEXT,
    "patientId" TEXT,
    "montant" DOUBLE PRECISION NOT NULL,
    "montantRemise" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "typePaiement" "TypePaiement" NOT NULL DEFAULT 'ESPECE',
    "referenceAssurance" TEXT,
    "description" TEXT,
    "dateHeure" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paiements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_articles" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "quantite" INTEGER NOT NULL DEFAULT 0,
    "seuilAlerte" INTEGER NOT NULL DEFAULT 5,
    "fournisseur" TEXT,
    "prixUnitaire" DOUBLE PRECISION,
    "unite" TEXT NOT NULL DEFAULT 'unité',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_mouvements" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "type" "TypeMouvement" NOT NULL,
    "quantite" INTEGER NOT NULL,
    "motif" TEXT,
    "consultationId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_mouvements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "patientId" TEXT,
    "consultationId" TEXT,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "taille" INTEGER,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entite" TEXT NOT NULL,
    "entiteId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametres" (
    "id" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,

    CONSTRAINT "parametres_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "patients_cin_key" ON "patients"("cin");

-- CreateIndex
CREATE UNIQUE INDEX "consultations_rendezVousId_key" ON "consultations"("rendezVousId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_articles_reference_key" ON "stock_articles"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "parametres_cle_key" ON "parametres"("cle");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendez_vous" ADD CONSTRAINT "rendez_vous_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendez_vous" ADD CONSTRAINT "rendez_vous_medecinId_fkey" FOREIGN KEY ("medecinId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_medecinId_fkey" FOREIGN KEY ("medecinId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_rendezVousId_fkey" FOREIGN KEY ("rendezVousId") REFERENCES "rendez_vous"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordonnances" ADD CONSTRAINT "ordonnances_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordonnances" ADD CONSTRAINT "ordonnances_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordonnance_medicaments" ADD CONSTRAINT "ordonnance_medicaments_ordonnanceId_fkey" FOREIGN KEY ("ordonnanceId") REFERENCES "ordonnances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordonnance_medicaments" ADD CONSTRAINT "ordonnance_medicaments_medicamentId_fkey" FOREIGN KEY ("medicamentId") REFERENCES "medicaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_rendezVousId_fkey" FOREIGN KEY ("rendezVousId") REFERENCES "rendez_vous"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_mouvements" ADD CONSTRAINT "stock_mouvements_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "stock_articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
