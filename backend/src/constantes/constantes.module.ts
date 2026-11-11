import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ConstantesController } from './constantes.controller';
import { ConstantesService } from './constantes.service';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [ConstantesController],
  providers: [ConstantesService],
})
export class ConstantesModule {}
