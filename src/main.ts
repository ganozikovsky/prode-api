import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  await app.listen(3000);
  console.log('🚀 Aplicación corriendo en http://localhost:3000');
  console.log(
    '📚 Documentación Swagger disponible en http://localhost:3000/api/docs',
  );
}
bootstrap();
