import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedicamentDto } from './dto/create-medicament.dto';

@Injectable()
export class MedicamentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Recherche full-text sur nom, DCI et forme.
   * Utilisé par l'autocomplete du formulaire d'ordonnance.
   */
  async search(q: string, limit = 15) {
    if (!q || q.trim().length < 1) return [];

    const terme = q.trim();

    return this.prisma.medicament.findMany({
      where: {
        actif: true,
        OR: [
          { nom: { contains: terme, mode: Prisma.QueryMode.insensitive } },
          { denomination: { contains: terme, mode: Prisma.QueryMode.insensitive } },
          { forme: { contains: terme, mode: Prisma.QueryMode.insensitive } },
          { code: { contains: terme } },
        ],
      },
      orderBy: [
        // Favoriser les correspondances exactes en début de nom
        { nom: 'asc' },
      ],
      take: limit,
      select: {
        id: true,
        code: true,
        nom: true,
        denomination: true,
        dosage: true,
        forme: true,
        presentation: true,
        ppv: true,
        princepsGenerique: true,
        tauxRemboursement: true,
      },
    });
  }

  async findOne(id: string) {
    const med = await this.prisma.medicament.findUnique({ where: { id } });
    if (!med) throw new NotFoundException(`Médicament ${id} introuvable`);
    return med;
  }

  /**
   * Crée un médicament s'il n'existe pas encore (recherche par nom exact + forme).
   * Retourne toujours un médicament (existant ou nouvellement créé).
   */
  async findOrCreate(dto: CreateMedicamentDto) {
    // Chercher d'abord par code si fourni
    if (dto.code) {
      const byCode = await this.prisma.medicament.findUnique({ where: { code: dto.code } });
      if (byCode) return { medicament: byCode, created: false };
    }

    // Chercher par nom exact + dosage (pour éviter les doublons)
    const existing = await this.prisma.medicament.findFirst({
      where: {
        nom: { equals: dto.nom.trim(), mode: Prisma.QueryMode.insensitive },
        dosage: dto.dosage
          ? { equals: dto.dosage.trim(), mode: Prisma.QueryMode.insensitive }
          : undefined,
      },
    });

    if (existing) return { medicament: existing, created: false };

    // Créer le médicament
    const medicament = await this.prisma.medicament.create({
      data: {
        code: dto.code || null,
        nom: dto.nom.trim(),
        denomination: dto.denomination?.trim() || null,
        dosage: dto.dosage?.trim() || null,
        forme: dto.forme?.trim() || null,
        presentation: dto.presentation?.trim() || null,
        ppv: dto.ppv ?? null,
        princepsGenerique: dto.princepsGenerique || null,
        tauxRemboursement: dto.tauxRemboursement || null,
      },
    });

    return { medicament, created: true };
  }

  async create(dto: CreateMedicamentDto) {
    return this.prisma.medicament.create({ data: dto });
  }
}
