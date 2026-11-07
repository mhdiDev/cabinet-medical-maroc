import { PrismaClient, Role, Sexe, StatutRDV, TypePaiement, TypeMouvement } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// Même identifiant que dans la migration multi_cabinet_socle
const CABINET_DEMO_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  console.log('🌱 Initialisation des données de démo...');

  await prisma.cabinet.upsert({
    where: { id: CABINET_DEMO_ID },
    update: {},
    create: {
      id: CABINET_DEMO_ID,
      nom: 'Cabinet de démonstration',
      adresse: 'À renseigner',
      ville: 'Casablanca',
      telephone: 'À renseigner',
    },
  });

  // Utilisateurs
  const adminPassword = await argon2.hash('Admin123!');
  const medecinPassword = await argon2.hash('Medecin123!');
  const secretairePassword = await argon2.hash('Secretaire123!');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@cabinet.ma' },
    update: {},
    create: {
      email: 'admin@cabinet.ma',
      motDePasse: adminPassword,
      nom: 'Administrateur',
      prenom: 'Système',
      role: Role.MEDECIN,
      estTitulaire: true,
      cabinetId: CABINET_DEMO_ID,
      telephone: '0600000000',
    },
  });

  const medecin = await prisma.user.upsert({
    where: { email: 'dr.benali@cabinet.ma' },
    update: {},
    create: {
      email: 'dr.benali@cabinet.ma',
      motDePasse: medecinPassword,
      nom: 'Benali',
      prenom: 'Mohammed',
      role: Role.MEDECIN,
      cabinetId: CABINET_DEMO_ID,
      telephone: '0661234567',
    },
  });

  const secretaire = await prisma.user.upsert({
    where: { email: 'secretaire@cabinet.ma' },
    update: {},
    create: {
      email: 'secretaire@cabinet.ma',
      motDePasse: secretairePassword,
      nom: 'Alami',
      prenom: 'Fatima',
      role: Role.SECRETAIRE,
      cabinetId: CABINET_DEMO_ID,
      telephone: '0662345678',
    },
  });

  // Patients démo
  const patients = await Promise.all([
    prisma.patient.upsert({
      where: { id: 'seed-patient-001-tazi-ahmed-000000000' },
      update: {},
      create: {
        id: 'seed-patient-001-tazi-ahmed-000000000',
        cabinetId: CABINET_DEMO_ID,
        nom: 'Tazi',
        prenom: 'Ahmed',
        dateNaissance: new Date('1985-03-15'),
        sexe: Sexe.MASCULIN,
        telephone: '0671234567',
        email: 'ahmed.tazi@email.ma',
        adresse: '12 Rue Mohammed V',
        ville: 'Casablanca',
        groupeSanguin: 'A+',
        allergies: ['Pénicilline'],
        antecedents: 'Diabète type 2 depuis 2015',
      },
    }),
    prisma.patient.upsert({
      where: { id: 'seed-patient-002-bennani-khadija-0000' },
      update: {},
      create: {
        id: 'seed-patient-002-bennani-khadija-0000',
        cabinetId: CABINET_DEMO_ID,
        nom: 'Bennani',
        prenom: 'Khadija',
        dateNaissance: new Date('1992-07-22'),
        sexe: Sexe.FEMININ,
        telephone: '0662345678',
        adresse: '45 Avenue Hassan II',
        ville: 'Rabat',
        groupeSanguin: 'O+',
        allergies: [],
        antecedents: 'Asthme depuis l\'enfance',
      },
    }),
    prisma.patient.upsert({
      where: { id: 'seed-patient-003-idrissi-omar-000000' },
      update: {},
      create: {
        id: 'seed-patient-003-idrissi-omar-000000',
        cabinetId: CABINET_DEMO_ID,
        nom: 'Idrissi',
        prenom: 'Omar',
        dateNaissance: new Date('1978-11-30'),
        sexe: Sexe.MASCULIN,
        telephone: '0653456789',
        adresse: '8 Bd Zerktouni',
        ville: 'Casablanca',
        groupeSanguin: 'B+',
        allergies: ['Aspirine', 'Ibuprofène'],
        antecedents: 'HTA sous traitement',
      },
    }),
  ]);

  // Médicaments de base
  const medicaments = await Promise.all([
    prisma.medicament.upsert({
      where: { id: 'med-amox' },
      update: {},
      create: {
        id: 'med-amox',
        nom: 'Amoxicilline',
        denomination: 'Amoxicilline',
        forme: 'Gélule',
        dosage: '500mg',
      },
    }),
    prisma.medicament.upsert({
      where: { id: 'med-para' },
      update: {},
      create: {
        id: 'med-para',
        nom: 'Paracétamol',
        denomination: 'Paracétamol',
        forme: 'Comprimé',
        dosage: '1000mg',
      },
    }),
    prisma.medicament.upsert({
      where: { id: 'med-omep' },
      update: {},
      create: {
        id: 'med-omep',
        nom: 'Oméprazole',
        denomination: 'Oméprazole',
        forme: 'Gélule',
        dosage: '20mg',
      },
    }),
  ]);

  // Stock articles
  await Promise.all([
    prisma.stockArticle.upsert({
      where: { cabinetId_reference: { cabinetId: CABINET_DEMO_ID, reference: 'COMP-01' } },
      update: {},
      create: {
        cabinetId: CABINET_DEMO_ID,
        nom: 'Compresses stériles 10x10',
        reference: 'COMP-01',
        quantite: 150,
        seuilAlerte: 20,
        fournisseur: 'Medis Maroc',
        prixUnitaire: 0.5,
        unite: 'pièce',
      },
    }),
    prisma.stockArticle.upsert({
      where: { cabinetId_reference: { cabinetId: CABINET_DEMO_ID, reference: 'GAZ-01' } },
      update: {},
      create: {
        cabinetId: CABINET_DEMO_ID,
        nom: 'Gants d\'examen latex M',
        reference: 'GAZ-01',
        quantite: 8,
        seuilAlerte: 10,
        fournisseur: 'Medis Maroc',
        prixUnitaire: 15,
        unite: 'boîte',
      },
    }),
    prisma.stockArticle.upsert({
      where: { cabinetId_reference: { cabinetId: CABINET_DEMO_ID, reference: 'SER-01' } },
      update: {},
      create: {
        cabinetId: CABINET_DEMO_ID,
        nom: 'Seringues 5ml',
        reference: 'SER-01',
        quantite: 200,
        seuilAlerte: 30,
        fournisseur: 'PharmaMed',
        prixUnitaire: 1.2,
        unite: 'pièce',
      },
    }),
  ]);

  // Paramètres cabinet
  const parametres: Record<string, string> = {
    cabinet_nom: 'Cabinet Dr. Benali',
    cabinet_adresse: '23 Rue Ibn Battouta, Casablanca 20000',
    cabinet_telephone: '0522-123456',
    medecin_specialite: 'Médecine Générale',
    medecin_rppm: 'RPPM-12345',
    duree_rdv_defaut: '30',
    heure_debut: '08:00',
    heure_fin: '18:00',
  };
  await Promise.all(
    Object.entries(parametres).map(([cle, valeur]) =>
      prisma.parametre.upsert({
        where: { cabinetId_cle: { cabinetId: CABINET_DEMO_ID, cle } },
        update: {},
        create: { cabinetId: CABINET_DEMO_ID, cle, valeur },
      }),
    ),
  );

  console.log('✅ Données de démo créées avec succès!');
  console.log('');
  console.log('Comptes de démo:');
  console.log('  Titulaire:  admin@cabinet.ma / Admin123!');
  console.log('  Médecin:    dr.benali@cabinet.ma / Medecin123!');
  console.log('  Secrétaire: secretaire@cabinet.ma / Secretaire123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
