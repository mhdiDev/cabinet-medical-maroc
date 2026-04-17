import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async log(
    userId: string | null,
    action: string,
    entite: string,
    entiteId?: string,
    details?: any,
    ipAddress?: string,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          entite,
          entiteId,
          details: details ? JSON.parse(JSON.stringify(details)) : undefined,
          ipAddress,
        },
      });
    } catch (err) {
      // L'audit ne doit pas faire échouer l'opération principale
      this.logger.error(`Erreur audit log: ${err.message}`);
    }
  }
}
