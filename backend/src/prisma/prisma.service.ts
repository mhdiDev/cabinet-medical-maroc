import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Accès sans filtre de cabinet. Réservé à la connexion, à JwtStrategy, au contrôle
// d'unicité de l'email et aux tests : voir prisma-sans-filtre.spec.ts
@Injectable()
export class PrismaSansFiltre extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaSansFiltre.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connexion base de données établie');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

// Client de tous les services : filtré par cabinet (voir client-filtre.ts).
// L'extension ne change pas l'API, d'où ce type identique à PrismaClient.
export abstract class PrismaService extends PrismaClient {}
