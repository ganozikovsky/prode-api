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
import { PromiedosService } from './promiedos.service';
import { CronAuditService } from './services/cron-audit.service';
import { MatchdaySchedulerService } from './services/matchday-scheduler.service';
import {
  GameWithPronostics,
  GroupedMatchdayResponse,
} from './interfaces/game.interface';

@ApiTags('external-api')
@Controller('promiedos')
export class PromiedosController {
  constructor(
    private readonly promiedosService: PromiedosService,
    private readonly cronAudit: CronAuditService,
    private readonly scheduler: MatchdaySchedulerService,
  ) {}

  /**
   * 📅 Función helper para parsear fechas del formato "13-07-2025 21:00"
   */
  private parseMatchDate(dateString: string): Date {
    if (!dateString) return new Date();

    const [datePart] = dateString.split(' ');
    const [day, month, year] = datePart.split('-');
    return new Date(`${year}-${month}-${day}`);
  }

  /**
   * 🗓️ Función helper para agrupar partidos por fecha
   */
  private groupMatchesByDate(
    games: GameWithPronostics[],
  ): GroupedMatchdayResponse[] {
    const groupedGames = new Map<string, GameWithPronostics[]>();

    games.forEach((game) => {
      const gameDate = this.parseMatchDate(game.start_time);
      const dateKey = gameDate.toISOString().split('T')[0]; // YYYY-MM-DD

      if (!groupedGames.has(dateKey)) {
        groupedGames.set(dateKey, []);
      }
      groupedGames.get(dateKey)!.push(game);
    });

    // Convertir a array y ordenar por fecha
    const result = Array.from(groupedGames.entries()).map(
      ([date, matches]) => ({
        date: new Date(date).toISOString(),
        matches: matches.sort((a, b) => {
          // Ordenar partidos por hora dentro de cada fecha
          const timeA = a.start_time.split(' ')[1] || '00:00';
          const timeB = b.start_time.split(' ')[1] || '00:00';
          return timeA.localeCompare(timeB);
        }),
      }),
    );

    // Ordenar por fecha
    return result.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }

  @Get('lpf/current')
  @ApiOperation({
    summary: '🎯 Obtener la fecha actual automáticamente (agrupada por fecha)',
    description:
      'Calcula automáticamente qué fecha mostrar basándose en el estado de los partidos. ' +
      'Usa inteligencia artificial para determinar si mostrar la fecha en curso, ' +
      'la próxima fecha programada, o la última fecha con información válida. ' +
      'Los partidos se devuelven agrupados por fecha de juego.',
  })
  @ApiResponse({
    status: 200,
    description: 'Datos de la fecha actual agrupados por fecha',
    schema: {
      example: [
        {
          date: '2025-07-13T00:00:00.000Z',
          matches: [
            {
              id: 'game_id_123',
              stage_round_name: 'Fecha 1',
              winner: 0,
              teams: [
                {
                  name: 'River Plate',
                  short_name: 'RIV',
                  id: 'hhij',
                  // ... otros campos
                },
              ],
              scores: [2, 1],
              status: {
                enum: 1,
                name: 'Prog.',
                short_name: 'Prog.',
                symbol_name: 'Prog.',
              },
              start_time: '13-07-2025 21:00',
              pronostics: [
                {
                  id: 1,
                  userId: 1,
                  prediction: { scores: [2, 1], scorers: ['Messi'] },
                  user: { id: 1, name: 'Juan', email: 'juan@test.com' },
                },
              ],
              totalPronostics: 5,
            },
          ],
        },
        {
          date: '2025-07-14T00:00:00.000Z',
          matches: [
            // ... más partidos
          ],
        },
      ],
    },
  })
  async getCurrentMatchday() {
    const matchdayData = await this.promiedosService.getMatchday();
    return this.groupMatchesByDate(matchdayData.games);
  }

  @Get('lpf/current/round')
  @ApiOperation({
    summary: '🧠 Obtener solo el número de fecha actual',
    description:
      'Devuelve únicamente el número de la fecha que se debería mostrar según la lógica automática',
  })
  @ApiResponse({
    status: 200,
    description: 'Número de la fecha actual',
    schema: {
      example: {
        currentRound: 1,
        reason: 'Fecha con partidos en vivo',
        timestamp: '2025-01-12T10:30:00Z',
      },
    },
  })
  async getCurrentRound() {
    const currentRound = await this.promiedosService.getCurrentRound();
    return {
      currentRound,
      reason: 'Calculado automáticamente',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('lpf/:roundId')
  @ApiOperation({
    summary: 'Obtener información completa de una fecha específica',
    description:
      'Obtiene los partidos de una fecha específica con sus pronósticos asociados',
  })
  @ApiParam({
    name: 'roundId',
    type: 'number',
    description: 'Número de la fecha/jornada (1-16)',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Datos de la fecha con pronósticos',
    schema: {
      example: {
        round: 1,
        roundName: 'Fecha 1',
        totalGames: 14,
        games: [
          {
            id: 'game_id_123',
            stage_round_name: 'Fecha 1',
            winner: 0,
            teams: [
              {
                name: 'River Plate',
                short_name: 'RIV',
                id: 'hhij',
                // ... otros campos
              },
            ],
            scores: [2, 1],
            pronostics: [
              {
                id: 1,
                userId: 1,
                prediction: { scores: [2, 1], scorers: ['Messi'] },
                user: { id: 1, name: 'Juan', email: 'juan@test.com' },
              },
            ],
            totalPronostics: 5,
          },
        ],
      },
    },
  })
  async getMatchday(@Param('roundId', ParseIntPipe) roundId: number) {
    return this.promiedosService.getMatchday(roundId);
  }

  @Get('lpf/crest/:teamId')
  @ApiOperation({
    summary: 'Obtener URL del escudo del equipo',
    description:
      'Devuelve la URL directa del escudo del equipo desde promiedos.com.ar',
  })
  @ApiParam({
    name: 'teamId',
    type: 'string',
    description: 'ID del equipo (formato string, ej: hhij)',
    example: 'hhij',
  })
  @ApiQuery({
    name: 'size',
    type: 'number',
    description: 'Tamaño de la imagen (1-5)',
    example: 1,
    required: false,
  })
  getTeamCrest(
    @Param('teamId') teamId: string,
    @Query('size') size: string = '1',
  ) {
    const sizeNumber = parseInt(size, 10) || 1;
    return this.promiedosService.getTeamCrest(teamId, sizeNumber);
  }

  // ==========================================
  // 🔧 ENDPOINTS ADMINISTRATIVOS
  // ==========================================

  @Get('admin/refresh-current-round')
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

  // ==========================================
  // 🎯 ENDPOINTS SISTEMA DE PUNTOS (TESTING)
  // ==========================================

  @Get('admin/points/process-now')
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

  @Get('admin/points/activate')
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

  @Get('admin/points/deactivate')
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

  @Get('admin/points/status')
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

  // ==========================================
  // 📊 MONITOREO DE CRON JOBS
  // ==========================================

  @Get('monitoring/cron-jobs/stats')
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

  @Get('monitoring/cron-jobs/history')
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

  @Get('monitoring/cron-jobs/status')
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

  @Get('monitoring/cron-jobs/execute/:jobName')
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
