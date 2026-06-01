import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // Sécurité HTTP headers
  app.use(helmet());
  app.use(compression());

  // Préfixe global API
  app.setGlobalPrefix('api');

  // Validation globale des DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Documentation Swagger
  const config = new DocumentBuilder()
    .setTitle('Cabinet Médical API')
    .setDescription('API de gestion de cabinet médical au Maroc')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentification')
    .addTag('patients', 'Gestion des patients')
    .addTag('rendez-vous', 'Gestion des rendez-vous')
    .addTag('consultations', 'Gestion des consultations')
    .addTag('ordonnances', 'Gestion des ordonnances')
    .addTag('paiements', 'Gestion des paiements')
    .addTag('stock', 'Gestion du stock')
    .addTag('rapports', 'Rapports et statistiques')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Application démarrée sur http://localhost:${port}`);
  logger.log(`📚 Swagger disponible sur http://localhost:${port}/api/docs`);
}

bootstrap();
