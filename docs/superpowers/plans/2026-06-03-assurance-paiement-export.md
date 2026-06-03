# Assurance Patient + Paiement lié Consultation + Export Excel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un statut assuré/non assuré sur le patient, lier les paiements aux consultations, et permettre l'export Excel mensuel des consultations filtré par statut d'assurance.

**Architecture:** 3 tâches indépendantes et séquentielles : (1) migration DB + backend patient, (2) lien paiement↔consultation backend + frontend caisse, (3) export Excel côté backend avec endpoint dédié + bouton frontend. Chaque tâche est deployable indépendamment.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Next.js 14, React Query, xlsx (déjà installé côté backend via import-medicaments)

---

## Fichiers concernés

| Fichier | Action |
|---|---|
| `backend/prisma/schema.prisma` | Modifier : ajouter `estAssure` sur Patient, `consultationId` sur Paiement |
| `backend/prisma/migrations/` | Créer migration |
| `backend/src/patients/dto/create-patient.dto.ts` | Ajouter `estAssure` |
| `backend/src/patients/dto/update-patient.dto.ts` | Ajouter `estAssure` |
| `backend/src/paiements/dto/create-paiement.dto.ts` | Ajouter `consultationId` |
| `backend/src/paiements/paiements.service.ts` | Modifier `create`, `caisse`, `rapport` + ajouter `exportExcel` |
| `backend/src/paiements/paiements.controller.ts` | Ajouter endpoint `GET /paiements/export` |
| `frontend/src/app/(dashboard)/patients/nouveau/page.tsx` | Ajouter checkbox `estAssure` |
| `frontend/src/app/(dashboard)/patients/[id]/page.tsx` | Ajouter checkbox `estAssure` |
| `frontend/src/app/(dashboard)/paiements/page.tsx` | Modifier formulaire encaissement : sélection consultation |

---

### Task 1 : Migration DB — `estAssure` sur Patient + `consultationId` sur Paiement

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Modifier le schema Prisma**

Dans `backend/prisma/schema.prisma`, modifier le model `Patient` :

```prisma
model Patient {
  id            String    @id @default(uuid())
  nom           String
  prenom        String
  dateNaissance DateTime
  sexe          Sexe
  cin           String?   @unique
  telephone     String
  email         String?
  adresse       String?
  ville         String?
  codePostal    String?
  groupeSanguin String?
  allergies     String[]
  antecedents   String?
  numeroAssurance String?
  estAssure     Boolean   @default(false)
  actif         Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  rendezVous    RendezVous[]
  consultations Consultation[]
  ordonnances   Ordonnance[]
  documents     Document[]
  paiements     Paiement[]

  @@map("patients")
}
```

Modifier le model `Paiement` pour ajouter `consultationId` et `patientId` avec relation :

```prisma
model Paiement {
  id           String       @id @default(uuid())
  consultationId String?
  rendezVousId String?
  patientId    String?
  montant      Float
  montantRemise Float       @default(0)
  typePaiement TypePaiement @default(ESPECE)
  referenceAssurance String?
  description  String?
  dateHeure    DateTime     @default(now())
  createdById  String?
  createdAt    DateTime     @default(now())

  consultation Consultation? @relation(fields: [consultationId], references: [id])
  rendezVous   RendezVous?   @relation(fields: [rendezVousId], references: [id])
  patient      Patient?      @relation(fields: [patientId], references: [id])

  @@map("paiements")
}
```

Ajouter la relation inverse dans `Consultation` :

```prisma
model Consultation {
  // ... champs existants ...
  paiements   Paiement[]
}
```

- [ ] **Step 2: Créer la migration**

```bash
cd backend
npx prisma migrate dev --name add_estAssure_and_consultation_to_paiement
```

Attendu : `✔ Generated Prisma Client` sans erreur.

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add estAssure to Patient and consultationId to Paiement"
```

---

### Task 2 : Backend — DTO Patient + DTO Paiement

**Files:**
- Modify: `backend/src/patients/dto/create-patient.dto.ts`
- Modify: `backend/src/paiements/dto/create-paiement.dto.ts`

- [ ] **Step 1: Ajouter `estAssure` dans CreatePatientDto**

Dans `backend/src/patients/dto/create-patient.dto.ts`, ajouter à la fin de la classe :

```typescript
@ApiProperty({ required: false, default: false })
@IsOptional()
@IsBoolean()
estAssure?: boolean;
```

Ajouter `IsBoolean` dans les imports :
```typescript
import {
  IsString, IsEmail, IsOptional, IsEnum, IsDateString,
  IsArray, Matches, MaxLength, IsBoolean,
} from 'class-validator';
```

- [ ] **Step 2: Ajouter `estAssure` dans UpdatePatientDto**

`backend/src/patients/dto/update-patient.dto.ts` utilise `PartialType(CreatePatientDto)` — aucun changement nécessaire si c'est le cas. Vérifier :

```bash
cat backend/src/patients/dto/update-patient.dto.ts
```

Si c'est `PartialType(CreatePatientDto)`, passer à l'étape suivante. Sinon ajouter le même champ.

- [ ] **Step 3: Ajouter `consultationId` dans CreatePaiementDto**

Dans `backend/src/paiements/dto/create-paiement.dto.ts` :

```typescript
import { IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TypePaiement } from '@prisma/client';

export class CreatePaiementDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() consultationId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() rendezVousId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() patientId?: string;

  @ApiProperty({ example: 200 })
  @IsNumber() @Min(0)
  montant: number;

  @ApiProperty({ default: 0 })
  @IsOptional() @IsNumber() @Min(0)
  montantRemise?: number;

  @ApiProperty({ enum: TypePaiement, default: TypePaiement.ESPECE })
  @IsEnum(TypePaiement)
  typePaiement: TypePaiement;

  @ApiProperty({ required: false }) @IsOptional() @IsString() referenceAssurance?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
}
```

- [ ] **Step 4: Modifier PaiementsService — enrichir caisse et rapport avec patient**

Dans `backend/src/paiements/paiements.service.ts`, modifier `caisse()` pour inclure patient et consultation :

```typescript
async caisse(date?: string) {
  const jour = date ? new Date(date) : new Date();
  jour.setHours(0, 0, 0, 0);
  const fin = new Date(jour);
  fin.setHours(23, 59, 59, 999);

  const paiements = await this.prisma.paiement.findMany({
    where: { dateHeure: { gte: jour, lte: fin } },
    orderBy: { dateHeure: 'asc' },
    include: {
      patient: { select: { id: true, nom: true, prenom: true, estAssure: true, numeroAssurance: true } },
      consultation: { select: { id: true, motif: true, actes: true } },
    },
  });

  const total = paiements.reduce((s, p) => s + p.montant - p.montantRemise, 0);
  const parType = paiements.reduce((acc, p) => {
    acc[p.typePaiement] = (acc[p.typePaiement] || 0) + (p.montant - p.montantRemise);
    return acc;
  }, {} as Record<string, number>);

  return { date: jour.toISOString().split('T')[0], paiements, total, parType };
}
```

- [ ] **Step 5: Ajouter endpoint export dans PaiementsController**

Dans `backend/src/paiements/paiements.controller.ts`, ajouter après les imports existants :

```typescript
import { Response } from 'express';
import { Res } from '@nestjs/common';
```

Ajouter le endpoint :

```typescript
@Get('export')
@UseGuards(JwtAuthGuard)
async exportExcel(
  @Query('debut') debut: string,
  @Query('fin') fin: string,
  @Query('assurance') assurance: 'tous' | 'assures' | 'non_assures' = 'tous',
  @Res() res: Response,
) {
  const buffer = await this.paiementsService.exportExcel(debut, fin, assurance);
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="consultations-${debut}-${fin}.xlsx"`,
    'Content-Length': buffer.length,
  });
  res.end(buffer);
}
```

- [ ] **Step 6: Implémenter exportExcel dans PaiementsService**

Dans `backend/src/paiements/paiements.service.ts`, ajouter l'import xlsx et la méthode :

```typescript
import * as XLSX from 'xlsx';
```

```typescript
async exportExcel(debut: string, fin: string, assurance: 'tous' | 'assures' | 'non_assures') {
  const paiements = await this.prisma.paiement.findMany({
    where: {
      dateHeure: { gte: new Date(debut), lte: new Date(fin + 'T23:59:59') },
      ...(assurance === 'assures' && { patient: { estAssure: true } }),
      ...(assurance === 'non_assures' && { patient: { estAssure: false } }),
    },
    orderBy: { dateHeure: 'asc' },
    include: {
      patient: { select: { nom: true, prenom: true, cin: true, estAssure: true, numeroAssurance: true } },
      consultation: { select: { motif: true, actes: true, dateConsultation: true } },
    },
  });

  const rows = paiements.map(p => ({
    'Date': p.dateHeure.toLocaleDateString('fr-MA'),
    'Patient': p.patient ? `${p.patient.nom} ${p.patient.prenom}` : '-',
    'CIN': p.patient?.cin || '-',
    'Assuré': p.patient?.estAssure ? 'Oui' : 'Non',
    'N° Assurance': p.patient?.numeroAssurance || '-',
    'Motif': p.consultation?.motif || p.description || '-',
    'Actes': p.consultation?.actes?.join(', ') || '-',
    'Montant (MAD)': p.montant,
    'Remise (MAD)': p.montantRemise,
    'Net (MAD)': p.montant - p.montantRemise,
    'Type paiement': p.typePaiement,
    'Réf. assurance': p.referenceAssurance || '-',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Consultations');

  // Largeur des colonnes
  ws['!cols'] = [
    { wch: 12 }, { wch: 25 }, { wch: 12 }, { wch: 8 },
    { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
  ];

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
```

- [ ] **Step 7: Vérifier que xlsx est installé dans le backend**

```bash
cd backend && grep "xlsx" package.json
```

Si absent : `npm install xlsx`

- [ ] **Step 8: Commit**

```bash
git add backend/src/patients/dto/ backend/src/paiements/
git commit -m "feat: add estAssure to patient DTO, consultationId to paiement, export Excel endpoint"
```

---

### Task 3 : Frontend — Checkbox assuré dans formulaire patient

**Files:**
- Modify: `frontend/src/app/(dashboard)/patients/nouveau/page.tsx`
- Modify: `frontend/src/app/(dashboard)/patients/[id]/page.tsx`

- [ ] **Step 1: Ajouter `estAssure` dans le schema Zod du formulaire nouveau patient**

Dans `frontend/src/app/(dashboard)/patients/nouveau/page.tsx`, dans la définition du schema Zod, ajouter :

```typescript
estAssure: z.boolean().optional().default(false),
```

Dans le type `FormData`, ajouter :
```typescript
estAssure?: boolean;
```

- [ ] **Step 2: Ajouter la checkbox dans le formulaire**

Dans le JSX de `nouveau/page.tsx`, après le champ `numeroAssurance`, ajouter :

```tsx
<div className="flex items-center gap-3">
  <input
    type="checkbox"
    id="estAssure"
    {...register('estAssure')}
    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
  />
  <label htmlFor="estAssure" className="text-sm font-medium text-gray-700">
    Patient assuré
  </label>
</div>
```

- [ ] **Step 3: Faire la même chose dans la page édition patient**

Dans `frontend/src/app/(dashboard)/patients/[id]/page.tsx`, identifier le formulaire d'édition et ajouter le même champ `estAssure` (schema Zod + checkbox JSX + valeur par défaut depuis les données patient).

La valeur par défaut doit venir des données chargées :
```typescript
defaultValues: {
  // ... autres champs ...
  estAssure: patient?.estAssure ?? false,
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/(dashboard)/patients/
git commit -m "feat: add estAssure checkbox in patient forms"
```

---

### Task 4 : Frontend — Formulaire encaissement lié à une consultation

**Files:**
- Modify: `frontend/src/app/(dashboard)/paiements/page.tsx`

- [ ] **Step 1: Ajouter la query pour les consultations du jour non encaissées**

Dans `frontend/src/app/(dashboard)/paiements/page.tsx`, ajouter après les queries existantes :

```typescript
const { data: consultationsDuJour } = useQuery({
  queryKey: ['consultations-du-jour', date],
  queryFn: () =>
    apiClient
      .get('/consultations', { params: { date, nonEncaissees: true } })
      .then(r => r.data),
  enabled: showForm,
});
```

- [ ] **Step 2: Ajouter `consultationId` dans PaiementForm**

```typescript
interface PaiementForm {
  consultationId: string;
  montant: string;
  montantRemise: string;
  typePaiement: string;
  description: string;
  referenceAssurance: string;
}
```

- [ ] **Step 3: Modifier le formulaire — sélection consultation en premier**

Dans le JSX du formulaire d'encaissement, remplacer ou ajouter en premier champ :

```tsx
<div>
  <label className="text-sm font-medium text-gray-700">Consultation *</label>
  <select {...register('consultationId')} className={inputClass} onChange={(e) => {
    const consultation = consultationsDuJour?.consultations?.find(
      (c: any) => c.id === e.target.value
    );
    if (consultation) {
      setValue('montant', consultation.montantSuggere?.toString() || '');
      setValue('description', consultation.motif || '');
    }
  }}>
    <option value="">— Sélectionner une consultation —</option>
    {consultationsDuJour?.consultations?.map((c: any) => (
      <option key={c.id} value={c.id}>
        {c.patient?.nom} {c.patient?.prenom} — {c.motif || 'Consultation'}
        {c.patient?.estAssure ? ' 🔵 Assuré' : ''}
      </option>
    ))}
  </select>
</div>
```

Ajouter `setValue` dans le destructuring du `useForm`.

- [ ] **Step 4: Envoyer consultationId lors de la soumission**

Modifier `onSubmit` pour inclure `consultationId` et récupérer `patientId` depuis la consultation :

```typescript
const onSubmit = (data: PaiementForm) => {
  const consultation = consultationsDuJour?.consultations?.find(
    (c: any) => c.id === data.consultationId
  );
  mutation.mutate({
    consultationId: data.consultationId || undefined,
    patientId: consultation?.patientId || undefined,
    montant: parseFloat(data.montant),
    montantRemise: parseFloat(data.montantRemise || '0'),
    typePaiement: data.typePaiement,
    description: data.description || undefined,
    referenceAssurance: data.referenceAssurance || undefined,
  });
};
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/(dashboard)/paiements/page.tsx
git commit -m "feat: link encaissement to consultation in caisse form"
```

---

### Task 5 : Frontend — Bouton export Excel dans la page Caisse

**Files:**
- Modify: `frontend/src/app/(dashboard)/paiements/page.tsx`

- [ ] **Step 1: Ajouter les états pour le filtre export**

Dans `paiements/page.tsx`, ajouter les états :

```typescript
const [exportAssurance, setExportAssurance] = useState<'tous' | 'assures' | 'non_assures'>('tous');
```

- [ ] **Step 2: Ajouter la fonction d'export**

```typescript
const handleExport = async () => {
  try {
    const response = await apiClient.get('/paiements/export', {
      params: { debut: rapportDebut, fin: rapportFin, assurance: exportAssurance },
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `consultations-${rapportDebut}-${rapportFin}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch {
    toast.error('Erreur lors de l\'export');
  }
};
```

- [ ] **Step 3: Ajouter le bloc export dans l'onglet Rapport**

Dans le JSX de l'onglet `rapport`, ajouter après les sélecteurs de dates :

```tsx
<div className="flex items-center gap-3 mt-4 p-4 bg-gray-50 rounded-lg">
  <span className="text-sm font-medium text-gray-700">Patients :</span>
  <select
    value={exportAssurance}
    onChange={(e) => setExportAssurance(e.target.value as any)}
    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
  >
    <option value="tous">Tous</option>
    <option value="assures">Assurés uniquement</option>
    <option value="non_assures">Non assurés uniquement</option>
  </select>
  <button
    onClick={handleExport}
    className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition flex items-center gap-2"
  >
    ⬇ Export Excel
  </button>
</div>
```

- [ ] **Step 4: Commit et push**

```bash
git add frontend/src/app/(dashboard)/paiements/page.tsx
git commit -m "feat: add Excel export with insurance filter in rapport tab"
git push origin master
```

---

### Task 6 : Déploiement

- [ ] **Step 1: Lancer la migration sur la DB de production**

```bash
cd backend
DATABASE_URL="postgresql://cabinet_medical_db_rtqm_user:teIeFYR58t36JySyjkYPAAnrXv6x6k5p@dpg-d8f0hk4m0tmc73eec5jg-a.frankfurt-postgres.render.com/cabinet_medical_db_rtqm" npx prisma migrate deploy
```

Attendu :
```
1 migration found in prisma/migrations
The following migration was applied:
- 20260603XXXXXX_add_estAssure_and_consultation_to_paiement
```

- [ ] **Step 2: Redéployer le backend sur Render**

Dans Render → service backend → **Manual Deploy** → **Deploy latest commit**

- [ ] **Step 3: Redéployer le frontend sur Vercel**

```bash
cd frontend
npx vercel --prod
```

- [ ] **Step 4: Vérifier en production**

1. Ouvrir `https://cabinet-medical-maroc.vercel.app`
2. Aller dans Patients → Nouveau → vérifier la checkbox "Patient assuré"
3. Aller dans Caisse → Encaissement → vérifier la sélection de consultation
4. Aller dans Caisse → Rapport → vérifier le bouton "Export Excel"
5. Télécharger le fichier et vérifier qu'il s'ouvre correctement dans Excel
