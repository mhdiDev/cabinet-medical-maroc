import { ForbiddenException } from '@nestjs/common';
import { appliquerCabinet } from './client-filtre';
import { cabinetCourant, definirCabinet, ouvrirContexte } from './contexte-cabinet';

describe('appliquerCabinet', () => {
  const lectures = [
    'findMany',
    'findFirst',
    'findFirstOrThrow',
    'findUnique',
    'findUniqueOrThrow',
    'count',
    'aggregate',
    'groupBy',
    'delete',
    'deleteMany',
  ];

  it.each(lectures)('%s ajoute le cabinet au where', (operation) => {
    expect(appliquerCabinet(operation, { where: { id: 'x' } }, 'c1').where).toEqual({
      id: 'x',
      cabinetId: 'c1',
    });
  });

  it('accepte une opération sans argument', () => {
    expect(appliquerCabinet('findMany', undefined, 'c1').where).toEqual({ cabinetId: 'c1' });
  });

  it('un where client ne peut pas remplacer le cabinet', () => {
    const res = appliquerCabinet('findMany', { where: { cabinetId: 'autre' } }, 'c1');
    expect(res.where.cabinetId).toBe('c1');
  });

  it('create impose le cabinet', () => {
    const res = appliquerCabinet('create', { data: { nom: 'a', cabinetId: 'autre' } }, 'c1');
    expect(res.data).toEqual({ nom: 'a', cabinetId: 'c1' });
  });

  it('createMany impose le cabinet sur chaque ligne', () => {
    const res = appliquerCabinet('createMany', { data: [{ nom: 'a' }, { nom: 'b' }] }, 'c1');
    expect(res.data).toEqual([
      { nom: 'a', cabinetId: 'c1' },
      { nom: 'b', cabinetId: 'c1' },
    ]);
  });

  it.each(['update', 'updateMany'])('%s filtre et retire cabinetId de data', (operation) => {
    const res = appliquerCabinet(
      operation,
      { where: { id: 'x' }, data: { nom: 'a', cabinetId: 'autre' } },
      'c1',
    );
    expect(res.where).toEqual({ id: 'x', cabinetId: 'c1' });
    expect(res.data).toEqual({ nom: 'a' });
  });

  it('upsert filtre, impose à la création et retire à la modification', () => {
    const res = appliquerCabinet(
      'upsert',
      { where: { id: 'x' }, create: { nom: 'a' }, update: { nom: 'b', cabinetId: 'autre' } },
      'c1',
    );
    expect(res.where).toEqual({ id: 'x', cabinetId: 'c1' });
    expect(res.create).toEqual({ nom: 'a', cabinetId: 'c1' });
    expect(res.update).toEqual({ nom: 'b' });
  });

  it('refuse une opération inconnue', () => {
    expect(() => appliquerCabinet('createManyAndReturn', {}, 'c1')).toThrow(
      'Opération Prisma non gérée',
    );
  });
});

describe('contexte de cabinet', () => {
  it('refuse hors contexte', () => {
    expect(() => cabinetCourant()).toThrow(ForbiddenException);
  });

  it('refuse tant que le cabinet est inconnu', () => {
    ouvrirContexte(() => {
      expect(() => cabinetCourant()).toThrow(ForbiddenException);
    });
  });

  it('refuse un cabinet nul (SUPER_ADMIN)', () => {
    ouvrirContexte(() => {
      definirCabinet(null);
      expect(() => cabinetCourant()).toThrow(ForbiddenException);
    });
  });

  it('garde le cabinet à travers le code asynchrone', async () => {
    await ouvrirContexte(async () => {
      definirCabinet('c1');
      await new Promise((resolve) => setTimeout(resolve, 1));
      expect(cabinetCourant()).toBe('c1');
    });
  });

  it('isole deux contextes simultanés', async () => {
    const lire = (id: string) =>
      ouvrirContexte(async () => {
        definirCabinet(id);
        await new Promise((resolve) => setTimeout(resolve, 2));
        return cabinetCourant();
      });
    await expect(Promise.all([lire('a'), lire('b')])).resolves.toEqual(['a', 'b']);
  });
});
