import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private audit: AuditService,
  ) {}

  async validateUser(email: string, motDePasse: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.actif) return null;

    // Vérification sécurisée avec argon2 (résistant timing attacks)
    const valid = await argon2.verify(user.motDePasse, motDePasse);
    if (!valid) return null;

    const { motDePasse: _, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.motDePasse);
    if (!user) {
      this.logger.warn(`Tentative de connexion échouée pour: ${loginDto.email}`);
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    this.logger.log(`Connexion réussie: ${user.email} (${user.role})`);
    return { user, ...tokens };
  }

  async refreshToken(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      // Suppression du token expiré
      if (stored) await this.prisma.refreshToken.delete({ where: { token: refreshToken } });
      throw new UnauthorizedException('Token de rafraîchissement invalide ou expiré');
    }

    const { user } = stored;
    await this.prisma.refreshToken.delete({ where: { token: refreshToken } });

    return this.generateTokens(user.id, user.email, user.role);
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  async createUser(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email déjà utilisé');

    const hash = await argon2.hash(dto.motDePasse);
    const user = await this.prisma.user.create({
      data: { ...dto, motDePasse: hash },
      select: { id: true, email: true, nom: true, prenom: true, role: true, createdAt: true },
    });

    return user;
  }

  async changePassword(userId: string, ancienMdp: string, nouveauMdp: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    // 400 et non 401 : un 401 déclencherait le refresh/déconnexion côté frontend
    const valid = await argon2.verify(user.motDePasse, ancienMdp);
    if (!valid) throw new BadRequestException('Ancien mot de passe incorrect');

    if (ancienMdp === nouveauMdp) {
      throw new BadRequestException('Le nouveau mot de passe doit être différent de l\'ancien');
    }

    const hash = await argon2.hash(nouveauMdp);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { motDePasse: hash, doitChangerMdp: false },
      }),
      // Révoque toutes les sessions (une nouvelle est ouverte pour l'appelant ci-dessous)
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);

    await this.audit.log(userId, 'CHANGE_PASSWORD', 'User', userId);

    return this.generateTokens(user.id, user.email, user.role);
  }

  async listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true, nom: true, prenom: true, email: true, role: true,
        actif: true, doitChangerMdp: true, createdAt: true,
      },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });
  }

  async resetPassword(adminId: string, userId: string, nouveauMdp: string) {
    if (adminId === userId) {
      throw new BadRequestException('Utilisez « Mon compte » pour changer votre propre mot de passe');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    const hash = await argon2.hash(nouveauMdp);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { motDePasse: hash, doitChangerMdp: true },
      }),
      // Révoque toutes les sessions
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);
    await this.audit.log(adminId, 'RESET_PASSWORD', 'User', userId);

    return { success: true };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const accessToken = this.jwt.sign(payload);

    // Refresh token stocké en base pour invalidation possible
    const refreshToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: { token: refreshToken, userId, expiresAt },
    });

    return { accessToken, refreshToken };
  }
}
