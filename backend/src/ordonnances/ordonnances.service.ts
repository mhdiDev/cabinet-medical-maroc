import { Injectable, NotFoundException } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateOrdonnanceDto } from './dto/create-ordonnance.dto';

@Injectable()
export class OrdonnancesService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async findAll(page = 1, limit = 20, q?: string) {
    const skip = (page - 1) * limit;
    const where = q
      ? {
          OR: [
            { patient: { nom: { contains: q, mode: 'insensitive' as const } } },
            { patient: { prenom: { contains: q, mode: 'insensitive' as const } } },
            { medecinNom: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.ordonnance.findMany({
        where,
        skip,
        take: limit,
        include: {
          patient: { select: { id: true, nom: true, prenom: true } },
          medicaments: { include: { medicament: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ordonnance.count({ where }),
    ]);

    return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async create(dto: CreateOrdonnanceDto, userId: string) {
    const { medicaments, ...rest } = dto;

    const ordonnance = await this.prisma.ordonnance.create({
      data: {
        ...rest,
        contenu: medicaments as any,
        medicaments: {
          create: medicaments.map((m) => ({
            medicamentId: m.medicamentId,
            nomLibre: m.nomLibre,
            posologie: m.posologie,
            duree: m.duree,
            quantite: m.quantite || 1,
          })),
        },
      },
      include: {
        patient: { select: { nom: true, prenom: true, dateNaissance: true } },
        medicaments: { include: { medicament: true } },
      },
    });

    await this.audit.log(userId, 'CREATE', 'Ordonnance', ordonnance.id);
    return ordonnance;
  }

  async findByPatient(patientId: string) {
    return this.prisma.ordonnance.findMany({
      where: { patientId },
      include: { medicaments: { include: { medicament: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const ord = await this.prisma.ordonnance.findUnique({
      where: { id },
      include: {
        patient: true,
        medicaments: { include: { medicament: true } },
      },
    });
    if (!ord) throw new NotFoundException(`Ordonnance ${id} introuvable`);
    return ord;
  }

  async generatePdf(id: string): Promise<Buffer> {
    const ord = await this.findOne(id);
    const patient = ord.patient as any;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 60, left: 60, right: 60, bottom: 60 } });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // En-tête cabinet
      doc.fontSize(14).font('Helvetica-Bold').text(ord.medecinNom, { align: 'left' });
      if (ord.medecinSpec) doc.fontSize(11).font('Helvetica').text(ord.medecinSpec);
      if (ord.medecinRPPM) doc.fontSize(10).text(`RPPM: ${ord.medecinRPPM}`);

      doc.moveTo(60, doc.y + 10).lineTo(535, doc.y + 10).stroke();
      doc.moveDown();

      // Titre
      doc.fontSize(16).font('Helvetica-Bold').text('ORDONNANCE MÉDICALE', { align: 'center' });
      doc.moveDown(0.5);

      // Date
      doc.fontSize(10).font('Helvetica')
        .text(`Casablanca, le ${new Date(ord.createdAt).toLocaleDateString('fr-MA')}`, { align: 'right' });

      // Patient
      doc.moveDown();
      doc.fontSize(11).font('Helvetica-Bold').text('Patient:');
      doc.font('Helvetica').text(`${patient.prenom} ${patient.nom}`);
      doc.text(`Né(e) le: ${new Date(patient.dateNaissance).toLocaleDateString('fr-MA')}`);
      doc.moveDown();

      // Médicaments
      doc.moveTo(60, doc.y).lineTo(535, doc.y).stroke();
      doc.moveDown(0.5);

      const meds = ord.medicaments as any[];
      meds.forEach((m, i) => {
        const nomMed = m.medicament?.nom || m.nomLibre || 'Médicament';
        doc.font('Helvetica-Bold').text(`${i + 1}. ${nomMed}`);
        doc.font('Helvetica').text(`   Posologie: ${m.posologie}`);
        if (m.duree) doc.text(`   Durée: ${m.duree}`);
        doc.text(`   Quantité: ${m.quantite}`);
        doc.moveDown(0.3);
      });

      if (ord.notes) {
        doc.moveDown();
        doc.font('Helvetica-Oblique').fontSize(10).text(`Notes: ${ord.notes}`);
      }

      // Signature
      doc.moveDown(3);
      doc.font('Helvetica-Bold').fontSize(11).text('Signature du médecin:', { align: 'right' });
      doc.moveDown(3);
      doc.moveTo(350, doc.y).lineTo(535, doc.y).stroke();

      doc.end();
    });
  }
}
