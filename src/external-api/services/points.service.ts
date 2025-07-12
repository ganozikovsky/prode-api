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
   * Procesa todos los partidos finalizados y calcula puntos
   * Este es el método principal que ejecutará el cron job
   */
  async processFinishedMatches(): Promise<{
    processedCount: number;
    processedMatches: number;
    totalMatches: number;
    matchday: number;
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

      if (finishedGames.length === 0) {
        this.logger.log('⏸️ No hay partidos finalizados para procesar');
        return {
          processedCount: 0,
          processedMatches: 0,
          totalMatches,
          matchday: currentMatchday,
        };
      }

      this.logger.log(
        `🏁 Encontrados ${finishedGames.length} partidos finalizados`,
      );

      let totalProcessed = 0;
      let processedMatches = 0;

      // Procesar cada partido finalizado
      for (const game of finishedGames) {
        const processed = await this.processGamePronostics(
          game,
          currentMatchday,
        );
        if (processed > 0) {
          processedMatches++;
        }
        totalProcessed += processed;
      }

      this.logger.log(
        `✅ Procesamiento completado: ${totalProcessed} pronósticos procesados`,
      );

      return {
        processedCount: totalProcessed,
        processedMatches,
        totalMatches,
        matchday: currentMatchday,
      };
    } catch (error) {
      this.logger.error('❌ Error procesando partidos finalizados:', error);
      throw error;
    }
  }

  /**
   * Procesa los pronósticos de un partido específico
   */
  private async processGamePronostics(
    game: GameResult,
    matchday: number,
  ): Promise<number> {
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

    if (unprocessedPronostics.length === 0) {
      this.logger.debug(
        `⏭️ No hay pronósticos sin procesar para partido ${game.id}`,
      );
      return 0;
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

        this.logger.debug(
          `👤 ${pronostic.user.name}: Pronóstico ${JSON.stringify(prediction.scores)} vs Real ${JSON.stringify(game.scores)} = ${points} puntos`,
        );

        // Buscar todos los torneos donde participa este usuario
        const userTournaments =
          await this.prisma.tournamentParticipant.findMany({
            where: { userId: pronostic.userId },
            select: { tournamentId: true },
          });

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

        processedCount++;
      } catch (error) {
        this.logger.error(
          `❌ Error procesando pronóstico ${pronostic.id}:`,
          error,
        );
      }
    }

    return processedCount;
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
