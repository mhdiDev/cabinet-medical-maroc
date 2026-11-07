import { Global, Module } from '@nestjs/common';
import { PrismaSansFiltre, PrismaService } from './prisma.service';
import { creerClientFiltre } from './client-filtre';
import { ReferencesService } from './references.service';

@Global()
@Module({
  providers: [
    PrismaSansFiltre,
    ReferencesService,
    {
      provide: PrismaService,
      // Le client étendu hérite de onModuleInit et onModuleDestroy : ils sont donc
      // appelés deux fois (connexion et déconnexion), sans danger.
      useFactory: (base: PrismaSansFiltre) => creerClientFiltre(base),
      inject: [PrismaSansFiltre],
    },
  ],
  exports: [PrismaSansFiltre, PrismaService, ReferencesService],
})
export class PrismaModule {}
