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

    const maxRoundsToCheck = 16;
    let lastValidRound = 1;

    for (let roundId = 1; roundId <= maxRoundsToCheck; roundId++) {
      try {
        const roundData = await this.getRawMatchday(roundId);

        if (!roundData.games || roundData.games.length === 0) {
          this.logger.warn(`⚠️ Fecha ${roundId} sin partidos válidos`);
          continue;
        }

        const roundAnalysis = this.analyzeRoundGames(roundData.games, roundId);

        if (!roundAnalysis.isValid) {
          this.logger.warn(
            `⚪ Fecha ${roundId} tiene información genérica/incompleta, usando última válida: ${lastValidRound}`,
          );
          return lastValidRound;
        }

        lastValidRound = roundId;

        const currentRoundResult =
          await this.evaluateCurrentRound(roundAnalysis);
        if (currentRoundResult !== null) {
          return currentRoundResult;
        }

        if (roundAnalysis.isComplete) {
          this.logger.debug(
            `🟢 Fecha ${roundId} completamente terminada, verificando siguiente...`,
          );
          continue;
        }

        // Caso no contemplado, usar esta fecha por seguridad
        this.logger.log(
          `🤔 Caso especial en fecha ${roundId}, usando como actual`,
        );
        return roundId;
      } catch (error) {
        const errorResult = this.handleCalculationError(
          error,
          roundId,
          lastValidRound,
        );
        if (errorResult !== null) {
          return errorResult;
        }
        continue;
      }
    }

    return this.getFallbackRound(lastValidRound);
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
   * 📊 Analiza los datos de una fecha específica (método optimizado)
   */
  private analyzeRoundGames(
    games: any[],
    roundId: number,
  ): {
    roundId: number;
    totalGames: number;
    finishedGames: number;
    liveGames: number;
    scheduledGames: number;
    isValid: boolean;
    isComplete: boolean;
    hasLiveGames: boolean;
  } {
    const hasValidData = this.validator.isRoundDataValid(games);

    const finishedGames = games.filter(
      (game) => game.status.enum === 3 || game.status.name === 'Finalizado',
    ).length;

    const liveGames = games.filter(
      (game) => game.status.enum === 2 || game.status.name === 'En Vivo',
    ).length;

    const scheduledGames = games.filter(
      (game) => game.status.enum === 1 || game.status.name === 'Prog.',
    ).length;

    const totalGames = games.length;

    this.logger.debug(
      `📊 Fecha ${roundId}: ${finishedGames} finalizados, ${liveGames} en vivo, ${scheduledGames} programados de ${totalGames} total`,
    );

    return {
      roundId,
      totalGames,
      finishedGames,
      liveGames,
      scheduledGames,
      isValid: hasValidData,
      isComplete: finishedGames === totalGames,
      hasLiveGames: liveGames > 0,
    };
  }

  /**
   * 🎯 Evalúa si una fecha es la actual basándose en su análisis
   */
  private async evaluateCurrentRound(roundAnalysis: {
    roundId: number;
    totalGames: number;
    finishedGames: number;
    liveGames: number;
    scheduledGames: number;
    isValid: boolean;
    isComplete: boolean;
    hasLiveGames: boolean;
  }): Promise<number | null> {
    if (roundAnalysis.hasLiveGames) {
      this.logger.log(
        `🔴 Fecha actual: ${roundAnalysis.roundId} (partidos en vivo)`,
      );
      return roundAnalysis.roundId;
    }

    if (roundAnalysis.scheduledGames > 0) {
      return await this.handleScheduledRound(roundAnalysis.roundId);
    }

    return null;
  }

  /**
   * 📅 Maneja la lógica para fechas con partidos programados
   */
  private async handleScheduledRound(roundId: number): Promise<number> {
    if (roundId === 1) {
      this.logger.log(
        `🟡 Fecha actual: ${roundId} (primera fecha con partidos programados)`,
      );
      return roundId;
    }

    const previousRoundCompletion = await this.checkPreviousRoundCompletion(
      roundId - 1,
    );

    if (previousRoundCompletion.shouldUseCurrent) {
      this.logger.log(
        `🟡 Fecha actual: ${roundId} (fecha anterior completada o inválida)`,
      );
      return roundId;
    }

    this.logger.log(
      `🔄 Fecha anterior ${roundId - 1} aún no terminada, usando esa`,
    );
    return roundId - 1;
  }

  /**
   * ✅ Verifica si la fecha anterior está completamente terminada
   */
  private async checkPreviousRoundCompletion(previousRoundId: number): Promise<{
    shouldUseCurrent: boolean;
  }> {
    try {
      const previousRoundData = await this.getRawMatchday(previousRoundId);
      const previousValidData = this.validator.isRoundDataValid(
        previousRoundData.games,
      );

      if (!previousValidData) {
        return { shouldUseCurrent: true };
      }

      const previousFinished = previousRoundData.games.filter(
        (game) => game.status.enum === 3 || game.status.name === 'Finalizado',
      ).length;

      return {
        shouldUseCurrent: previousFinished === previousRoundData.games.length,
      };
    } catch (prevError) {
      this.logger.warn(
        `⚠️ Error verificando fecha anterior ${previousRoundId}: ${prevError.message}`,
      );
      return { shouldUseCurrent: true };
    }
  }

  /**
   * 🚨 Maneja errores al procesar una fecha
   */
  private handleCalculationError(
    error: any,
    roundId: number,
    lastValidRound: number,
  ): number | null {
    this.logger.warn(
      `⚠️ Error al verificar fecha ${roundId}: ${error.message}`,
    );

    Sentry.withScope((scope) => {
      scope.setTag('service', 'matchday-calculator');
      scope.setContext('round', { roundId });
      scope.setLevel('warning');
      Sentry.captureException(error);
    });

    if (roundId > 3) {
      this.logger.log(
        `📍 Error en fecha ${roundId}, usando última válida: ${lastValidRound}`,
      );
      return lastValidRound;
    }

    return null;
  }

  /**
   * 🔄 Retorna el fallback de seguridad
   */
  private getFallbackRound(lastValidRound: number): number {
    this.logger.warn(
      `⚠️ No se pudo determinar fecha automáticamente, usando última válida: ${lastValidRound}`,
    );
    return lastValidRound;
  }

  /**
   * 🎯 Analiza el estado de una fecha específica (método público)
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

      return this.analyzeRoundGames(data.games, roundId);
    } catch (error) {
      this.logger.error(
        `❌ Error analizando estado de fecha ${roundId}: ${error.message}`,
      );
      throw error;
    }
  }
}
