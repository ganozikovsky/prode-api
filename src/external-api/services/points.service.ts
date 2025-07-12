import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { PromiedosService } from '../promiedos.service';

interface GameResult {
  id: string;
  scores: number[];
  status: {
    enum: number; // 1=Programado, 2=En vivo, 3=Finalizado
  };
}

interface PronosticPrediction {
  scores: number[];
  scorers?: string[];
}

interface PointsConfiguration {
  exactResult: number; // 3 puntos
  onlyResult: number; // 1 punto
}

type PointType = 'exact' | 'result' | 'none';

@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);

  // Configuración de puntos (por ahora hardcodeado, luego configurable por torneo)
  private readonly pointsConfig: PointsConfiguration = {
    exactResult: 3,
    onlyResult: 1,
  };

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => PromiedosService))
    private readonly promiedosService: PromiedosService,
  ) {}

  /**
   * 🔴 Procesa todos los partidos EN VIVO y calcula puntos temporales
   * Este método actualiza los puntos temporales cada minuto
   */
  async processLiveMatches(): Promise<{
    processedCount: number;
    processedMatches: number;
    totalMatches: number;
    matchday: number;
    // Detalles granulares para auditoría
    userLivePointsDetails: Array<{
      userId: number;
      userName: string;
      gameId: string;
      predictedScores: number[];
      currentScores: number[];
      livePointsAwarded: number;
      pointType: PointType;
      tournamentsAffected: number[];
    }>;
    gamesProcessed: Array<{
      gameId: string;
      currentScores: number[];
      pronosticsCount: number;
      livePointsDistributed: number;
    }>;
  }> {
    this.logger.log('🔴 Iniciando procesamiento de partidos EN VIVO...');

    try {
      // Obtener la fecha actual automáticamente
      const currentMatchdayData = await this.promiedosService.getMatchday();
      const currentMatchday = currentMatchdayData.round;

      this.logger.log(`📅 Procesando fecha ${currentMatchday} (LIVE)`);

      // Filtrar solo partidos EN VIVO (status.enum === 2)
      const liveGames = currentMatchdayData.games.filter(
        (game: GameResult) => game.status.enum === 2,
      );

      const totalMatches = currentMatchdayData.games.length;

      // Arrays para auditoría detallada
      const userLivePointsDetails = [];
      const gamesProcessed = [];

      if (liveGames.length === 0) {
        this.logger.log('⏸️ No hay partidos EN VIVO para procesar');
        // Limpiar puntos temporales si no hay partidos en vivo
        await this.clearAllLivePoints(currentMatchday);
        return {
          processedCount: 0,
          processedMatches: 0,
          totalMatches,
          matchday: currentMatchday,
          userLivePointsDetails,
          gamesProcessed,
        };
      }

      this.logger.log(`🔴 Encontrados ${liveGames.length} partidos EN VIVO`);

      let totalProcessed = 0;
      let processedMatches = 0;

      // Procesar cada partido en vivo
      for (const game of liveGames) {
        const gameResult = await this.processGameLivePointsDetailed(
          game,
          currentMatchday,
        );

        if (gameResult.processedCount > 0) {
          processedMatches++;

          // Agregar detalles del juego
          gamesProcessed.push({
            gameId: game.id,
            currentScores: game.scores,
            pronosticsCount: gameResult.processedCount,
            livePointsDistributed: gameResult.userDetails.reduce(
              (sum, detail) => sum + detail.livePointsAwarded,
              0,
            ),
          });

          // Agregar detalles de usuarios
          userLivePointsDetails.push(...gameResult.userDetails);
        }

        totalProcessed += gameResult.processedCount;
      }

      this.logger.log(
        `✅ Procesamiento LIVE completado: ${totalProcessed} pronósticos procesados`,
      );
      this.logger.log(
        `📊 Detalles LIVE: ${userLivePointsDetails.length} usuarios con puntos temporales en ${gamesProcessed.length} partidos`,
      );

      return {
        processedCount: totalProcessed,
        processedMatches,
        totalMatches,
        matchday: currentMatchday,
        userLivePointsDetails,
        gamesProcessed,
      };
    } catch (error) {
      this.logger.error('❌ Error procesando partidos EN VIVO:', error);
      throw error;
    }
  }

  /**
   * Procesa todos los partidos finalizados y calcula puntos
   * Este es el método principal que ejecutará el cron job
   */
  async processFinishedMatches(): Promise<{
    processedCount: number;
    processedMatches: number;
    totalMatches: number;
    matchday: number;
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
    }>;
    gamesProcessed: Array<{
      gameId: string;
      realScores: number[];
      pronosticsCount: number;
      pointsDistributed: number;
    }>;
  }> {
    this.logger.log('🔍 Iniciando procesamiento de partidos finalizados...');

    try {
      // Obtener la fecha actual automáticamente
      const currentMatchdayData = await this.promiedosService.getMatchday();
      const currentMatchday = currentMatchdayData.round;

      this.logger.log(`📅 Procesando fecha ${currentMatchday}`);

      // Filtrar solo partidos finalizados (status.enum === 3)
      const finishedGames = currentMatchdayData.games.filter(
        (game: GameResult) => game.status.enum === 3,
      );

      const totalMatches = currentMatchdayData.games.length;

      // Arrays para auditoría detallada
      const userPointsDetails = [];
      const gamesProcessed = [];

      if (finishedGames.length === 0) {
        this.logger.log('⏸️ No hay partidos finalizados para procesar');
        return {
          processedCount: 0,
          processedMatches: 0,
          totalMatches,
          matchday: currentMatchday,
          userPointsDetails,
          gamesProcessed,
        };
      }

      this.logger.log(
        `🏁 Encontrados ${finishedGames.length} partidos finalizados`,
      );

      let totalProcessed = 0;
      let processedMatches = 0;

      // Procesar cada partido finalizado
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
          });

          // Agregar detalles de usuarios
          userPointsDetails.push(...gameResult.userDetails);
        }

        totalProcessed += gameResult.processedCount;
      }

      this.logger.log(
        `✅ Procesamiento completado: ${totalProcessed} pronósticos procesados`,
      );
      this.logger.log(
        `📊 Detalles: ${userPointsDetails.length} usuarios recibieron puntos en ${gamesProcessed.length} partidos`,
      );

      return {
        processedCount: totalProcessed,
        processedMatches,
        totalMatches,
        matchday: currentMatchday,
        userPointsDetails,
        gamesProcessed,
      };
    } catch (error) {
      this.logger.error('❌ Error procesando partidos finalizados:', error);
      throw error;
    }
  }

  /**
   * 🔴 Procesa los pronósticos de un partido EN VIVO específico
   */
  private async processGameLivePointsDetailed(
    game: GameResult,
    matchday: number,
  ): Promise<{
    processedCount: number;
    userDetails: Array<{
      userId: number;
      userName: string;
      gameId: string;
      predictedScores: number[];
      currentScores: number[];
      livePointsAwarded: number;
      pointType: PointType;
      tournamentsAffected: number[];
    }>;
  }> {
    // Buscar TODOS los pronósticos para este partido (procesados y no procesados)
    const allPronostics = await this.prisma.pronostic.findMany({
      where: {
        externalId: game.id,
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

    if (allPronostics.length === 0) {
      this.logger.debug(
        `⏭️ No hay pronósticos para partido EN VIVO ${game.id}`,
      );
      return {
        processedCount: 0,
        userDetails,
      };
    }

    this.logger.log(
      `🔴 Procesando LIVE ${allPronostics.length} pronósticos para partido ${game.id}`,
    );

    let processedCount = 0;

    for (const pronostic of allPronostics) {
      try {
        const prediction =
          pronostic.prediction as unknown as PronosticPrediction;
        const livePoints = this.calculatePoints(game.scores, prediction.scores);
        const pointType = this.getPointType(game.scores, prediction.scores);

        this.logger.debug(
          `👤 ${pronostic.user.name} LIVE: Pronóstico ${JSON.stringify(prediction.scores)} vs Actual ${JSON.stringify(game.scores)} = ${livePoints} puntos temporales`,
        );

        // Buscar todos los torneos donde participa este usuario
        const userTournaments =
          await this.prisma.tournamentParticipant.findMany({
            where: { userId: pronostic.userId },
            select: { tournamentId: true },
          });

        const tournamentsAffected = userTournaments.map((t) => t.tournamentId);

        // Actualizar puntos TEMPORALES en todos los torneos del usuario
        for (const tournament of userTournaments) {
          await this.updateUserLivePointsInTournament(
            tournament.tournamentId,
            pronostic.userId,
            matchday,
            livePoints,
          );
        }

        // Agregar detalles del usuario para auditoría
        userDetails.push({
          userId: pronostic.userId,
          userName: pronostic.user.name,
          gameId: game.id,
          predictedScores: prediction.scores,
          currentScores: game.scores,
          livePointsAwarded: livePoints,
          pointType,
          tournamentsAffected,
        });

        processedCount++;
      } catch (error) {
        this.logger.error(
          `❌ Error procesando pronóstico LIVE ${pronostic.id}:`,
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
        const points = this.calculatePoints(game.scores, prediction.scores);
        const pointType = this.getPointType(game.scores, prediction.scores);

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

        // Marcar pronóstico como procesado
        await this.prisma.pronostic.update({
          where: { id: pronostic.id },
          data: { processed: true },
        });

        // 🧹 Limpiar puntos temporales para este partido que ya terminó
        await this.clearLivePointsForFinishedGame(
          pronostic.userId,
          matchday,
          game.id,
        );

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
   * Calcula los puntos comparando pronóstico vs resultado real
   */
  private calculatePoints(
    realScores: number[],
    predictedScores: number[],
  ): number {
    if (
      !realScores ||
      !predictedScores ||
      realScores.length !== 2 ||
      predictedScores.length !== 2
    ) {
      return 0;
    }

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
      return this.pointsConfig.exactResult;
    }

    // Solo resultado (ganador/empate correcto)
    if (realResult === predictedResult) {
      this.logger.debug(
        `⚽ Solo resultado: ${this.pointsConfig.onlyResult} punto`,
      );
      return this.pointsConfig.onlyResult;
    }

    // Sin puntos
    this.logger.debug(`❌ Sin puntos`);
    return 0;
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
   * Determina el tipo de puntos otorgados
   */
  private getPointType(
    realScores: number[],
    predictedScores: number[],
  ): PointType {
    if (
      !realScores ||
      !predictedScores ||
      realScores.length !== 2 ||
      predictedScores.length !== 2
    ) {
      return 'none';
    }

    // Resultado exacto (scores exactos)
    if (
      realScores[0] === predictedScores[0] &&
      realScores[1] === predictedScores[1]
    ) {
      return 'exact';
    }

    // Solo resultado (ganador/empate correcto)
    const realResult = this.getMatchResult(realScores);
    const predictedResult = this.getMatchResult(predictedScores);

    if (realResult === predictedResult) {
      return 'result';
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
   * 🔴 Actualiza los puntos TEMPORALES de un usuario en un torneo específico
   */
  private async updateUserLivePointsInTournament(
    tournamentId: number,
    userId: number,
    matchday: number,
    livePoints: number,
  ): Promise<void> {
    // Upsert en MatchdayPoints (puntos temporales por fecha)
    await this.prisma.matchdayPoints.upsert({
      where: {
        tournamentId_userId_matchday: {
          tournamentId,
          userId,
          matchday,
        },
      },
      update: {
        livePoints: livePoints, // Reemplazar puntos temporales
        updatedAt: new Date(),
      },
      create: {
        tournamentId,
        userId,
        matchday,
        points: 0, // Puntos definitivos siguen en 0
        livePoints: livePoints,
      },
    });

    // Calcular puntos temporales totales del usuario en este torneo
    const totalLivePoints = await this.calculateUserTotalLivePoints(
      tournamentId,
      userId,
    );

    // Actualizar puntos temporales acumulativos en TournamentParticipant
    await this.prisma.tournamentParticipant.update({
      where: {
        tournamentId_userId: {
          tournamentId,
          userId,
        },
      },
      data: {
        livePoints: totalLivePoints, // Reemplazar puntos temporales totales
        updatedAt: new Date(),
      },
    });

    this.logger.debug(
      `🔴 Puntos TEMPORALES actualizados: Usuario ${userId}, Torneo ${tournamentId}, Fecha ${matchday}, ${livePoints} puntos temporales`,
    );
  }

  /**
   * 🔴 Calcula el total de puntos temporales de un usuario en un torneo
   */
  private async calculateUserTotalLivePoints(
    tournamentId: number,
    userId: number,
  ): Promise<number> {
    const result = await this.prisma.matchdayPoints.aggregate({
      where: {
        tournamentId,
        userId,
      },
      _sum: {
        livePoints: true,
      },
    });

    return result._sum.livePoints || 0;
  }

  /**
   * 🧹 Limpia todos los puntos temporales de una fecha específica
   */
  private async clearAllLivePoints(matchday: number): Promise<void> {
    this.logger.log(`🧹 Limpiando puntos temporales de fecha ${matchday}...`);

    // Limpiar puntos temporales por fecha
    await this.prisma.matchdayPoints.updateMany({
      where: { matchday },
      data: { livePoints: 0 },
    });

    // Recalcular puntos temporales totales de todos los usuarios
    const allParticipants = await this.prisma.tournamentParticipant.findMany({
      select: { tournamentId: true, userId: true },
    });

    for (const participant of allParticipants) {
      const totalLivePoints = await this.calculateUserTotalLivePoints(
        participant.tournamentId,
        participant.userId,
      );

      await this.prisma.tournamentParticipant.update({
        where: {
          tournamentId_userId: {
            tournamentId: participant.tournamentId,
            userId: participant.userId,
          },
        },
        data: { livePoints: totalLivePoints },
      });
    }

    this.logger.log(`✅ Puntos temporales limpiados para fecha ${matchday}`);
  }

  /**
   * 🧹 Limpia puntos temporales de un partido específico que terminó
   */
  private async clearLivePointsForFinishedGame(
    userId: number,
    matchday: number,
    gameId: string,
  ): Promise<void> {
    this.logger.debug(
      `🧹 Limpiando puntos temporales del partido ${gameId} para usuario ${userId}...`,
    );

    // Obtener todos los torneos del usuario
    const userTournaments = await this.prisma.tournamentParticipant.findMany({
      where: { userId },
      select: { tournamentId: true },
    });

    for (const tournament of userTournaments) {
      // Limpiar puntos temporales de esta fecha para este usuario
      await this.prisma.matchdayPoints.updateMany({
        where: {
          tournamentId: tournament.tournamentId,
          userId,
          matchday,
        },
        data: { livePoints: 0 },
      });

      // Recalcular puntos temporales totales del usuario en este torneo
      const totalLivePoints = await this.calculateUserTotalLivePoints(
        tournament.tournamentId,
        userId,
      );

      // Actualizar puntos temporales acumulativos
      await this.prisma.tournamentParticipant.update({
        where: {
          tournamentId_userId: {
            tournamentId: tournament.tournamentId,
            userId,
          },
        },
        data: { livePoints: totalLivePoints },
      });
    }
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
    });

    // Calcular puntos totales (definitivos + temporales) y ordenar
    const rankingWithTotalPoints = ranking
      .map((entry) => ({
        user: entry.user,
        points: entry.points,
        livePoints: entry.livePoints,
        totalPoints: entry.points + entry.livePoints, // Puntos definitivos + temporales
        matchday: entry.matchday,
        createdAt: entry.createdAt,
      }))
      .sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) {
          return b.totalPoints - a.totalPoints; // Ordenar por puntos totales descendente
        }
        return a.createdAt.getTime() - b.createdAt.getTime(); // Desempate por quien hizo pronósticos primero
      });

    return rankingWithTotalPoints.map((entry, index) => ({
      position: index + 1,
      user: entry.user,
      points: entry.points, // Puntos definitivos
      livePoints: entry.livePoints, // Puntos temporales
      totalPoints: entry.totalPoints, // Total combinado
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
    });

    // Calcular puntos totales (definitivos + temporales) y ordenar
    const rankingWithTotalPoints = ranking
      .map((participant) => ({
        user: participant.user,
        points: participant.points,
        livePoints: participant.livePoints,
        totalPoints: participant.points + participant.livePoints, // Puntos definitivos + temporales
        joinedAt: participant.joinedAt,
      }))
      .sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) {
          return b.totalPoints - a.totalPoints; // Ordenar por puntos totales descendente
        }
        return a.joinedAt.getTime() - b.joinedAt.getTime(); // Desempate por quien se unió primero
      });

    return rankingWithTotalPoints.map((participant, index) => ({
      position: index + 1,
      user: participant.user,
      points: participant.points, // Puntos definitivos
      livePoints: participant.livePoints, // Puntos temporales
      totalPoints: participant.totalPoints, // Total combinado
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
