import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MinioService implements OnModuleInit {
  private s3: AWS.S3;
  private bucket: string;
  private readonly logger = new Logger(MinioService.name);

  onModuleInit() {
    this.bucket = process.env.MINIO_BUCKET || 'cabinet-medical';
    this.s3 = new AWS.S3({
      endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
      accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
    });

    this.ensureBucketExists().catch((err) =>
      this.logger.warn(`MinIO bucket check failed: ${err.message}`),
    );
  }

  private async ensureBucketExists() {
    try {
      await this.s3.headBucket({ Bucket: this.bucket }).promise();
    } catch (err: any) {
      if (err.code === 'NotFound' || err.code === 'NoSuchBucket' || err.statusCode === 404) {
        await this.s3.createBucket({ Bucket: this.bucket }).promise();
        this.logger.log(`Bucket '${this.bucket}' créé`);
      }
    }
  }

  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    const ext = file.originalname.split('.').pop() || 'bin';
    const key = `${folder}/${uuidv4()}.${ext}`;

    await this.s3
      .putObject({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
      .promise();

    return key;
  }

  getPublicUrl(key: string): string {
    const endpoint = (process.env.MINIO_ENDPOINT || 'http://localhost:9000').replace(/\/$/, '');
    return `${endpoint}/${this.bucket}/${key}`;
  }

  extractKey(url: string): string {
    const match = url.match(new RegExp(`/${this.bucket}/(.+)$`));
    return match ? match[1] : url;
  }

  async deleteFile(key: string): Promise<void> {
    await this.s3.deleteObject({ Bucket: this.bucket, Key: key }).promise();
  }
}
