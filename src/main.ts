try {
  require('../newrelic');
} catch (error) {
  console.error('Error al importar newrelic:', error);
}
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  // Aplicar filtro global de excepciones de Prisma
  app.useGlobalFilters(new PrismaExceptionFilter());

  // Puerto para Heroku
  const port = process.env.PORT || 3000;

  // Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('Prode API')
    .addBearerAuth()
    .setDescription('API para sistema de pronósticos deportivos')
    .setVersion('1.0')
    .addTag('users', 'Operaciones relacionadas con usuarios')
    .addTag('pronostics', 'Operaciones relacionadas con pronósticos')
    .addTag('external-api', 'Operaciones con APIs externas')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
  console.log(`🚀 Aplicación corriendo en http://localhost:${port}`);
}
bootstrap();
