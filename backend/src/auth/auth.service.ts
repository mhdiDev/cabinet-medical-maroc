import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
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

    const valid = await argon2.verify(user.motDePasse, ancienMdp);
    if (!valid) throw new UnauthorizedException('Ancien mot de passe incorrect');

    const hash = await argon2.hash(nouveauMdp);
    await this.prisma.user.update({ where: { id: userId }, data: { motDePasse: hash } });
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
