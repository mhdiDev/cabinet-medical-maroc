import { NotFoundException } from '@nestjs/common';
import { MinioService } from './minio.service';

describe('MinioService.extractKey', () => {
  const service = new MinioService();
  const original = process.env.MINIO_PUBLIC_URL;

  beforeAll(() => {
    process.env.MINIO_PUBLIC_URL = 'http://ancien.serveur/files';
    service.onModuleInit();
  });
  afterAll(() => {
    if (original === undefined) delete process.env.MINIO_PUBLIC_URL;
    else process.env.MINIO_PUBLIC_URL = original;
  });

  it.each([
    ['http://149.56.209.147/files/patients/p1/x.pdf', 'patients/p1/x.pdf'],
    ['http://localhost:9000/cabinet-medical/patients/p1/x.pdf', 'patients/p1/x.pdf'],
    [
      'https://autre.domaine/files/cabinets/c1/patients/p1/x.pdf',
      'cabinets/c1/patients/p1/x.pdf',
    ],
    ['cabinets/c1/patients/p1/x.pdf', 'cabinets/c1/patients/p1/x.pdf'],
    ['http://ancien.serveur/files/autre/y.pdf', 'autre/y.pdf'],
  ])('%s -> %s', (url, cle) => {
    expect(service.extractKey(url)).toBe(cle);
  });

  it.each(['', 'http://autre.domaine/', 'http://autre.domaine/files/y.pdf', 'http://'])(
    'une URL sans clé valide (%j) donne 404',
    (url) => {
      expect(() => service.extractKey(url)).toThrow(NotFoundException);
    },
  );
});
