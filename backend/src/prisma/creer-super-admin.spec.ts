import * as argon2 from 'argon2';
import { creerSuperAdmin } from './creer-super-admin';

// Le compte et son audit s'écrivent dans la transaction (tx), jamais hors d'elle
const prismaFactice = () => {
  const tx = {
    user: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'sa1', ...data })),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  return {
    tx,
    user: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn().mockImplementation((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
};

describe('creerSuperAdmin', () => {
  it('crée un SUPER_ADMIN sans cabinet, avec un mot de passe généré à changer', async () => {
    const prisma = prismaFactice();
    const res = await creerSuperAdmin(prisma as any, ['  Admin@Plateforme.MA ', 'Sara', 'Idrissi']);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const data = prisma.tx.user.create.mock.calls[0][0].data;
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
    expect(prisma.tx.auditLog.create).toHaveBeenCalledWith({
      data: { userId: null, action: 'CREATE_SUPER_ADMIN', entite: 'User', entiteId: 'sa1' },
    });
  });

  it.each([
    [[]],
    [['admin@plateforme.ma', 'Sara']],
    [['pas-un-email', 'Sara', 'Idrissi']],
    [['admin@plateforme.ma', '  ', 'Idrissi']],
    // Nom composé sans guillemets : 4 arguments, le nom serait tronqué
    [['admin@plateforme.ma', 'Sara', 'El', 'Idrissi']],
  ])('refuse des arguments invalides %j sans rien créer', async (args) => {
    const prisma = prismaFactice();
    await expect(creerSuperAdmin(prisma as any, args)).rejects.toThrow('Usage');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.tx.user.create).not.toHaveBeenCalled();
  });

  it("rappelle dans l'usage de mettre un nom composé entre guillemets", async () => {
    await expect(
      creerSuperAdmin(prismaFactice() as any, ['admin@plateforme.ma', 'Sara', 'El', 'Idrissi']),
    ).rejects.toThrow(/guillemets/);
  });

  it("n'écrit pas le compte si l'audit échoue (même transaction)", async () => {
    const prisma = prismaFactice();
    prisma.tx.auditLog.create.mockRejectedValue(new Error('audit en panne'));
    await expect(
      creerSuperAdmin(prisma as any, ['admin@plateforme.ma', 'Sara', 'Idrissi']),
    ).rejects.toThrow('audit en panne');
    expect(prisma.tx.user.create).toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('refuse un email déjà utilisé', async () => {
    const prisma = prismaFactice();
    prisma.user.findUnique.mockResolvedValue({ id: 'x' });
    await expect(
      creerSuperAdmin(prisma as any, ['admin@plateforme.ma', 'Sara', 'Idrissi']),
    ).rejects.toThrow('Email déjà utilisé');
    expect(prisma.tx.user.create).not.toHaveBeenCalled();
  });
});
