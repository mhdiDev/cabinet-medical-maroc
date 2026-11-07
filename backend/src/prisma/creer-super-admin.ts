// Crée un compte SUPER_ADMIN. Sur le serveur :
//   docker exec cabinet_backend node dist/prisma/creer-super-admin.js <email> <prénom> <nom>
import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { isEmail } from 'class-validator';
import { genererMotDePasse } from '../auth/generer-mot-de-passe';

const USAGE = 'Usage : node dist/prisma/creer-super-admin.js <email> <prénom> <nom>';

type Client = Pick<PrismaClient, 'user' | 'auditLog'>;

export async function creerSuperAdmin(prisma: Client, args: string[]) {
  const [emailBrut, prenomBrut, nomBrut] = args;
  const email = (emailBrut ?? '').trim().toLowerCase();
  const prenom = (prenomBrut ?? '').trim();
  const nom = (nomBrut ?? '').trim();
  if (!isEmail(email) || !prenom || !nom) throw new Error(USAGE);

  if (await prisma.user.findUnique({ where: { email } })) {
    throw new Error(`Email déjà utilisé : ${email}`);
  }

  const motDePasse = genererMotDePasse();
  const user = await prisma.user.create({
    data: {
      email,
      prenom,
      nom,
      role: Role.SUPER_ADMIN,
      cabinetId: null,
      estTitulaire: false,
      doitChangerMdp: true,
      motDePasse: await argon2.hash(motDePasse),
    },
  });
  await prisma.auditLog.create({
    data: { userId: null, action: 'CREATE_SUPER_ADMIN', entite: 'User', entiteId: user.id },
  });

  return { id: user.id, email, motDePasse };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const { email, motDePasse } = await creerSuperAdmin(prisma, process.argv.slice(2));
    console.log(`Compte SUPER_ADMIN créé : ${email}`);
    console.log(`Mot de passe initial (affiché une seule fois) : ${motDePasse}`);
    console.log('Il devra être changé à la première connexion.');
  } catch (e) {
    console.error((e as Error).message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main();
}
