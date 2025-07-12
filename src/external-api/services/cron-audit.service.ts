import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import * as Sentry from '@sentry/node';
import * as os from 'os';

export interface CronJobExecutionResult {
  executionId: number;
  jobName: string;
  status: 'completed' | 'failed';
  executionTimeMs: number;
  previousValue?: string;
  newValue?: string;
  recordsAffected?: number;
  metadata?: any;
  errorMessage?: string;
}

@Injectable()
export class CronAuditService {
  private readonly logger = new Logger(CronAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 🚀 Inicia el seguimiento de una ejecución de cron job
   */
  async startExecution(jobName: string, metadata?: any): Promise<number> {
    try {
      const hostInfo = `${os.hostname()}-${process.env.DYNO || 'local'}`;

      const execution = await this.prisma.cronJobExecution.create({
        data: {
          jobName,
          status: 'started',
          startedAt: new Date(),
          metadata: metadata || {},
          hostInfo,
        },
      });

      this.logger.log(`🚀 Iniciada ejecución ${execution.id} para ${jobName}`);
      return execution.id;
    } catch (error) {
      this.logger.error(`❌ Error iniciando auditoría para ${jobName}:`, error);
      throw error;
    }
  }

  /**
   * ✅ Marca una ejecución como completada exitosamente
   */
  async completeExecution(
    executionId: number,
    result: {
      previousValue?: string;
      newValue?: string;
      recordsAffected?: number;
      metadata?: any;
    },
  ): Promise<CronJobExecutionResult> {
    try {
      const execution = await this.prisma.cronJobExecution.findUnique({
        where: { id: executionId },
      });

      if (!execution) {
        throw new Error(`Ejecución ${executionId} no encontrada`);
      }

      const executionTimeMs = Date.now() - execution.startedAt.getTime();
      const hasChanges = result.previousValue !== result.newValue;

      await this.prisma.cronJobExecution.update({
        where: { id: executionId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          executionTimeMs,
          previousValue: result.previousValue,
          newValue: result.newValue,
          recordsAffected: result.recordsAffected || 0,
          metadata: {
            ...(execution.metadata && typeof execution.metadata === 'object'
              ? execution.metadata
              : {}),
            ...(result.metadata && typeof result.metadata === 'object'
              ? result.metadata
              : {}),
            hasChanges,
          },
        },
      });

      this.logger.log(
        `✅ Ejecución ${executionId} completada: ${execution.jobName} ` +
          `(${executionTimeMs}ms, cambios: ${hasChanges ? 'SÍ' : 'NO'})`,
      );

      // Reportar métricas a New Relic si está disponible
      if (global.newrelic) {
        global.newrelic.recordMetric(
          `Cron/${execution.jobName}/Duration`,
          executionTimeMs,
        );
        global.newrelic.recordMetric(`Cron/${execution.jobName}/Success`, 1);
        if (hasChanges) {
          global.newrelic.recordMetric(`Cron/${execution.jobName}/Changes`, 1);
        }
      }

      return {
        executionId,
        jobName: execution.jobName,
        status: 'completed',
        executionTimeMs,
        previousValue: result.previousValue,
        newValue: result.newValue,
        recordsAffected: result.recordsAffected,
        metadata: result.metadata,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error completando ejecución ${executionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * ❌ Marca una ejecución como fallida
   */
  async failExecution(
    executionId: number,
    error: Error,
    metadata?: any,
  ): Promise<CronJobExecutionResult> {
    try {
      const execution = await this.prisma.cronJobExecution.findUnique({
        where: { id: executionId },
      });

      if (!execution) {
        this.logger.error(
          `Ejecución ${executionId} no encontrada para marcar como fallida`,
        );
        throw new Error(`Ejecución ${executionId} no encontrada`);
      }

      const executionTimeMs = Date.now() - execution.startedAt.getTime();

      await this.prisma.cronJobExecution.update({
        where: { id: executionId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          executionTimeMs,
          errorMessage: error.message,
          metadata: {
            ...(execution.metadata && typeof execution.metadata === 'object'
              ? execution.metadata
              : {}),
            ...(metadata && typeof metadata === 'object' ? metadata : {}),
            errorStack: error.stack,
          },
        },
      });

      this.logger.error(
        `❌ Ejecución ${executionId} falló: ${execution.jobName} ` +
          `(${executionTimeMs}ms) - ${error.message}`,
      );

      // Reportar error a Sentry
      Sentry.withScope((scope) => {
        scope.setTag('service', 'cron-audit');
        scope.setTag('cron_job', execution.jobName);
        scope.setTag('execution_id', executionId);
        scope.setContext('execution', {
          jobName: execution.jobName,
          executionId,
          executionTimeMs,
          startedAt: execution.startedAt,
        });
        scope.setLevel('error');
        Sentry.captureException(error);
      });

      // Reportar métricas de error a New Relic
      if (global.newrelic) {
        global.newrelic.recordMetric(
          `Cron/${execution.jobName}/Duration`,
          executionTimeMs,
        );
        global.newrelic.recordMetric(`Cron/${execution.jobName}/Errors`, 1);
        global.newrelic.noticeError(error);
      }

      return {
        executionId,
        jobName: execution.jobName,
        status: 'failed',
        executionTimeMs,
        errorMessage: error.message,
        metadata,
      };
    } catch (auditError) {
      this.logger.error(
        `❌ Error marcando ejecución ${executionId} como fallida:`,
        auditError,
      );
      throw auditError;
    }
  }

  /**
   * 📊 Obtiene estadísticas de ejecuciones de cron jobs
   */
  async getExecutionStats(
    jobName?: string,
    hours: number = 24,
  ): Promise<{
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    lastExecution?: any;
    recentFailures: any[];
  }> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const whereClause = {
        startedAt: { gte: since },
        ...(jobName && { jobName }),
      };

      const [executions, lastExecution] = await Promise.all([
        this.prisma.cronJobExecution.findMany({
          where: whereClause,
          orderBy: { startedAt: 'desc' },
        }),
        this.prisma.cronJobExecution.findFirst({
          where: jobName ? { jobName } : {},
          orderBy: { startedAt: 'desc' },
        }),
      ]);

      const totalExecutions = executions.length;
      const successfulExecutions = executions.filter(
        (e) => e.status === 'completed',
      ).length;
      const failedExecutions = executions.filter(
        (e) => e.status === 'failed',
      ).length;

      const completedExecutions = executions.filter((e) => e.executionTimeMs);
      const averageExecutionTime =
        completedExecutions.length > 0
          ? Math.round(
              completedExecutions.reduce(
                (sum, e) => sum + (e.executionTimeMs || 0),
                0,
              ) / completedExecutions.length,
            )
          : 0;

      const recentFailures = executions
        .filter((e) => e.status === 'failed')
        .slice(0, 5)
        .map((e) => ({
          id: e.id,
          jobName: e.jobName,
          startedAt: e.startedAt,
          errorMessage: e.errorMessage,
          executionTimeMs: e.executionTimeMs,
        }));

      return {
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        averageExecutionTime,
        lastExecution,
        recentFailures,
      };
    } catch (error) {
      this.logger.error(`❌ Error obteniendo estadísticas:`, error);
      throw error;
    }
  }

  /**
   * 🔍 Obtiene historial detallado de ejecuciones
   */
  async getExecutionHistory(
    jobName?: string,
    limit: number = 50,
  ): Promise<any[]> {
    try {
      const executions = await this.prisma.cronJobExecution.findMany({
        where: jobName ? { jobName } : {},
        orderBy: { startedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          jobName: true,
          status: true,
          startedAt: true,
          completedAt: true,
          executionTimeMs: true,
          previousValue: true,
          newValue: true,
          recordsAffected: true,
          errorMessage: true,
          hostInfo: true,
        },
      });

      return executions.map((execution) => ({
        ...execution,
        hasChanges: execution.previousValue !== execution.newValue,
        isRunning: execution.status === 'started',
      }));
    } catch (error) {
      this.logger.error(`❌ Error obteniendo historial:`, error);
      throw error;
    }
  }

  /**
   * 🧹 Limpia registros antiguos (mantener solo últimos 30 días)
   */
  async cleanupOldExecutions(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const result = await this.prisma.cronJobExecution.deleteMany({
        where: {
          startedAt: { lt: thirtyDaysAgo },
        },
      });

      this.logger.log(
        `🧹 Limpieza completada: ${result.count} registros eliminados`,
      );
      return result.count;
    } catch (error) {
      this.logger.error(`❌ Error en limpieza:`, error);
      throw error;
    }
  }
}
