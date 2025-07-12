import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { PromiedosService } from '../promiedos.service';

interface GameResult {
  id: string;
  scores: number[];
  scorers?: {
    local?: string;
    visitor?: string;
  };
  status: {
    enum: number; // 1=Programado, 2=En vivo, 3=Finalizado
  };
}

interface PronosticPrediction {
  scores: number[];
  scorers?: {
    local?: string;
    visitor?: string;
  };
}

interface PointsConfiguration {
  exactResult: number; // 3 puntos
  onlyResult: number; // 1 punto
  scorerLocal: number; // 5 puntos por goleador local
  scorerVisitor: number; // 5 puntos por goleador visitante
}

type PointType = 'exact' | 'result' | 'scorers' | 'exact+scorers' | 'result+scorers' | 'none';

@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);

  // Configuración de puntos (por ahora hardcodeado, luego configurable por torneo)
  private readonly pointsConfig: PointsConfiguration = {
    exactResult: 3,
    onlyResult: 1,
    scorerLocal: 5,
    scorerVisitor: 5,
  };

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => PromiedosService))
    private readonly promiedosService: PromiedosService,
  ) {}

  /**
   * Procesa todos los partidos (en vivo y finalizados) y calcula puntos
   * Este es el método principal que ejecutará el cron job
   */
  async processFinishedMatches(): Promise<{
    processedCount: number;
    processedMatches: number;
    totalMatches: number;
    matchday: number;
    liveProcessedCount: number;
    liveProcessedMatches: number;
    // Detalles granulares para auditoría
    userPointsDetails: Array<{
      userId: number;
      userName: string;
      gameId: string;
      predictedScores: number[];
      realScores: number[];
      pointsAwarded: number;
      pointType: PointType;
      tournamentsAffected: number[];
      isLive: boolean;
    }>;
    gamesProcessed: Array<{
      gameId: string;
      realScores: number[];
      pronosticsCount: number;
      pointsDistributed: number;
      isLive: boolean;
    }>;
  }> {
    this.logger.log(
      '🔍 Iniciando procesamiento de partidos (en vivo y finalizados)...',
    );

    try {
      // Obtener la fecha actual automáticamente
      const currentMatchdayData = await this.promiedosService.getMatchday();
      const currentMatchday = currentMatchdayData.round;

      this.logger.log(`📅 Procesando fecha ${currentMatchday}`);

      // Filtrar partidos finalizados (status.enum === 3)
      const finishedGames = currentMatchdayData.games.filter(
        (game: GameResult) => game.status.enum === 3,
      );

      // Filtrar partidos en vivo (status.enum === 2)
      const liveGames = currentMatchdayData.games.filter(
        (game: GameResult) => game.status.enum === 2,
      );

      const totalMatches = currentMatchdayData.games.length;

      // Arrays para auditoría detallada
      const userPointsDetails = [];
      const gamesProcessed = [];

      let totalProcessed = 0;
      let processedMatches = 0;
      let liveProcessedCount = 0;
      let liveProcessedMatches = 0;

      // 1. Procesar partidos en vivo primero
      if (liveGames.length > 0) {
        this.logger.log(`🔴 Encontrados ${liveGames.length} partidos en vivo`);

        for (const game of liveGames) {
          const gameResult = await this.processLiveGamePronosticsDetailed(
            game,
            currentMatchday,
          );

          if (gameResult.processedCount > 0) {
            liveProcessedMatches++;

            // Agregar detalles del juego
            gamesProcessed.push({
              gameId: game.id,
              realScores: game.scores,
              pronosticsCount: gameResult.processedCount,
              pointsDistributed: gameResult.userDetails.reduce(
                (sum, detail) => sum + detail.pointsAwarded,
                0,
              ),
              isLive: true,
            });

            // Agregar detalles de usuarios
            userPointsDetails.push(...gameResult.userDetails);
          }

          liveProcessedCount += gameResult.processedCount;
        }
      }

      // 2. Procesar partidos finalizados
      if (finishedGames.length > 0) {
        this.logger.log(
          `🏁 Encontrados ${finishedGames.length} partidos finalizados`,
        );

        for (const game of finishedGames) {
          const gameResult = await this.processGamePronosticsDetailed(
            game,
            currentMatchday,
          );

          if (gameResult.processedCount > 0) {
            processedMatches++;

            // Agregar detalles del juego
            gamesProcessed.push({
              gameId: game.id,
              realScores: game.scores,
              pronosticsCount: gameResult.processedCount,
              pointsDistributed: gameResult.userDetails.reduce(
                (sum, detail) => sum + detail.pointsAwarded,
                0,
              ),
              isLive: false,
            });

            // Agregar detalles de usuarios
            userPointsDetails.push(...gameResult.userDetails);
          }

          totalProcessed += gameResult.processedCount;
        }
      }

      // Log del resultado
      if (liveProcessedCount > 0) {
        this.logger.log(
          `🔴 Procesamiento en vivo: ${liveProcessedCount} pronósticos actualizados`,
        );
      }
      if (totalProcessed > 0) {
        this.logger.log(
          `🏁 Procesamiento final: ${totalProcessed} pronósticos procesados`,
        );
      }
      if (liveProcessedCount === 0 && totalProcessed === 0) {
        this.logger.log('⏸️ No hay partidos para procesar');
      }

      this.logger.log(
        `📊 Detalles: ${userPointsDetails.length} usuarios afectados en ${gamesProcessed.length} partidos`,
      );

      return {
        processedCount: totalProcessed,
        processedMatches,
        totalMatches,
        matchday: currentMatchday,
        liveProcessedCount,
        liveProcessedMatches,
        userPointsDetails,
        gamesProcessed,
      };
    } catch (error) {
      this.logger.error('❌ Error procesando partidos:', error);
      throw error;
    }
  }

  /**
   * Procesa los pronósticos de un partido específico con detalles granulares
   */
  private async processGamePronosticsDetailed(
    game: GameResult,
    matchday: number,
  ): Promise<{
    processedCount: number;
    userDetails: Array<{
      userId: number;
      userName: string;
      gameId: string;
      predictedScores: number[];
      realScores: number[];
      pointsAwarded: number;
      pointType: PointType;
      tournamentsAffected: number[];
      isLive: boolean;
    }>;
  }> {
    // Buscar pronósticos no procesados para este partido
    const unprocessedPronostics = await this.prisma.pronostic.findMany({
      where: {
        externalId: game.id,
        processed: false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const userDetails = [];

    if (unprocessedPronostics.length === 0) {
      this.logger.debug(
        `⏭️ No hay pronósticos sin procesar para partido ${game.id}`,
      );
      return {
        processedCount: 0,
        userDetails,
      };
    }

    this.logger.log(
      `🎯 Procesando ${unprocessedPronostics.length} pronósticos para partido ${game.id}`,
    );

    let processedCount = 0;

    for (const pronostic of unprocessedPronostics) {
      try {
        const prediction =
          pronostic.prediction as unknown as PronosticPrediction;
        const points = this.calculatePoints(
          game.scores, 
          prediction.scores,
          game.scorers,
          prediction.scorers
        );
        const pointType = this.getPointType(
          game.scores, 
          prediction.scores,
          game.scorers,
          prediction.scorers
        );

        this.logger.debug(
          `👤 ${pronostic.user.name}: Pronóstico ${JSON.stringify(prediction.scores)} vs Real ${JSON.stringify(game.scores)} = ${points} puntos`,
        );

        // Buscar todos los torneos donde participa este usuario
        const userTournaments =
          await this.prisma.tournamentParticipant.findMany({
            where: { userId: pronostic.userId },
            select: { tournamentId: true },
          });

        const tournamentsAffected = userTournaments.map((t) => t.tournamentId);

        // Actualizar puntos en todos los torneos del usuario
        for (const tournament of userTournaments) {
          await this.updateUserPointsInTournament(
            tournament.tournamentId,
            pronostic.userId,
            matchday,
            points,
          );
        }

        // Marcar pronóstico como procesado y resetear puntos temporales
        await this.prisma.pronostic.update({
          where: { id: pronostic.id },
          data: {
            processed: true,
            livePoints: 0, // Resetear puntos temporales al finalizar
          },
        });

        // Agregar detalles del usuario para auditoría
        userDetails.push({
          userId: pronostic.userId,
          userName: pronostic.user.name,
          gameId: game.id,
          predictedScores: prediction.scores,
          realScores: game.scores,
          pointsAwarded: points,
          pointType,
          tournamentsAffected,
          isLive: false,
        });

        processedCount++;
      } catch (error) {
        this.logger.error(
          `❌ Error procesando pronóstico ${pronostic.id}:`,
          error,
        );
      }
    }

    return {
      processedCount,
      userDetails,
    };
  }

  /**
   * Procesa los pronósticos de un partido EN VIVO con detalles granulares
   * A diferencia de los partidos finalizados, aquí se actualizan los puntos temporalmente
   */
  private async processLiveGamePronosticsDetailed(
    game: GameResult,
    matchday: number,
  ): Promise<{
    processedCount: number;
    userDetails: Array<{
      userId: number;
      userName: string;
      gameId: string;
      predictedScores: number[];
      realScores: number[];
      pointsAwarded: number;
      pointType: PointType;
      tournamentsAffected: number[];
      isLive: boolean;
    }>;
  }> {
    // Buscar pronósticos para este partido (no importa si están procesados o no)
    const livePronostics = await this.prisma.pronostic.findMany({
      where: {
        externalId: game.id,
        processed: false, // Solo los que no están finalizados
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const userDetails = [];

    if (livePronostics.length === 0) {
      this.logger.debug(
        `⏭️ No hay pronósticos activos para partido en vivo ${game.id}`,
      );
      return {
        processedCount: 0,
        userDetails,
      };
    }

    this.logger.log(
      `🔴 Procesando ${livePronostics.length} pronósticos para partido en vivo ${game.id}`,
    );

    let processedCount = 0;

    for (const pronostic of livePronostics) {
      try {
        const prediction =
          pronostic.prediction as unknown as PronosticPrediction;
        const newPoints = this.calculatePoints(
          game.scores, 
          prediction.scores,
          game.scorers,
          prediction.scorers
        );
        const pointType = this.getPointType(
          game.scores, 
          prediction.scores,
          game.scorers,
          prediction.scorers
        );
        const previousLivePoints = pronostic.livePoints;

        // Calcular la diferencia de puntos
        const pointsDifference = newPoints - previousLivePoints;

        this.logger.debug(
          `👤 ${pronostic.user.name}: Pronóstico ${JSON.stringify(prediction.scores)} vs Real ${JSON.stringify(game.scores)} = ${newPoints} puntos (anterior: ${previousLivePoints}, diferencia: ${pointsDifference})`,
        );

        // Solo actualizar si hay cambios en los puntos
        if (pointsDifference !== 0) {
          // Buscar todos los torneos donde participa este usuario
          const userTournaments =
            await this.prisma.tournamentParticipant.findMany({
              where: { userId: pronostic.userId },
              select: { tournamentId: true },
            });

          const tournamentsAffected = userTournaments.map(
            (t) => t.tournamentId,
          );

          // Actualizar puntos en todos los torneos del usuario
          for (const tournament of userTournaments) {
            await this.updateUserPointsInTournament(
              tournament.tournamentId,
              pronostic.userId,
              matchday,
              pointsDifference, // Solo la diferencia
            );
          }

          // Actualizar los puntos temporales en el pronóstico
          await this.prisma.pronostic.update({
            where: { id: pronostic.id },
            data: { livePoints: newPoints },
          });

          // Agregar detalles del usuario para auditoría
          userDetails.push({
            userId: pronostic.userId,
            userName: pronostic.user.name,
            gameId: game.id,
            predictedScores: prediction.scores,
            realScores: game.scores,
            pointsAwarded: pointsDifference, // La diferencia, no el total
            pointType,
            tournamentsAffected,
            isLive: true,
          });

          processedCount++;
        }
      } catch (error) {
        this.logger.error(
          `❌ Error procesando pronóstico en vivo ${pronostic.id}:`,
          error,
        );
      }
    }

    return {
      processedCount,
      userDetails,
    };
  }

  /**
   * Calcula los puntos comparando pronóstico vs resultado real
   */
  private calculatePoints(
    realScores: number[],
    predictedScores: number[],
    realScorers?: { local?: string; visitor?: string },
    predictedScorers?: { local?: string; visitor?: string },
  ): number {
    if (
      !realScores ||
      !predictedScores ||
      realScores.length !== 2 ||
      predictedScores.length !== 2
    ) {
      return 0;
    }

    let totalPoints = 0;

    const realResult = this.getMatchResult(realScores);
    const predictedResult = this.getMatchResult(predictedScores);

    // Resultado exacto (scores exactos)
    if (
      realScores[0] === predictedScores[0] &&
      realScores[1] === predictedScores[1]
    ) {
      this.logger.debug(
        `🎯 Resultado exacto: ${this.pointsConfig.exactResult} puntos`,
      );
      totalPoints += this.pointsConfig.exactResult;
    }
    // Solo resultado (ganador/empate correcto)
    else if (realResult === predictedResult) {
      this.logger.debug(
        `⚽ Solo resultado: ${this.pointsConfig.onlyResult} punto`,
      );
      totalPoints += this.pointsConfig.onlyResult;
    }

    // Calcular puntos por goleadores
    if (realScorers && predictedScorers) {
      // Goleador local
      if (
        realScorers.local &&
        predictedScorers.local &&
        realScorers.local.toLowerCase() === predictedScorers.local.toLowerCase()
      ) {
        this.logger.debug(
          `⚽ Goleador local acertado: ${this.pointsConfig.scorerLocal} puntos`,
        );
        totalPoints += this.pointsConfig.scorerLocal;
      }

      // Goleador visitante
      if (
        realScorers.visitor &&
        predictedScorers.visitor &&
        realScorers.visitor.toLowerCase() === predictedScorers.visitor.toLowerCase()
      ) {
        this.logger.debug(
          `⚽ Goleador visitante acertado: ${this.pointsConfig.scorerVisitor} puntos`,
        );
        totalPoints += this.pointsConfig.scorerVisitor;
      }
    }

    if (totalPoints === 0) {
      this.logger.debug(`❌ Sin puntos`);
    } else {
      this.logger.debug(`💰 Total: ${totalPoints} puntos`);
    }

    return totalPoints;
  }

  /**
   * Determina el resultado de un partido: 'home', 'away', o 'draw'
   */
  private getMatchResult(scores: number[]): string {
    if (scores[0] > scores[1]) return 'home';
    if (scores[1] > scores[0]) return 'away';
    return 'draw';
  }

  /**
   * Determina el tipo de puntos obtenidos
   */
  private getPointType(
    realScores: number[],
    predictedScores: number[],
    realScorers?: { local?: string; visitor?: string },
    predictedScorers?: { local?: string; visitor?: string },
  ): PointType {
    if (
      !realScores ||
      !predictedScores ||
      realScores.length !== 2 ||
      predictedScores.length !== 2
    ) {
      return 'none';
    }

    const realResult = this.getMatchResult(realScores);
    const predictedResult = this.getMatchResult(predictedScores);
    
    let hasScorersPoints = false;
    
    // Verificar si hay puntos por goleadores
    if (realScorers && predictedScorers) {
      const localScorerCorrect = 
        realScorers.local &&
        predictedScorers.local &&
        realScorers.local.toLowerCase() === predictedScorers.local.toLowerCase();
        
      const visitorScorerCorrect = 
        realScorers.visitor &&
        predictedScorers.visitor &&
        realScorers.visitor.toLowerCase() === predictedScorers.visitor.toLowerCase();
        
      hasScorersPoints = localScorerCorrect || visitorScorerCorrect;
    }

    // Resultado exacto
    if (
      realScores[0] === predictedScores[0] &&
      realScores[1] === predictedScores[1]
    ) {
      return hasScorersPoints ? 'exact+scorers' : 'exact';
    }

    // Solo resultado
    if (realResult === predictedResult) {
      return hasScorersPoints ? 'result+scorers' : 'result';
    }

    // Solo goleadores
    if (hasScorersPoints) {
      return 'scorers';
    }

    return 'none';
  }

  /**
   * Actualiza los puntos de un usuario en un torneo específico
   */
  private async updateUserPointsInTournament(
    tournamentId: number,
    userId: number,
    matchday: number,
    points: number,
  ): Promise<void> {
    if (points === 0) return; // No actualizar si no obtuvo puntos

    // Upsert en MatchdayPoints (puntos por fecha)
    await this.prisma.matchdayPoints.upsert({
      where: {
        tournamentId_userId_matchday: {
          tournamentId,
          userId,
          matchday,
        },
      },
      update: {
        points: { increment: points },
        updatedAt: new Date(),
      },
      create: {
        tournamentId,
        userId,
        matchday,
        points,
      },
    });

    // Actualizar puntos acumulativos en TournamentParticipant
    await this.prisma.tournamentParticipant.update({
      where: {
        tournamentId_userId: {
          tournamentId,
          userId,
        },
      },
      data: {
        points: { increment: points },
        updatedAt: new Date(),
      },
    });

    this.logger.debug(
      `📊 Puntos actualizados: Usuario ${userId}, Torneo ${tournamentId}, Fecha ${matchday}, +${points} puntos`,
    );
  }

  /**
   * Obtiene el ranking de una fecha específica de un torneo
   */
  async getMatchdayRanking(
    tournamentId: number,
    matchday: number,
  ): Promise<any[]> {
    const ranking = await this.prisma.matchdayPoints.findMany({
      where: {
        tournamentId,
        matchday,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: [
        { points: 'desc' },
        { createdAt: 'asc' }, // Desempate por quien hizo pronósticos primero
      ],
    });

    return ranking.map((entry, index) => ({
      position: index + 1,
      user: entry.user,
      points: entry.points,
      matchday: entry.matchday,
    }));
  }

  /**
   * Obtiene el ranking acumulativo de un torneo
   */
  async getTournamentRanking(tournamentId: number): Promise<any[]> {
    const ranking = await this.prisma.tournamentParticipant.findMany({
      where: { tournamentId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: [
        { points: 'desc' },
        { joinedAt: 'asc' }, // Desempate por quien se unió primero
      ],
    });

    return ranking.map((participant, index) => ({
      position: index + 1,
      user: participant.user,
      points: participant.points,
      joinedAt: participant.joinedAt,
    }));
  }

  /**
   * Verifica si hay partidos programados para hoy
   * (Para la lógica del cron inteligente)
   */
  async hasMatchesToday(): Promise<boolean> {
    try {
      const currentMatchdayData = await this.promiedosService.getMatchday();
      const today = new Date();

      // Verificar si algún partido es hoy
      const hasGamesToday = currentMatchdayData.games.some((game: any) => {
        if (!game.start_time) return false;

        // Parsear fecha del formato "13-07-2025 21:00"
        const [datePart] = game.start_time.split(' ');
        const [day, month, year] = datePart.split('-');
        const gameDate = new Date(`${year}-${month}-${day}`);

        return (
          gameDate.getDate() === today.getDate() &&
          gameDate.getMonth() === today.getMonth() &&
          gameDate.getFullYear() === today.getFullYear()
        );
      });

      this.logger.log(`📅 ¿Hay partidos hoy? ${hasGamesToday ? 'SÍ' : 'NO'}`);
      return hasGamesToday;
    } catch (error) {
      this.logger.error('❌ Error verificando partidos de hoy:', error);
      return false;
    }
  }
}
