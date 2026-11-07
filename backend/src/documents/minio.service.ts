import { Injectable, Logger, NotFoundException, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

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
    const ext = file.originalname.split('.').pop() || 'bin';
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
      throw new ServiceUnavailableException('Le stockage de fichiers est temporairement indisponible');
    }

    return key;
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  extractKey(url: string): string {
    const prefix = `${this.publicUrl}/`;
    return url.startsWith(prefix) ? url.slice(prefix.length) : url;
  }

  async lireFichier(key: string): Promise<Buffer> {
    try {
      const objet = await this.s3.getObject({ Bucket: this.bucket, Key: key }).promise();
      return objet.Body as Buffer;
    } catch (err: any) {
      if (err.code === 'NoSuchKey') throw new NotFoundException('Fichier introuvable');
      this.logger.error(`Lecture échouée: ${err.message}`);
      throw new ServiceUnavailableException('Le stockage de fichiers est temporairement indisponible');
    }
  }

  async deleteFile(key: string): Promise<void> {
    await this.s3.deleteObject({ Bucket: this.bucket, Key: key }).promise();
  }
}
