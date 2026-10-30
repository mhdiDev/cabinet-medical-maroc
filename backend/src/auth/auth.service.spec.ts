import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Role } from '@prisma/client';

const mockPrisma = {
  user: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  refreshToken: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
};

const mockAudit = { log: jest.fn() };

const mockJwt = { sign: jest.fn().mockReturnValue('mock-token') };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: AuditService, useValue: mockAudit },
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

  describe('changePassword', () => {
    const userAvecMdp = async (mdp: string) => ({
      id: 'u1', email: 'test@ma', role: Role.SECRETAIRE,
      motDePasse: await argon2.hash(mdp), doitChangerMdp: true,
    });

    it('lève BadRequestException si ancien mot de passe incorrect', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(await userAvecMdp('Ancien123!'));
      await expect(service.changePassword('u1', 'Faux123!', 'Nouveau123!'))
        .rejects.toThrow(BadRequestException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('lève BadRequestException si nouveau identique à l\'ancien', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(await userAvecMdp('Ancien123!'));
      await expect(service.changePassword('u1', 'Ancien123!', 'Ancien123!'))
        .rejects.toThrow(BadRequestException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si utilisateur inexistant', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.changePassword('u1', 'Ancien123!', 'Nouveau123!'))
        .rejects.toThrow(NotFoundException);
    });

    it('met à jour le hash, lève le flag, révoque les sessions et renvoie de nouveaux tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(await userAvecMdp('Ancien123!'));

      const res = await service.changePassword('u1', 'Ancien123!', 'Nouveau123!');

      const updateArg = mockPrisma.user.update.mock.calls[0][0];
      expect(updateArg.where).toEqual({ id: 'u1' });
      expect(updateArg.data.doitChangerMdp).toBe(false);
      expect(await argon2.verify(updateArg.data.motDePasse, 'Nouveau123!')).toBe(true);
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(mockAudit.log).toHaveBeenCalledWith('u1', 'CHANGE_PASSWORD', 'User', 'u1');
      expect(res.accessToken).toBe('mock-token');
      expect(res.refreshToken).toBeDefined();
    });
  });
});
