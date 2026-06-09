import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from './minio.service';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
];

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService, private minio: MinioService) {}

  async upload(file: Express.Multer.File, patientId: string, consultationId?: string) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Seuls les fichiers image (JPG, PNG, GIF, WEBP) et PDF sont acceptés');
    }

    const key = await this.minio.uploadFile(file, `patients/${patientId}`);
    const url = this.minio.getPublicUrl(key);

    return this.prisma.document.create({
      data: {
        patientId,
        consultationId: consultationId || null,
        nom: file.originalname,
        type: file.mimetype,
        taille: file.size,
        url,
      },
    });
  }

  async findByPatient(patientId: string) {
    return this.prisma.document.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException(`Document ${id} introuvable`);

    try {
      const key = this.minio.extractKey(doc.url);
      await this.minio.deleteFile(key);
    } catch {
      // Ne pas bloquer la suppression DB si MinIO échoue
    }

    return this.prisma.document.delete({ where: { id } });
  }
}
