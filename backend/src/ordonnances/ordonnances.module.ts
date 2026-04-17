import { Module } from '@nestjs/common';
import { OrdonnancesController } from './ordonnances.controller';
import { OrdonnancesService } from './ordonnances.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [OrdonnancesController],
  providers: [OrdonnancesService],
})
export class OrdonnancesModule {}
