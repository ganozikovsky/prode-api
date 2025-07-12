import './newrelic';
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

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Puerto para Heroku
  const port = process.env.PORT || 3000;

  // Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('Prode API')
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
