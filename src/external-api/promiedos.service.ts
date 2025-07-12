import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PronosticService } from '../pronostic/pronostic.service';
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

  constructor(private readonly pronosticService: PronosticService) {}

  async getMatchday(roundId: number = 1): Promise<MatchdayResponse> {
    try {
      // 1. PRIMERO: Obtener datos de la API externa (CRÍTICO)
      const { data }: { data: PromiedosApiResponse } = await axios.get(
        `${this.baseUrl}/league/games/hc/72_224_8_${roundId}`,
      );

      this.logger.log(`✅ Datos obtenidos de Promiedos para fecha ${roundId}`);

      // 2. SEGUNDO: Intentar enriquecer con pronósticos (OPCIONAL)
      const gamesWithPronostics: GameWithPronostics[] = await Promise.all(
        data.games.map(async (game: Game) => {
          try {
            // Intentar obtener pronósticos
            const pronostics = await this.pronosticService.findByExternalId(
              game.id,
            );

            this.logger.debug(
              `📊 Pronósticos obtenidos para juego ${game.id}: ${pronostics.length}`,
            );

            return {
              ...game,
              pronostics,
              totalPronostics: pronostics.length,
            };
          } catch (dbError) {
            // Si la BD falla, continuar con el juego sin pronósticos
            this.logger.warn(
              `⚠️ Error DB para juego ${game.id}: ${dbError.message}`,
            );

            return {
              ...game,
              pronostics: [],
              totalPronostics: 0,
            };
          }
        }),
      );

      // 3. Verificar si la BD está disponible
      const totalPronostics = gamesWithPronostics.reduce(
        (total, game) => total + game.totalPronostics,
        0,
      );

      if (totalPronostics === 0) {
        this.logger.warn(
          `⚠️ No se pudieron obtener pronósticos para la fecha ${roundId}`,
        );
      }

      return {
        round: roundId,
        roundName: data.games[0]?.stage_round_name || `Fecha ${roundId}`,
        totalGames: data.games.length,
        games: gamesWithPronostics,
        externalIdPattern: `72_224_8_${roundId}`,
        // Agregar metadata sobre la disponibilidad de la BD
        databaseStatus: totalPronostics > 0 ? 'available' : 'unavailable',
      };
    } catch (error) {
      // Reportar error a Sentry con contexto
      Sentry.withScope((scope) => {
        scope.setTag('service', 'promiedos');
        scope.setContext('matchday', { roundId });
        scope.setLevel('error');
        Sentry.captureException(error);
      });

      // Solo fallar si la API externa falla
      this.logger.error(
        `❌ Error crítico en API externa para fecha ${roundId}: ${error.message}`,
      );
      throw new Error(
        `Error al obtener datos de la fecha ${roundId}: ${error.message}`,
      );
    }
  }

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
}
