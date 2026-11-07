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
    ['https://autre.domaine/files/cabinets/c1/patients/p1/x.pdf', 'cabinets/c1/patients/p1/x.pdf'],
    ['http://h/files/patients/p1/mon%20fichier.pdf', 'patients/p1/mon fichier.pdf'],
    ['http://h/files/patients/p1%2Fx.pdf', 'patients/p1/x.pdf'],
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

describe('MinioService.uploadFile', () => {
  const service = new MinioService();
  const putObject = jest.fn().mockReturnValue({ promise: () => Promise.resolve({}) });

  beforeAll(() => {
    service.onModuleInit();
    (service as any).s3 = { putObject };
  });

  const fichier = (originalname: string, mimetype: string) =>
    ({ originalname, mimetype, buffer: Buffer.from('x') }) as Express.Multer.File;

  it.each(['a.pdf?x', 'a.pdf#x', 'a.100%', 'a.pdf'])(
    'déduit l’extension du type, pas du nom (%s)',
    async (nom) => {
      const cle = await service.uploadFile(fichier(nom, 'application/pdf'), 'patients/p1');
      expect(cle).toMatch(/^patients\/p1\/[0-9a-f-]{36}\.pdf$/);
      expect(service.extractKey(service.getPublicUrl(cle))).toBe(cle);
    },
  );

  it.each([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/gif', 'gif'],
    ['image/webp', 'webp'],
    ['application/pdf', 'pdf'],
    ['text/plain', 'bin'],
  ])('%s -> .%s', async (type, ext) => {
    const cle = await service.uploadFile(fichier('x.zzz', type), 'patients/p1');
    expect(cle.endsWith(`.${ext}`)).toBe(true);
  });
});
