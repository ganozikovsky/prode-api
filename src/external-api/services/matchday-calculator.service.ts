import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { MatchdayDataValidator } from '../validators/matchday-data.validator';
import { PromiedosApiResponse } from '../interfaces/game.interface';
import * as Sentry from '@sentry/node';

@Injectable()
export class MatchdayCalculatorService {
  private readonly baseUrl = 'https://api.promiedos.com.ar';
  private readonly logger = new Logger(MatchdayCalculatorService.name);

  constructor(private readonly validator: MatchdayDataValidator) {}

  /**
   * 🧠 Calcula automáticamente la fecha actual basándose en el estado de los partidos
   * ⚠️ MÉTODO PESADO - Solo usar en cron jobs o refresh manual
   *
   * Lógica MEJORADA para detectar actualizaciones futuras:
   * 1. Si todos los partidos están finalizados → siguiente fecha
   * 2. Si hay partidos en vivo o programados → fecha actual
   * 3. Si una fecha no tiene información válida → fecha anterior
   * 4. NUEVO: Detecta automáticamente cuando fechas futuras se actualizan
   */
  async calculateCurrentRound(): Promise<number> {
    this.logger.log('🎯 Calculando fecha actual automáticamente...');

    const maxRoundsToCheck = 16; // Aumentado para cubrir más fechas futuras
    let lastValidRound = 1;

    for (let roundId = 1; roundId <= maxRoundsToCheck; roundId++) {
      try {
        const { data }: { data: PromiedosApiResponse } = await axios.get(
          `${this.baseUrl}/league/games/hc/72_224_8_${roundId}`,
        );

        if (!data.games || data.games.length === 0) {
          this.logger.warn(`⚠️ Fecha ${roundId} sin partidos válidos`);
          continue;
        }

        // 🔍 NUEVA VALIDACIÓN: Verificar si la fecha tiene datos válidos
        const hasValidData = this.validator.isRoundDataValid(data.games);

        if (!hasValidData) {
          this.logger.warn(
            `⚪ Fecha ${roundId} tiene información genérica/incompleta, usando última válida: ${lastValidRound}`,
          );
          return lastValidRound;
        }

        // Si llegamos aquí, la fecha tiene datos válidos
        lastValidRound = roundId;

        // Analizar estados de los partidos
        const finishedGames = data.games.filter(
          (game) => game.status.enum === 3 || game.status.name === 'Finalizado',
        ).length;

        const liveGames = data.games.filter(
          (game) => game.status.enum === 2 || game.status.name === 'En Vivo',
        ).length;

        const scheduledGames = data.games.filter(
          (game) => game.status.enum === 1 || game.status.name === 'Prog.',
        ).length;

        const totalGames = data.games.length;

        this.logger.debug(
          `📊 Fecha ${roundId}: ${finishedGames} finalizados, ${liveGames} en vivo, ${scheduledGames} programados de ${totalGames} total`,
        );

        // 🔴 Si hay partidos en vivo, esta es la fecha actual
        if (liveGames > 0) {
          this.logger.log(`🔴 Fecha actual: ${roundId} (partidos en vivo)`);
          return roundId;
        }

        // 🟡 Si hay partidos programados, verificar lógica de progresión
        if (scheduledGames > 0) {
          // Si es la primera fecha o no hay partidos anteriores sin terminar
          if (roundId === 1) {
            this.logger.log(
              `🟡 Fecha actual: ${roundId} (primera fecha con partidos programados)`,
            );
            return roundId;
          }

          // Verificar si la fecha anterior está completamente terminada
          try {
            const previousRoundData = await this.getRawMatchday(roundId - 1);
            const previousValidData = this.validator.isRoundDataValid(
              previousRoundData.games,
            );

            if (!previousValidData) {
              this.logger.log(
                `🟡 Fecha actual: ${roundId} (fecha anterior sin datos válidos)`,
              );
              return roundId;
            }

            const previousFinished = previousRoundData.games.filter(
              (game) =>
                game.status.enum === 3 || game.status.name === 'Finalizado',
            ).length;

            if (previousFinished === previousRoundData.games.length) {
              this.logger.log(
                `🟡 Fecha actual: ${roundId} (fecha anterior completada)`,
              );
              return roundId;
            } else {
              this.logger.log(
                `🔄 Fecha anterior ${roundId - 1} aún no terminada, usando esa`,
              );
              return roundId - 1;
            }
          } catch (prevError) {
            this.logger.warn(
              `⚠️ Error verificando fecha anterior ${roundId - 1}: ${prevError.message}`,
            );
            return roundId;
          }
        }

        // 🟢 Si todos están terminados, continuar a la siguiente fecha
        if (finishedGames === totalGames) {
          this.logger.debug(
            `🟢 Fecha ${roundId} completamente terminada, verificando siguiente...`,
          );
          continue;
        }

        // 🤔 Caso no contemplado, usar esta fecha por seguridad
        this.logger.log(
          `🤔 Caso especial en fecha ${roundId}, usando como actual`,
        );
        return roundId;
      } catch (error) {
        this.logger.warn(
          `⚠️ Error al verificar fecha ${roundId}: ${error.message}`,
        );

        // Reportar error a Sentry para monitoreo
        Sentry.withScope((scope) => {
          scope.setTag('service', 'matchday-calculator');
          scope.setContext('round', { roundId });
          scope.setLevel('warning');
          Sentry.captureException(error);
        });

        // Si fallamos en una fecha alta, probablemente no existe
        if (roundId > 3) {
          this.logger.log(
            `📍 Error en fecha ${roundId}, usando última válida: ${lastValidRound}`,
          );
          return lastValidRound;
        }
        continue;
      }
    }

    // Fallback de seguridad
    this.logger.warn(
      `⚠️ No se pudo determinar fecha automáticamente, usando última válida: ${lastValidRound}`,
    );
    return lastValidRound;
  }

  /**
   * 📊 Obtiene datos RAW de una fecha específica (sin pronósticos)
   * Método auxiliar para calculateCurrentRound()
   */
  async getRawMatchday(roundId: number): Promise<PromiedosApiResponse> {
    try {
      const { data }: { data: PromiedosApiResponse } = await axios.get(
        `${this.baseUrl}/league/games/hc/72_224_8_${roundId}`,
      );
      return data;
    } catch (error) {
      this.logger.error(
        `❌ Error obteniendo datos RAW de fecha ${roundId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * 🎯 Analiza el estado de una fecha específica (método auxiliar)
   */
  async analyzeRoundStatus(roundId: number): Promise<{
    roundId: number;
    totalGames: number;
    finishedGames: number;
    liveGames: number;
    scheduledGames: number;
    isValid: boolean;
    isComplete: boolean;
    hasLiveGames: boolean;
  }> {
    try {
      const data = await this.getRawMatchday(roundId);

      if (!data.games || data.games.length === 0) {
        return {
          roundId,
          totalGames: 0,
          finishedGames: 0,
          liveGames: 0,
          scheduledGames: 0,
          isValid: false,
          isComplete: false,
          hasLiveGames: false,
        };
      }

      const finishedGames = data.games.filter(
        (game) => game.status.enum === 3 || game.status.name === 'Finalizado',
      ).length;

      const liveGames = data.games.filter(
        (game) => game.status.enum === 2 || game.status.name === 'En Vivo',
      ).length;

      const scheduledGames = data.games.filter(
        (game) => game.status.enum === 1 || game.status.name === 'Prog.',
      ).length;

      const totalGames = data.games.length;
      const isValid = this.validator.isRoundDataValid(data.games);
      const isComplete = finishedGames === totalGames;
      const hasLiveGames = liveGames > 0;

      return {
        roundId,
        totalGames,
        finishedGames,
        liveGames,
        scheduledGames,
        isValid,
        isComplete,
        hasLiveGames,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error analizando estado de fecha ${roundId}: ${error.message}`,
      );
      throw error;
    }
  }
}
