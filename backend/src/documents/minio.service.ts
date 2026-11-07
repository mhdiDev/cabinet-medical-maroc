import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

@Injectable()
export class MinioService implements OnModuleInit {
  private s3: AWS.S3;
  private bucket: string;
  private publicUrl: string;
  private readonly logger = new Logger(MinioService.name);

  onModuleInit() {
    this.bucket = process.env.MINIO_BUCKET || 'cabinet-medical';
    // MINIO_PUBLIC_URL : URL publique des fichiers (ex: https://pub-xxx.r2.dev ou domaine custom)
    // Fallback local pour le dev
    this.publicUrl = (
      process.env.MINIO_PUBLIC_URL ||
      `${process.env.MINIO_ENDPOINT || 'http://localhost:9000'}/${this.bucket}`
    ).replace(/\/$/, '');

    this.s3 = new AWS.S3({
      endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
      accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
      region: process.env.MINIO_REGION || 'auto',
    });
  }

  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    // L'extension vient du type (déjà filtré par la liste blanche), jamais du nom envoyé par le client
    const ext = EXTENSIONS[file.mimetype] ?? 'bin';
    const key = `${folder}/${uuidv4()}.${ext}`;

    try {
      await this.s3
        .putObject({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
        .promise();
    } catch (err: any) {
      this.logger.error(`Upload échoué: ${err.message}`);
      throw new ServiceUnavailableException(
        'Le stockage de fichiers est temporairement indisponible',
      );
    }

    return key;
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  // La clé se déduit du chemin de l'URL (à partir de patients/ ou cabinets/) : elle ne dépend
  // donc pas de MINIO_PUBLIC_URL, qui change avec le serveur ou le domaine.
  extractKey(url: string): string {
    let chemin = url;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
      try {
        chemin = new URL(url).pathname;
      } catch {
        throw new NotFoundException('Fichier introuvable');
      }
    }
    let segments: string[];
    try {
      segments = chemin.split('/').filter(Boolean).map(decodeURIComponent);
    } catch {
      throw new NotFoundException('Fichier introuvable');
    }
    const debut = segments.findIndex((s) => s === 'patients' || s === 'cabinets');
    if (debut !== -1 && debut < segments.length - 1) return segments.slice(debut).join('/');

    // Repli : comportement historique (préfixe public retiré, ou clé nue)
    const prefix = `${this.publicUrl}/`;
    const cle = url.startsWith(prefix) ? url.slice(prefix.length) : url;
    if (!cle || /^[a-z][a-z0-9+.-]*:\/\//i.test(cle)) {
      throw new NotFoundException('Fichier introuvable');
    }
    return cle;
  }

  async lireFichier(key: string): Promise<Buffer> {
    try {
      const objet = await this.s3.getObject({ Bucket: this.bucket, Key: key }).promise();
      return objet.Body as Buffer;
    } catch (err: any) {
      if (err.code === 'NoSuchKey' || err.code === 'InvalidObjectName') {
        throw new NotFoundException('Fichier introuvable');
      }
      this.logger.error(`Lecture échouée: ${err.message}`);
      throw new ServiceUnavailableException(
        'Le stockage de fichiers est temporairement indisponible',
      );
    }
  }

  async deleteFile(key: string): Promise<void> {
    await this.s3.deleteObject({ Bucket: this.bucket, Key: key }).promise();
  }
}
