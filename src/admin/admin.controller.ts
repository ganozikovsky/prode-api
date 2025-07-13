import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import * as os from 'os';
import { PromiedosService } from '../external-api/promiedos.service';
import { MatchdaySchedulerService } from '../external-api/services/matchday-scheduler.service';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly promiedosService: PromiedosService,
    private readonly scheduler: MatchdaySchedulerService,
  ) {}

  @Get('refresh-current-round')
  @ApiOperation({
    summary: '🔄 Forzar recálculo de current_matchday',
    description:
      'Ejecuta manualmente la lógica pesada de cálculo de fecha actual y actualiza la base de datos. ' +
      'Útil cuando sabes que hubo cambios importantes en los horarios de partidos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Recálculo ejecutado correctamente',
    schema: {
      example: {
        success: true,
        previousRound: 4,
        newRound: 5,
        updatedBy: 'manual',
        timestamp: '2025-01-15T14:30:00Z',
        executionTimeMs: 2847,
      },
    },
  })
  async refreshCurrentRound() {
    return await this.promiedosService.refreshCurrentMatchday('manual');
  }

  @Get('points/process-now')
  @ApiOperation({
    summary: '🎲 Procesar puntos manualmente',
    description:
      'Ejecuta inmediatamente el procesamiento de puntos para partidos finalizados. ' +
      'Útil para testing o cuando necesitas forzar el cálculo de puntos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Procesamiento de puntos ejecutado',
    schema: {
      example: {
        success: true,
        message: 'Procesamiento de puntos completado',
        timestamp: '2025-01-15T16:45:00Z',
      },
    },
  })
  async processPointsManually() {
    try {
      await this.promiedosService.executePointsProcessingManually();
      return {
        success: true,
        message: 'Procesamiento de puntos completado',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('points/activate')
  @ApiOperation({
    summary: '🔋 Activar procesamiento automático de puntos',
    description:
      'Activa manualmente el sistema de procesamiento automático de puntos ' +
      '(15:00-01:00, cada 5 minutos). Útil para testing.',
  })
  @ApiResponse({
    status: 200,
    description: 'Procesamiento automático activado',
  })
  async activatePointsProcessing() {
    try {
      await this.promiedosService.forceActivatePointsProcessing();
      return {
        success: true,
        message: 'Procesamiento automático de puntos ACTIVADO',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('points/deactivate')
  @ApiOperation({
    summary: '🛑 Desactivar procesamiento automático de puntos',
    description:
      'Desactiva manualmente el sistema de procesamiento automático de puntos. ' +
      'Útil para testing o mantenimiento.',
  })
  @ApiResponse({
    status: 200,
    description: 'Procesamiento automático desactivado',
  })
  async deactivatePointsProcessing() {
    try {
      await this.promiedosService.forceDeactivatePointsProcessing();
      return {
        success: true,
        message: 'Procesamiento automático de puntos DESACTIVADO',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('points/status')
  @ApiOperation({
    summary: '📊 Estado del sistema de puntos',
    description:
      'Obtiene información sobre el estado actual del sistema de procesamiento de puntos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado del sistema de puntos',
    schema: {
      example: {
        pointsProcessing: {
          isActive: true,
          cronName: 'process-points-dynamic',
          description: 'Procesando puntos cada 5 min (15:00-01:00)',
        },
        hasMatchesToday: true,
        timestamp: '2025-01-15T16:45:00Z',
      },
    },
  })
  async getPointsSystemStatus() {
    try {
      const status = await this.promiedosService.getPointsProcessingStatus();
      const hasMatchesToday = await this.promiedosService.hasMatchesToday();

      return {
        pointsProcessing: status,
        hasMatchesToday,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('timezone-diagnosis')
  @ApiOperation({
    summary: '🔍 Diagnóstico de timezone del servidor',
    description:
      'Muestra información detallada sobre horarios y timezone del servidor para debugging',
  })
  async getTimezoneDiagnosis() {
    const now = new Date();

    return {
      server: {
        hostname: os.hostname(),
        platform: process.platform,
        nodeVersion: process.version,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        processEnvTZ: process.env.TZ || 'not set',
      },
      timestamps: {
        utc: now.toISOString(),
        local: now.toString(),
        argentina: now.toLocaleString('es-AR', {
          timeZone: 'America/Argentina/Buenos_Aires',
          dateStyle: 'full',
          timeStyle: 'full',
        }),
        utcOffset: now.getTimezoneOffset(),
      },
      cronSchedule: {
        updateCurrentMatchday: '0 6,18 * * *',
        checkMatchesToday: '0 11 * * *',
        configuredTimezone: 'America/Argentina/Buenos_Aires',
      },
      nextCronExecutions: await this.calculateNextCronExecutions(),
    };
  }

  @Get('scheduler-info')
  @ApiOperation({
    summary: '📊 Información del scheduler',
    description:
      'Obtiene información del scheduler y próximas ejecuciones de cron jobs',
  })
  async getSchedulerInfo() {
    const schedulerStats = await this.scheduler.getSchedulerStats();
    const pointsStatus = this.scheduler.getPointsProcessingStatus();

    return {
      schedulerStats,
      pointsStatus,
      cronJobs: {
        updateCurrentMatchday: {
          schedule: '0 6,18 * * *',
          timezone: 'America/Argentina/Buenos_Aires',
          description: 'Actualiza current_matchday cada 12 horas',
        },
        checkMatchesToday: {
          schedule: '0 11 * * *',
          timezone: 'America/Argentina/Buenos_Aires',
          description: 'Verifica si hay partidos hoy y activa procesamiento',
        },
        processPointsEvery5min: {
          schedule: '*/5 15-23,0-1 * * *',
          timezone: 'America/Argentina/Buenos_Aires',
          description: 'Procesa puntos cada 5 min entre 15:00-01:00 (dinámico)',
          isActive: pointsStatus.isActive,
          exists: pointsStatus.cronJobExists,
        },
      },
    };
  }

  /**
   * 📅 Calcula las próximas ejecuciones de cron jobs
   */
  private async calculateNextCronExecutions() {
    const now = new Date();

    // Convertir a timezone de Argentina
    const argentinaTime = new Date(
      now.toLocaleString('en-US', {
        timeZone: 'America/Argentina/Buenos_Aires',
      }),
    );

    // Próximas ejecuciones de update-current-matchday (6:00 y 18:00)
    const today6am = new Date(argentinaTime);
    today6am.setHours(6, 0, 0, 0);
    const today6pm = new Date(argentinaTime);
    today6pm.setHours(18, 0, 0, 0);
    const tomorrow6am = new Date(argentinaTime);
    tomorrow6am.setDate(tomorrow6am.getDate() + 1);
    tomorrow6am.setHours(6, 0, 0, 0);

    let nextUpdateMatchday;
    if (argentinaTime < today6am) {
      nextUpdateMatchday = today6am;
    } else if (argentinaTime < today6pm) {
      nextUpdateMatchday = today6pm;
    } else {
      nextUpdateMatchday = tomorrow6am;
    }

    // Próxima ejecución de check-matches-today (11:00)
    const today11am = new Date(argentinaTime);
    today11am.setHours(11, 0, 0, 0);
    const tomorrow11am = new Date(argentinaTime);
    tomorrow11am.setDate(tomorrow11am.getDate() + 1);
    tomorrow11am.setHours(11, 0, 0, 0);

    const nextCheckMatches =
      argentinaTime < today11am ? today11am : tomorrow11am;

    return {
      currentTimeArgentina: argentinaTime.toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        dateStyle: 'full',
        timeStyle: 'full',
      }),
      nextUpdateCurrentMatchday: {
        argentina: nextUpdateMatchday.toLocaleString('es-AR', {
          timeZone: 'America/Argentina/Buenos_Aires',
          dateStyle: 'full',
          timeStyle: 'full',
        }),
        utc: nextUpdateMatchday.toISOString(),
        local: nextUpdateMatchday.toString(),
      },
      nextCheckMatches: {
        argentina: nextCheckMatches.toLocaleString('es-AR', {
          timeZone: 'America/Argentina/Buenos_Aires',
          dateStyle: 'full',
          timeStyle: 'full',
        }),
        utc: nextCheckMatches.toISOString(),
        local: nextCheckMatches.toString(),
      },
    };
  }
}
