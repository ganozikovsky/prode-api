import { Injectable, Logger } from '@nestjs/common';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { MatchdayCalculatorService } from './matchday-calculator.service';
import { MatchdayRepositoryService } from './matchday-repository.service';
import { PointsService } from './points.service';
import { CronAuditService } from './cron-audit.service';
import * as Sentry from '@sentry/node';

@Injectable()
export class MatchdaySchedulerService {
  private readonly logger = new Logger(MatchdaySchedulerService.name);
  private pointsProcessingActive = false;
  private readonly POINTS_CRON_NAME = 'process-points-every-5min';

  constructor(
    private readonly calculator: MatchdayCalculatorService,
    private readonly repository: MatchdayRepositoryService,
    private readonly pointsService: PointsService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly cronAudit: CronAuditService,
  ) {}

  /**
   * 🕛 Cron job que actualiza current_matchday cada 12 horas
   * Ejecuta a las 06:00 y 18:00 todos los días
   */
  @Cron('0 6,18 * * *', {
    name: 'update-current-matchday',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  async updateCurrentMatchdayCronJob(): Promise<void> {
    const jobName = 'update-current-matchday';
    let executionId: number;

    try {
      // Iniciar auditoría
      executionId = await this.cronAudit.startExecution(jobName, {
        scheduledTime: new Date().toISOString(),
        timezone: 'America/Argentina/Buenos_Aires',
      });

      this.logger.log(
        `⏰ Ejecutando cron job: ${jobName} (ID: ${executionId})`,
      );

      // Obtener valor anterior para logging
      const previousRound = await this.repository
        .getCurrentMatchday()
        .catch(() => null);

      // Calcular nueva fecha
      const newRound = await this.calculator.calculateCurrentRound();

      // Guardar en DB
      await this.repository.saveCurrentMatchday(newRound, 'cron_job');

      const changed = previousRound !== newRound;

      // Completar auditoría exitosa
      const result = await this.cronAudit.completeExecution(executionId, {
        previousValue: previousRound?.toString(),
        newValue: newRound.toString(),
        recordsAffected: 1,
        metadata: {
          changed,
          calculatedRounds: 'auto-detection',
        },
      });

      this.logger.log(
        `✅ Cron job completado: current_matchday ${previousRound || 'null'} → ${newRound} ` +
          `(${changed ? 'CAMBIÓ' : 'sin cambios'}) - ${result.executionTimeMs}ms`,
      );

      // Log adicional si cambió la fecha
      if (changed) {
        this.logger.log(
          `🎯 FECHA ACTUALIZADA: De ${previousRound} a ${newRound} por cron job`,
        );
      }
    } catch (error) {
      this.logger.error(`❌ Error en cron job ${jobName}: ${error.message}`);

      // Marcar auditoría como fallida
      if (executionId) {
        await this.cronAudit.failExecution(executionId, error, {
          operation: 'update-current-matchday',
          phase: error.message.includes('calculate')
            ? 'calculation'
            : 'database',
        });
      }

      // Reportar a Sentry para monitoreo
      Sentry.withScope((scope) => {
        scope.setTag('service', 'matchday-scheduler');
        scope.setTag('cron_job', jobName);
        scope.setLevel('error');
        Sentry.captureException(error);
      });
    }
  }

  /**
   * 🔄 Fuerza recálculo manual del current_matchday
   */
  async refreshCurrentMatchday(updatedBy: string = 'manual'): Promise<{
    success: boolean;
    previousRound: number | null;
    newRound: number;
    updatedBy: string;
    timestamp: string;
    executionTimeMs: number;
    changed: boolean;
  }> {
    this.logger.log(
      `🔄 Forzando recálculo de current_matchday por ${updatedBy}...`,
    );

    const startTime = Date.now();

    try {
      // Obtener valor anterior para comparación
      const previousRound = await this.repository
        .getCurrentMatchday()
        .catch(() => null);

      // Calcular nueva fecha
      const newRound = await this.calculator.calculateCurrentRound();

      // Guardar en DB
      await this.repository.saveCurrentMatchday(newRound, updatedBy);

      const executionTime = Date.now() - startTime;
      const changed = previousRound !== newRound;

      this.logger.log(
        `✅ Recálculo completado: ${previousRound || 'null'} → ${newRound} ` +
          `por ${updatedBy} (${changed ? 'CAMBIÓ' : 'sin cambios'}) - ${executionTime}ms`,
      );

      return {
        success: true,
        previousRound,
        newRound,
        updatedBy,
        timestamp: new Date().toISOString(),
        executionTimeMs: executionTime,
        changed,
      };
    } catch (error) {
      this.logger.error(`❌ Error en refreshCurrentMatchday: ${error.message}`);

      // Reportar a Sentry
      Sentry.withScope((scope) => {
        scope.setTag('service', 'matchday-scheduler');
        scope.setTag('operation', 'refresh-manual');
        scope.setContext('refresh', { updatedBy });
        scope.setLevel('error');
        Sentry.captureException(error);
      });

      throw error;
    }
  }

  /**
   * 📊 Obtiene estadísticas del sistema de cron jobs
   */
  async getSchedulerStats(): Promise<{
    nextExecution: string;
    lastExecution: Date | null;
    currentMatchday: number | null;
    updatedBy: string | null;
  }> {
    try {
      // Próxima ejecución (6:00 o 18:00 Argentina)
      const now = new Date();
      const today6am = new Date(now);
      today6am.setHours(6, 0, 0, 0);
      const today6pm = new Date(now);
      today6pm.setHours(18, 0, 0, 0);
      const tomorrow6am = new Date(now);
      tomorrow6am.setDate(tomorrow6am.getDate() + 1);
      tomorrow6am.setHours(6, 0, 0, 0);

      let nextExecution: Date;
      if (now < today6am) {
        nextExecution = today6am;
      } else if (now < today6pm) {
        nextExecution = today6pm;
      } else {
        nextExecution = tomorrow6am;
      }

      // Obtener metadata actual
      const metadata = await this.repository.getCurrentMatchdayMetadata();

      return {
        nextExecution: nextExecution.toISOString(),
        lastExecution: metadata.updatedAt,
        currentMatchday: metadata.value,
        updatedBy: metadata.updatedBy,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error obteniendo stats de scheduler: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * 🧪 Método para testing: ejecutar cron job manualmente
   */
  async executeCronJobManually(): Promise<void> {
    this.logger.log('🧪 Ejecutando cron job manualmente para testing...');
    await this.updateCurrentMatchdayCronJob();
  }

  // ==========================================
  // 🎯 SISTEMA DE PUNTOS - CRON JOBS INTELIGENTES
  // ==========================================

  /**
   * 🌅 Cron job que verifica a las 11 AM si hay partidos hoy
   * Si hay partidos, activa el procesamiento de puntos de 15:00 a 01:00
   */
  @Cron('0 11 * * *', {
    name: 'check-matches-today',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  async checkMatchesTodayCronJob(): Promise<void> {
    const jobName = 'check-matches-today';
    let executionId: number;

    try {
      // Iniciar auditoría
      executionId = await this.cronAudit.startExecution(jobName, {
        scheduledTime: new Date().toISOString(),
        timezone: 'America/Argentina/Buenos_Aires',
      });

      this.logger.log(
        `🌅 Ejecutando verificación de partidos de hoy (11 AM)...`,
      );

      const hasMatches = await this.pointsService.hasMatchesToday();

      if (hasMatches) {
        this.logger.log(
          '⚽ HAY partidos hoy - Activando procesamiento de puntos',
        );
        await this.activatePointsProcessing();
      } else {
        this.logger.log(
          '😴 NO hay partidos hoy - Manteniendo procesamiento inactivo',
        );
        await this.deactivatePointsProcessing();
      }

      // Completar auditoría exitosa
      await this.cronAudit.completeExecution(executionId, {
        previousValue: 'null', // No hay valor anterior para esta verificación
        newValue: 'null', // No hay valor nuevo para esta verificación
        recordsAffected: 0, // No hay registros afectados
        metadata: {
          hasMatchesToday: hasMatches,
        },
      });
    } catch (error) {
      this.logger.error(
        `❌ Error verificando partidos de hoy: ${error.message}`,
      );

      // Marcar auditoría como fallida
      if (executionId) {
        await this.cronAudit.failExecution(executionId, error, {
          operation: 'check-matches-today',
          phase: error.message.includes('hasMatchesToday')
            ? 'check'
            : 'database',
        });
      }

      // Reportar a Sentry para monitoreo
      Sentry.withScope((scope) => {
        scope.setTag('service', 'matchday-scheduler');
        scope.setTag('cron_job', jobName);
        scope.setLevel('error');
        Sentry.captureException(error);
      });
    }
  }

  /**
   * 🎯 Activa el procesamiento dinámico de puntos (15:00 - 01:00)
   * Crea un cron job dinámico que solo existe cuando hay partidos
   */
  private async activatePointsProcessing(): Promise<void> {
    if (this.pointsProcessingActive) {
      this.logger.log('🔄 Procesamiento de puntos ya está activo');
      return;
    }

    try {
      this.pointsProcessingActive = true;

      // Crear cron job dinámico
      await this.createDynamicPointsCronJob();

      this.logger.log(
        '✅ Procesamiento de puntos ACTIVADO - Cron job dinámico creado (15:00-01:00, cada 5 min)',
      );
    } catch (error) {
      this.logger.error(
        `❌ Error activando procesamiento de puntos: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * 🛑 Desactiva el procesamiento dinámico de puntos
   * Elimina el cron job dinámico para ahorrar recursos
   */
  private async deactivatePointsProcessing(): Promise<void> {
    if (!this.pointsProcessingActive) {
      this.logger.log('⏸️ Procesamiento de puntos ya está inactivo');
      return;
    }

    try {
      this.pointsProcessingActive = false;

      // Eliminar cron job dinámico
      await this.removeDynamicPointsCronJob();

      this.logger.log(
        '🛑 Procesamiento de puntos DESACTIVADO - Cron job dinámico eliminado',
      );
    } catch (error) {
      this.logger.error(
        `❌ Error desactivando procesamiento de puntos: ${error.message}`,
      );
    }
  }

  /**
   * 🏗️ Crea un cron job dinámico para procesamiento de puntos
   * Se ejecuta cada 5 minutos entre 15:00-01:00
   */
  private async createDynamicPointsCronJob(): Promise<void> {
    const cronName = this.POINTS_CRON_NAME;

    try {
      // Verificar si ya existe
      const existingJob = this.schedulerRegistry.getCronJob(cronName);
      if (existingJob) {
        this.logger.log(
          `🔄 Cron job ${cronName} ya existe, no se creará duplicado`,
        );
        return;
      }
    } catch (error) {
      // Si no existe, continuamos para crearlo
    }

    // Crear el cron job
    const job = new CronJob(
      '*/5 15-23,0-1 * * *', // Cada 5 minutos entre 15:00-01:00
      () => {
        // Ejecutar procesamiento de puntos
        this.executeDynamicPointsProcessing().catch((error) => {
          this.logger.error(`❌ Error en cron job dinámico: ${error.message}`);
        });
      },
      null, // onComplete
      false, // no iniciar automáticamente
      'America/Argentina/Buenos_Aires', // timezone
    );

    // Registrar el cron job
    this.schedulerRegistry.addCronJob(cronName, job as any);

    // Iniciar el cron job
    job.start();

    this.logger.log(`🏗️ Cron job dinámico ${cronName} creado y iniciado`);
  }

  /**
   * 🗑️ Elimina el cron job dinámico de procesamiento de puntos
   */
  private async removeDynamicPointsCronJob(): Promise<void> {
    const cronName = this.POINTS_CRON_NAME;

    try {
      // Obtener el cron job
      const job = this.schedulerRegistry.getCronJob(cronName);

      // Detener el cron job (usando any para evitar problemas de tipos)
      (job as any).stop();

      // Eliminar del registry
      this.schedulerRegistry.deleteCronJob(cronName);

      this.logger.log(`🗑️ Cron job dinámico ${cronName} eliminado`);
    } catch (error) {
      this.logger.warn(
        `⚠️ No se pudo eliminar cron job ${cronName}: ${error.message}`,
      );
    }
  }

  /**
   * 🎲 Ejecuta el procesamiento de puntos desde el cron job dinámico
   */
  private async executeDynamicPointsProcessing(): Promise<void> {
    const jobName = 'process-points-dynamic';
    let executionId: number;

    try {
      // Iniciar auditoría
      executionId = await this.cronAudit.startExecution(jobName, {
        scheduledTime: new Date().toISOString(),
        isAutomaticExecution: true,
        activeHours: '15:00-01:00',
        isDynamicCronJob: true,
      });

      this.logger.log(
        `🎲 Ejecutando procesamiento de puntos dinámico... (ID: ${executionId})`,
      );

      const result = await this.pointsService.processFinishedMatches();

      // Completar auditoría exitosa
      await this.cronAudit.completeExecution(executionId, {
        previousValue: 'null',
        newValue: 'null',
        recordsAffected: result?.processedCount || 0,
        metadata: {
          processedMatches: result?.processedMatches || 0,
          processedPronostics: result?.processedCount || 0,
          totalMatches: result?.totalMatches || 0,
          matchday: result?.matchday || 0,
          userPointsDetails: result?.userPointsDetails || [],
          gamesProcessed: result?.gamesProcessed || [],
          summary: {
            usersAffected: result?.userPointsDetails?.length || 0,
            totalPointsAwarded:
              result?.userPointsDetails?.reduce(
                (sum, detail) => sum + detail.pointsAwarded,
                0,
              ) || 0,
            exactPredictions:
              result?.userPointsDetails?.filter(
                (detail) => detail.pointType === 'exact',
              ).length || 0,
            resultPredictions:
              result?.userPointsDetails?.filter(
                (detail) => detail.pointType === 'result',
              ).length || 0,
            failedPredictions:
              result?.userPointsDetails?.filter(
                (detail) => detail.pointType === 'none',
              ).length || 0,
          },
        },
      });

      this.logger.log('✅ Procesamiento de puntos dinámico completado');
    } catch (error) {
      this.logger.error(
        `❌ Error en procesamiento de puntos dinámico: ${error.message}`,
      );

      // Marcar auditoría como fallida
      if (executionId) {
        await this.cronAudit.failExecution(executionId, error, {
          operation: 'process-points-dynamic',
          phase: error.message.includes('processFinishedMatches')
            ? 'processing'
            : 'database',
        });
      }

      Sentry.withScope((scope) => {
        scope.setTag('service', 'matchday-scheduler');
        scope.setTag('cron_job', jobName);
        scope.setLevel('error');
        Sentry.captureException(error);
      });
    }
  }

  /**
   * 🔧 Método manual para activar procesamiento de puntos (testing)
   */
  async forceActivatePointsProcessing(): Promise<void> {
    this.logger.log('🔧 Activando procesamiento de puntos manualmente...');
    await this.activatePointsProcessing();
  }

  /**
   * 🔧 Método manual para desactivar procesamiento de puntos (testing)
   */
  async forceDeactivatePointsProcessing(): Promise<void> {
    this.logger.log('🔧 Desactivando procesamiento de puntos manualmente...');
    await this.deactivatePointsProcessing();
  }

  /**
   * 🧪 Método manual para ejecutar procesamiento de puntos inmediatamente
   */
  async executePointsProcessingManually(): Promise<void> {
    this.logger.log('🧪 Ejecutando procesamiento de puntos manualmente...');
    await this.pointsService.processFinishedMatches();
  }

  /**
   * 📊 Estado del sistema de procesamiento de puntos
   */
  getPointsProcessingStatus(): {
    isActive: boolean;
    cronName: string;
    description: string;
    cronJobExists: boolean;
  } {
    const cronJobExists = this.isDynamicCronJobRunning();

    return {
      isActive: this.pointsProcessingActive,
      cronName: this.POINTS_CRON_NAME,
      cronJobExists,
      description:
        this.pointsProcessingActive && cronJobExists
          ? 'Cron job dinámico activo cada 5 min (15:00-01:00)'
          : this.pointsProcessingActive && !cronJobExists
            ? 'Sistema activo pero cron job no existe (error)'
            : 'Sistema inactivo - Cron job dinámico no existe',
    };
  }

  /**
   * 🔍 Verifica si el cron job dinámico está realmente ejecutándose
   */
  private isDynamicCronJobRunning(): boolean {
    try {
      const job = this.schedulerRegistry.getCronJob(this.POINTS_CRON_NAME);
      // Si obtenemos el job sin error, significa que existe
      return job !== null && job !== undefined;
    } catch (error) {
      return false;
    }
  }

  /**
   * 🔧 Método para forzar sincronización del estado (útil para debugging)
   */
  async forceSyncPointsProcessingState(): Promise<{
    wasActive: boolean;
    cronJobExisted: boolean;
    action: string;
  }> {
    const wasActive = this.pointsProcessingActive;
    const cronJobExisted = this.isDynamicCronJobRunning();

    let action = 'no-action';

    if (wasActive && !cronJobExisted) {
      // Sistema dice que está activo pero no hay cron job
      await this.createDynamicPointsCronJob();
      action = 'created-missing-cron-job';
      this.logger.log('🔧 Sincronización: Creado cron job faltante');
    } else if (!wasActive && cronJobExisted) {
      // Sistema dice que está inactivo pero hay cron job
      await this.removeDynamicPointsCronJob();
      action = 'removed-orphaned-cron-job';
      this.logger.log('🔧 Sincronización: Eliminado cron job huérfano');
    }

    return {
      wasActive,
      cronJobExisted,
      action,
    };
  }

  // ==========================================
  // 🔧 MÉTODOS LEGACY
  // ==========================================

  /**
   * ⏸️ Método para pausar/simular disable del cron job (para testing)
   */
  private _cronEnabled = true;

  setCronEnabled(enabled: boolean): void {
    this._cronEnabled = enabled;
    this.logger.log(
      `🎛️ Cron job ${enabled ? 'habilitado' : 'deshabilitado'} manualmente`,
    );
  }

  isCronEnabled(): boolean {
    return this._cronEnabled;
  }

  /**
   * 🧹 Cron job semanal que limpia registros antiguos de auditoría
   * Ejecuta todos los domingos a las 02:00
   */
  @Cron('0 2 * * 0', {
    name: 'cleanup-audit-logs',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  async cleanupAuditLogsCronJob(): Promise<void> {
    const jobName = 'cleanup-audit-logs';
    let executionId: number;

    try {
      // Iniciar auditoría
      executionId = await this.cronAudit.startExecution(jobName, {
        scheduledTime: new Date().toISOString(),
        timezone: 'America/Argentina/Buenos_Aires',
        retentionDays: 30,
      });

      this.logger.log(
        `🧹 Ejecutando limpieza de logs de auditoría... (ID: ${executionId})`,
      );

      const deletedCount = await this.cronAudit.cleanupOldExecutions();

      // Completar auditoría exitosa
      await this.cronAudit.completeExecution(executionId, {
        previousValue: 'N/A',
        newValue: 'N/A',
        recordsAffected: deletedCount,
        metadata: {
          deletedRecords: deletedCount,
          retentionDays: 30,
          operation: 'cleanup',
        },
      });

      this.logger.log(
        `✅ Limpieza completada: ${deletedCount} registros eliminados`,
      );
    } catch (error) {
      this.logger.error(`❌ Error en limpieza de auditoría: ${error.message}`);

      // Marcar auditoría como fallida
      if (executionId) {
        await this.cronAudit.failExecution(executionId, error, {
          operation: 'cleanup-audit-logs',
          phase: 'database-cleanup',
        });
      }

      Sentry.withScope((scope) => {
        scope.setTag('service', 'matchday-scheduler');
        scope.setTag('cron_job', jobName);
        scope.setLevel('error');
        Sentry.captureException(error);
      });
    }
  }
}
