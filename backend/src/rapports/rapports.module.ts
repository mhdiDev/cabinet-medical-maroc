import { Module } from '@nestjs/common';
import { RapportsController } from './rapports.controller';
import { RapportsService } from './rapports.service';

@Module({
  controllers: [RapportsController],
  providers: [RapportsService],
})
export class RapportsModule {}
