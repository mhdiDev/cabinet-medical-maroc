import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

const mockPrisma = {
  user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  refreshToken: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
};

const mockJwt = { sign: jest.fn().mockReturnValue('mock-token') };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('retourne l\'utilisateur si identifiants corrects', async () => {
      const hash = await argon2.hash('Password123!');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1', email: 'test@ma', motDePasse: hash,
        nom: 'Test', prenom: 'User', role: Role.MEDECIN, actif: true,
      });

      const user = await service.validateUser('test@ma', 'Password123!');
      expect(user).toBeDefined();
      expect(user.email).toBe('test@ma');
      expect(user['motDePasse']).toBeUndefined();
    });

    it('retourne null si mot de passe incorrect', async () => {
      const hash = await argon2.hash('correct-password');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1', email: 'test@ma', motDePasse: hash, actif: true,
      });

      const result = await service.validateUser('test@ma', 'wrong-password');
      expect(result).toBeNull();
    });

    it('retourne null si utilisateur inactif', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', actif: false });
      const result = await service.validateUser('test@ma', 'any');
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('lève UnauthorizedException si identifiants invalides', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login({ email: 'bad@ma', motDePasse: 'bad' })).rejects.toThrow(UnauthorizedException);
    });
  });
});
