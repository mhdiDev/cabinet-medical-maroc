/**
 * Script d'import des médicaments depuis le référentiel CNOPS Maroc (Excel).
 * Usage : npx ts-node prisma/import-medicaments.ts
 */
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

interface ExcelRow {
  CODE: string | number;
  NOM: string;
  DCI1: string;
  DOSAGE1: string | number;
  UNITE_DOSAGE1: string;
  FORME: string;
  PRESENTATION: string;
  PPV: number;
  PH: number;
  PRIX_BR: number;
  PRINCEPS_GENERIQUE: string;
  TAUX_REMBOURSEMENT: string;
}

async function main() {
  const filePath = path.join(__dirname, 'ref-des-medicaments-cnops-2014.xlsx');

  console.log('📂 Lecture du fichier Excel...');
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<ExcelRow>(ws, { defval: '' });

  console.log(`📊 ${rows.length} médicaments trouvés dans le fichier`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  // Traitement par lots de 100 pour ne pas surcharger la DB
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);

    await Promise.all(
      batch.map(async (row) => {
        try {
          const code = row.CODE ? String(row.CODE).trim() : null;
          const nom = (row.NOM || '').trim();
          if (!nom) return;

          // Concatène dosage + unité : "500 MG", "200 ML"...
          const dosage =
            row.DOSAGE1 && row.UNITE_DOSAGE1
              ? `${row.DOSAGE1} ${row.UNITE_DOSAGE1}`.trim()
              : row.DOSAGE1
              ? String(row.DOSAGE1)
              : null;

          const data = {
            nom: nom.substring(0, 255),
            denomination: row.DCI1 ? row.DCI1.trim().substring(0, 255) : null,
            dosage: dosage ? dosage.substring(0, 100) : null,
            forme: row.FORME ? row.FORME.trim().substring(0, 100) : null,
            presentation: row.PRESENTATION ? row.PRESENTATION.trim().substring(0, 255) : null,
            ppv: row.PPV ? Number(row.PPV) : null,
            princepsGenerique: row.PRINCEPS_GENERIQUE ? row.PRINCEPS_GENERIQUE.trim() : null,
            tauxRemboursement: row.TAUX_REMBOURSEMENT ? row.TAUX_REMBOURSEMENT.trim() : null,
          };

          if (code) {
            // Upsert par code-barres (idempotent : re-lancer le script est sûr)
            const result = await prisma.medicament.upsert({
              where: { code },
              update: data,
              create: { code, ...data },
            });
            // Distinguer création vs mise à jour via createdAt ≈ now
            const isNew = Date.now() - result.createdAt.getTime() < 5000;
            if (isNew) created++; else updated++;
          } else {
            // Pas de code : insert simple (médicaments sans code-barres)
            await prisma.medicament.create({ data });
            created++;
          }
        } catch {
          errors++;
        }
      }),
    );

    // Progression toutes les 500 lignes
    if ((i + BATCH) % 500 === 0 || i + BATCH >= rows.length) {
      const done = Math.min(i + BATCH, rows.length);
      console.log(`  ↳ ${done}/${rows.length} traités (${created} créés, ${updated} mis à jour, ${errors} erreurs)`);
    }
  }

  console.log('');
  console.log('✅ Import terminé !');
  console.log(`   Créés  : ${created}`);
  console.log(`   MàJ    : ${updated}`);
  console.log(`   Erreurs: ${errors}`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur import :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
