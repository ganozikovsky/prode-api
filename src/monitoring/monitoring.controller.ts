import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CronAuditService } from '../external-api/services/cron-audit.service';
import { MatchdaySchedulerService } from '../external-api/services/matchday-scheduler.service';

@ApiTags('monitoring')
@Controller('monitoring')
export class MonitoringController {
  constructor(
    private readonly cronAudit: CronAuditService,
    private readonly scheduler: MatchdaySchedulerService,
  ) {}

  @Get('cron-jobs/stats')
  @ApiOperation({
    summary: 'Estadísticas de ejecuciones de cron jobs',
    description:
      'Obtiene estadísticas de rendimiento y éxito de los cron jobs en las últimas horas',
  })
  @ApiQuery({
    name: 'hours',
    required: false,
    description: 'Horas hacia atrás para analizar (default: 24)',
    example: 24,
  })
  @ApiQuery({
    name: 'jobName',
    required: false,
    description: 'Filtrar por nombre de cron job específico',
    example: 'update-current-matchday',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas de cron jobs',
    schema: {
      example: {
        totalExecutions: 12,
        successfulExecutions: 11,
        failedExecutions: 1,
        successRate: 91.67,
        averageExecutionTime: 1250,
        lastExecution: {
          id: 123,
          jobName: 'update-current-matchday',
          status: 'completed',
          startedAt: '2025-01-15T18:00:00.000Z',
          executionTimeMs: 1100,
        },
        recentFailures: [
          {
            id: 120,
            jobName: 'process-points-dynamic',
            startedAt: '2025-01-15T15:30:00.000Z',
            errorMessage: 'Connection timeout',
            executionTimeMs: 5000,
          },
        ],
      },
    },
  })
  async getCronJobStats(
    @Query('hours', new DefaultValuePipe(24), ParseIntPipe) hours: number,
    @Query('jobName') jobName?: string,
  ) {
    const stats = await this.cronAudit.getExecutionStats(jobName, hours);

    return {
      ...stats,
      successRate:
        stats.totalExecutions > 0
          ? Math.round(
              (stats.successfulExecutions / stats.totalExecutions) * 100 * 100,
            ) / 100
          : 0,
      timeframe: `${hours} horas`,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('cron-jobs/history')
  @ApiOperation({
    summary: 'Historial detallado de ejecuciones',
    description: 'Obtiene el historial detallado de ejecuciones de cron jobs',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Límite de registros a devolver (default: 50)',
    example: 50,
  })
  @ApiQuery({
    name: 'jobName',
    required: false,
    description: 'Filtrar por nombre de cron job específico',
    example: 'update-current-matchday',
  })
  @ApiResponse({
    status: 200,
    description: 'Historial de ejecuciones',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        example: {
          id: 123,
          jobName: 'update-current-matchday',
          status: 'completed',
          startedAt: '2025-01-15T18:00:00.000Z',
          completedAt: '2025-01-15T18:00:01.100Z',
          executionTimeMs: 1100,
          previousValue: '3',
          newValue: '4',
          recordsAffected: 1,
          hasChanges: true,
          isRunning: false,
          hostInfo: 'web.1-dyno',
        },
      },
    },
  })
  async getCronJobHistory(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('jobName') jobName?: string,
  ) {
    return this.cronAudit.getExecutionHistory(jobName, limit);
  }

  @Get('cron-jobs/status')
  @ApiOperation({
    summary: 'Estado actual de los cron jobs',
    description:
      'Obtiene el estado actual de todos los cron jobs y su configuración',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado actual de cron jobs',
    schema: {
      example: {
        scheduledJobs: [
          {
            name: 'update-current-matchday',
            schedule: '0 6,18 * * *',
            timezone: 'America/Argentina/Buenos_Aires',
            enabled: true,
            nextExecution: '2025-01-16T06:00:00.000Z',
          },
          {
            name: 'check-matches-today',
            schedule: '0 11 * * *',
            timezone: 'America/Argentina/Buenos_Aires',
            enabled: true,
            nextExecution: '2025-01-16T11:00:00.000Z',
          },
        ],
        dynamicJobs: [
          {
            name: 'process-points-dynamic',
            isActive: true,
            schedule: 'cada 5 min (15:00-01:00)',
            description: 'Procesando puntos cada 5 min (15:00-01:00)',
          },
        ],
        timestamp: '2025-01-15T20:30:00.000Z',
      },
    },
  })
  async getCronJobStatus() {
    const schedulerStats = await this.scheduler.getSchedulerStats();
    const pointsStatus = this.scheduler.getPointsProcessingStatus();

    return {
      scheduledJobs: [
        {
          name: 'update-current-matchday',
          schedule: '0 6,18 * * *',
          timezone: 'America/Argentina/Buenos_Aires',
          enabled: true,
          nextExecution: schedulerStats.nextExecution,
          lastExecution: schedulerStats.lastExecution,
        },
        {
          name: 'check-matches-today',
          schedule: '0 11 * * *',
          timezone: 'America/Argentina/Buenos_Aires',
          enabled: true,
          nextExecution: this.calculateNext11AM(),
        },
      ],
      dynamicJobs: [pointsStatus],
      currentMatchday: {
        value: schedulerStats.currentMatchday,
        updatedBy: schedulerStats.updatedBy,
        lastUpdate: schedulerStats.lastExecution,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('cron-jobs/execute/:jobName')
  @ApiOperation({
    summary: 'Ejecutar cron job manualmente (solo para testing)',
    description:
      'Ejecuta un cron job específico manualmente para propósitos de testing',
  })
  @ApiParam({
    name: 'jobName',
    description: 'Nombre del cron job a ejecutar',
    example: 'update-current-matchday',
  })
  @ApiResponse({
    status: 200,
    description: 'Cron job ejecutado exitosamente',
  })
  async executeJob(@Param('jobName') jobName: string) {
    switch (jobName) {
      case 'update-current-matchday':
        await this.scheduler.executeCronJobManually();
        return { message: `✅ Cron job '${jobName}' ejecutado manualmente` };

      case 'check-matches-today':
        await this.scheduler.checkMatchesTodayCronJob();
        return { message: `✅ Cron job '${jobName}' ejecutado manualmente` };

      default:
        return { error: `❌ Cron job '${jobName}' no encontrado` };
    }
  }

  private calculateNext11AM(): string {
    const now = new Date();
    const next11AM = new Date(now);
    next11AM.setHours(11, 0, 0, 0);

    if (now.getHours() >= 11) {
      next11AM.setDate(next11AM.getDate() + 1);
    }

    return next11AM.toISOString();
  }
}
