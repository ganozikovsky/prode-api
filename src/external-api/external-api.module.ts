import { Module } from '@nestjs/common';
import { PromiedosService } from './promiedos.service';
import { PromiedosController } from './promiedos.controller';
import { PronosticModule } from '../pronostic/pronostic.module';
import { PrismaService } from '../prisma.service';

// Servicios modulares
import { MatchdayDataValidator } from './validators/matchday-data.validator';
import { MatchdayRepositoryService } from './services/matchday-repository.service';
import { MatchdayCalculatorService } from './services/matchday-calculator.service';
import { MatchdaySchedulerService } from './services/matchday-scheduler.service';
import { PointsService } from './services/points.service';
import { CronAuditService } from './services/cron-audit.service';

@Module({
  imports: [PronosticModule], // Importar el módulo de pronósticos
  controllers: [PromiedosController],
  providers: [
    // Servicio principal (orchestrator)
    PromiedosService,

    // Servicios de infraestructura
    PrismaService,

    // Servicios modulares especializados
    MatchdayDataValidator,
    MatchdayRepositoryService,
    MatchdayCalculatorService,
    MatchdaySchedulerService,
    PointsService,
    CronAuditService,
  ],
  exports: [
    PromiedosService,
    // Exportar servicios modulares por si otros módulos los necesitan
    MatchdayRepositoryService,
    MatchdaySchedulerService,
    PointsService,
    CronAuditService,
  ],
})
export class ExternalApiModule {}
