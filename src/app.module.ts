import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PronosticModule } from './pronostic/pronostic.module';
import { UsersModule } from './users/users.module';
import { ExternalApiModule } from './external-api/external-api.module';
import { AuthModule } from './auth/auth.module';
import { TournamentModule } from './tournament/tournament.module';
import { AdminModule } from './admin/admin.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PronosticModule,
    UsersModule,
    ExternalApiModule,
    AuthModule,
    TournamentModule,
    AdminModule,
    MonitoringModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
