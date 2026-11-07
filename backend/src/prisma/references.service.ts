import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

export interface References {
  patientId?: string | null;
  medecinId?: string | null;
  rendezVousId?: string | null;
  consultationId?: string | null;
  articleId?: string | null;
}

// Le filtre de cabinet ne contrôle pas les identifiants écrits dans une ligne :
// chaque référence reçue est vérifiée ici, via le client filtré
@Injectable()
export class ReferencesService {
  constructor(private prisma: PrismaService) {}

  async verifier(refs: References): Promise<void> {
    const { patientId, medecinId, rendezVousId, consultationId, articleId } = refs;

    if (patientId) {
      await this.exiger(this.prisma.patient.count({ where: { id: patientId } }), 'Patient');
    }
    if (medecinId) {
      await this.exiger(
        this.prisma.user.count({ where: { id: medecinId, actif: true } }),
        'Médecin',
      );
    }
    if (rendezVousId) {
      await this.exiger(
        this.prisma.rendezVous.count({ where: { id: rendezVousId } }),
        'Rendez-vous',
      );
    }
    if (consultationId) {
      await this.exiger(
        this.prisma.consultation.count({ where: { id: consultationId } }),
        'Consultation',
      );
    }
    if (articleId) {
      await this.exiger(this.prisma.stockArticle.count({ where: { id: articleId } }), 'Article');
    }
  }

  private async exiger(compte: Promise<number>, nom: string): Promise<void> {
    if ((await compte) === 0) throw new NotFoundException(`${nom} introuvable`);
  }
}
