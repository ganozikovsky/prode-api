import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import axios from 'axios';
import { PronosticService } from '../pronostic/pronostic.service';
import { MatchdayRepositoryService } from './services/matchday-repository.service';
import { MatchdaySchedulerService } from './services/matchday-scheduler.service';
import { MatchdayCacheService } from './services/matchday-cache.service';
import { PointsService } from './services/points.service';
import {
  Game,
  GameWithPronostics,
  MatchdayResponse,
  PromiedosApiResponse,
} from './interfaces/game.interface';
import * as Sentry from '@sentry/node';

@Injectable()
export class PromiedosService {
  private readonly baseUrl = 'https://api.promiedos.com.ar';
  private readonly logger = new Logger(PromiedosService.name);

  constructor(
    private readonly pronosticService: PronosticService,
    private readonly repository: MatchdayRepositoryService,
    private readonly scheduler: MatchdaySchedulerService,
    private readonly cacheService: MatchdayCacheService,
    @Inject(forwardRef(() => PointsService))
    private readonly pointsService: PointsService,
  ) {}

  // ==========================================
  // 🎯 API PÚBLICA PRINCIPAL
  // ==========================================

  /**
   * 🆕 Obtiene la fecha actual desde la base de datos (método público rápido)
   */
  async getCurrentRound(): Promise<number> {
    try {
      const currentRound = await this.repository.getCurrentMatchday();

      if (currentRound === null) {
        this.logger.warn(
          '⚠️ current_matchday no encontrado en DB, iniciando recálculo automático...',
        );
        // Primera vez - calcular y guardar
        const result =
          await this.scheduler.refreshCurrentMatchday('auto_calculated');
        return result.newRound;
      }

      return currentRound;
    } catch (error) {
      this.logger.error(
        `❌ Error obteniendo current_matchday: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * 🔄 Fuerza recálculo del current_matchday y lo guarda en DB
   */
  async refreshCurrentMatchday(updatedBy: string = 'manual') {
    return await this.scheduler.refreshCurrentMatchday(updatedBy);
  }

  /**
   * 📊 Obtiene metadatos del current_matchday
   */
  async getCurrentMatchdayMetadata() {
    return await this.repository.getCurrentMatchdayMetadata();
  }

  // ==========================================
  // 📡 API EXTERNA - PARTIDOS Y PRONÓSTICOS
  // ==========================================

  /**
   * 📅 Obtiene los partidos de una fecha con pronósticos (optimizado con cache)
   */
  async getMatchday(roundId?: number): Promise<MatchdayResponse> {
    try {
      // 🎯 Si no se proporciona roundId, usar la fecha actual
      const finalRoundId = roundId || (await this.getCurrentRound());

      this.logger.log(
        `📅 Obteniendo datos de fecha ${finalRoundId}${roundId ? ' (especificada)' : ' (calculada)'}`,
      );

      // 1. Obtener datos de la API externa
      const { data }: { data: PromiedosApiResponse } = await axios.get(
        `${this.baseUrl}/league/games/hc/72_224_8_${finalRoundId}`,
      );

      this.logger.log(
        `✅ Datos obtenidos de Promiedos para fecha ${finalRoundId}`,
      );

      // 2. Obtener pronósticos desde cache (optimizado)
      const pronosticsMap =
        await this.cacheService.getMatchdayPronostics(finalRoundId);

      // 3. Enriquecer games con pronósticos (sin queries adicionales)
      const gamesWithPronostics: GameWithPronostics[] = data.games.map(
        (game: Game) => {
          const pronostics = pronosticsMap.get(game.id) || [];

          return {
            ...game,
            pronostics,
            totalPronostics: pronostics.length,
          };
        },
      );

      const totalPronostics = gamesWithPronostics.reduce(
        (total, game) => total + game.totalPronostics,
        0,
      );

      if (totalPronostics === 0) {
        this.logger.warn(
          `⚠️ No se pudieron obtener pronósticos para la fecha ${finalRoundId}`,
        );
      }

      return {
        round: finalRoundId,
        roundName: data.games[0]?.stage_round_name || `Fecha ${finalRoundId}`,
        totalGames: data.games.length,
        games: gamesWithPronostics,
        externalIdPattern: `72_224_8_${finalRoundId}`,
        databaseStatus: totalPronostics > 0 ? 'available' : 'unavailable',
      };
    } catch (error) {
      Sentry.withScope((scope) => {
        scope.setTag('service', 'promiedos');
        scope.setContext('matchday', { roundId });
        scope.setLevel('error');
        Sentry.captureException(error);
      });

      this.logger.error(
        `❌ Error crítico en API externa para fecha ${roundId}: ${error.message}`,
      );
      throw new Error(
        `Error al obtener datos de la fecha ${roundId}: ${error.message}`,
      );
    }
  }

  /**
   * 🏟️ Obtiene la URL del escudo de un equipo
   */
  async getTeamCrest(teamId: string, size: number = 1) {
    const validSizes = [1, 2, 3, 4, 5];
    const finalSize = validSizes.includes(size) ? size : 1;

    return {
      teamId,
      size: finalSize,
      url: `${this.baseUrl}/images/team/${teamId}/${finalSize}`,
      directUrl: `https://api.promiedos.com.ar/images/team/${teamId}/${finalSize}`,
    };
  }

  // ==========================================
  // 📊 ESTADÍSTICAS Y MONITOREO
  // ==========================================

  /**
   * 🔍 Obtiene estadísticas del sistema de matchday
   */
  async getSystemStats() {
    try {
      const schedulerStats = await this.scheduler.getSchedulerStats();
      const hasMatchday = await this.repository.hasCurrentMatchday();

      return {
        system: {
          hasCurrentMatchday: hasMatchday,
          status: hasMatchday ? 'configured' : 'not_configured',
        },
        scheduler: schedulerStats,
        lastUpdate: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `❌ Error obteniendo stats del sistema: ${error.message}`,
      );
      throw error;
    }
  }

  // ==========================================
  // 🔧 MÉTODOS ADMINISTRATIVOS (DELEGATES)
  // ==========================================

  /**
   * 🧪 Ejecuta cron job manualmente (para testing)
   */
  async executeCronJobManually() {
    return await this.scheduler.executeCronJobManually();
  }

  /**
   * 🗑️ Elimina configuración de current_matchday (para testing/reset)
   */
  async resetCurrentMatchday() {
    await this.repository.deleteCurrentMatchday();
    this.logger.log('🗑️ current_matchday reseteado completamente');
  }

  /**
   * 📜 Obtiene historial de cambios
   */
  async getCurrentMatchdayHistory() {
    return await this.repository.getCurrentMatchdayHistory();
  }

  // ==========================================
  // 🎯 MÉTODOS SISTEMA DE PUNTOS (DELEGATES)
  // ==========================================

  /**
   * 🎲 Ejecuta procesamiento de puntos manualmente
   */
  async executePointsProcessingManually() {
    return await this.scheduler.executePointsProcessingManually();
  }

  /**
   * 🔋 Activa procesamiento automático de puntos
   */
  async forceActivatePointsProcessing() {
    return await this.scheduler.forceActivatePointsProcessing();
  }

  /**
   * 🛑 Desactiva procesamiento automático de puntos
   */
  async forceDeactivatePointsProcessing() {
    return await this.scheduler.forceDeactivatePointsProcessing();
  }

  /**
   * 📊 Obtiene estado del sistema de puntos
   */
  async getPointsProcessingStatus() {
    return this.scheduler.getPointsProcessingStatus();
  }

  /**
   * 📅 Verifica si hay partidos hoy
   */
  async hasMatchesToday() {
    return await this.pointsService.hasMatchesToday();
  }
}
