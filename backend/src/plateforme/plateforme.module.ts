import { Module } from '@nestjs/common';
import { PlateformeController } from './plateforme.controller';
import { PlateformeService } from './plateforme.service';

@Module({
  controllers: [PlateformeController],
  providers: [PlateformeService],
})
export class PlateformeModule {}
