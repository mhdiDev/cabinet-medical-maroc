import { Global, Module } from '@nestjs/common';
import { PrismaSansFiltre, PrismaService } from './prisma.service';
import { creerClientFiltre } from './client-filtre';

@Global()
@Module({
  providers: [
    PrismaSansFiltre,
    {
      provide: PrismaService,
      // Le client étendu hérite de onModuleInit et onModuleDestroy : ils sont donc
      // appelés deux fois (connexion et déconnexion), sans danger.
      useFactory: (base: PrismaSansFiltre) => creerClientFiltre(base),
      inject: [PrismaSansFiltre],
    },
  ],
  exports: [PrismaSansFiltre, PrismaService],
})
export class PrismaModule {}
