import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PronosticModule } from './pronostic/pronostic.module';
import { UsersModule } from './users/users.module';
import { ExternalApiModule } from './external-api/external-api.module';
import { PrismaService } from './prisma.service';

@Module({
  imports: [PronosticModule, UsersModule, ExternalApiModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
