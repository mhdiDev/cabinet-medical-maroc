import * as argon2 from 'argon2';
import { creerSuperAdmin } from './creer-super-admin';

const prismaFactice = () => ({
  user: {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'sa1', ...data })),
  },
  auditLog: { create: jest.fn().mockResolvedValue({}) },
});

describe('creerSuperAdmin', () => {
  it('crée un SUPER_ADMIN sans cabinet, avec un mot de passe généré à changer', async () => {
    const prisma = prismaFactice();
    const res = await creerSuperAdmin(prisma as any, ['  Admin@Plateforme.MA ', 'Sara', 'Idrissi']);

    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      email: 'admin@plateforme.ma',
      prenom: 'Sara',
      nom: 'Idrissi',
      role: 'SUPER_ADMIN',
      cabinetId: null,
      estTitulaire: false,
      doitChangerMdp: true,
    });
    expect(res.email).toBe('admin@plateforme.ma');
    expect(res.motDePasse).toHaveLength(12);
    expect(await argon2.verify(data.motDePasse, res.motDePasse)).toBe(true);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: { userId: null, action: 'CREATE_SUPER_ADMIN', entite: 'User', entiteId: 'sa1' },
    });
  });

  it.each([
    [[]],
    [['admin@plateforme.ma', 'Sara']],
    [['pas-un-email', 'Sara', 'Idrissi']],
    [['admin@plateforme.ma', '  ', 'Idrissi']],
  ])('refuse des arguments invalides %j sans rien créer', async (args) => {
    const prisma = prismaFactice();
    await expect(creerSuperAdmin(prisma as any, args)).rejects.toThrow('Usage');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('refuse un email déjà utilisé', async () => {
    const prisma = prismaFactice();
    prisma.user.findUnique.mockResolvedValue({ id: 'x' });
    await expect(
      creerSuperAdmin(prisma as any, ['admin@plateforme.ma', 'Sara', 'Idrissi']),
    ).rejects.toThrow('Email déjà utilisé');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
