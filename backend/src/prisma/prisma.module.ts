import { Global, Module } from '@nestjs/common';
import { PrismaSansFiltre, PrismaService } from './prisma.service';
import { creerClientFiltre } from './client-filtre';

@Global()
@Module({
  providers: [
    PrismaSansFiltre,
    {
      provide: PrismaService,
      useFactory: (base: PrismaSansFiltre) => creerClientFiltre(base),
      inject: [PrismaSansFiltre],
    },
  ],
  exports: [PrismaSansFiltre, PrismaService],
})
export class PrismaModule {}
