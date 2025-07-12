import '../newrelic';
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
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configurar validación global
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  // Configurar CORS para el frontend
  app.enableCors({
    origin: [
      'http://localhost:3001', // React en desarrollo
      'http://localhost:5173', // Vite en desarrollo
      'http://localhost:4173', // Vite preview
      process.env.FRONTEND_URL, // Producción
    ].filter(Boolean),
    credentials: true,
  });

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
