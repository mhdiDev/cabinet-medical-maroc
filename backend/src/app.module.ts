import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PatientsModule } from './patients/patients.module';
import { RendezVousModule } from './rendez-vous/rendez-vous.module';
import { ConsultationsModule } from './consultations/consultations.module';
import { OrdonnancesModule } from './ordonnances/ordonnances.module';
import { PaiementsModule } from './paiements/paiements.module';
import { StockModule } from './stock/stock.module';
import { RapportsModule } from './rapports/rapports.module';
import { AuditModule } from './audit/audit.module';
import { MedicamentsModule } from './medicaments/medicaments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DocumentsModule } from './documents/documents.module';

@Module({
  controllers: [AppController],
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    PatientsModule,
    RendezVousModule,
    ConsultationsModule,
    OrdonnancesModule,
    PaiementsModule,
    StockModule,
    RapportsModule,
    AuditModule,
    MedicamentsModule,
    NotificationsModule,
    DocumentsModule,
  ],
})
export class AppModule {}
