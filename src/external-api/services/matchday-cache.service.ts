import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import axios from 'axios';
import { PromiedosApiResponse } from '../interfaces/game.interface';

interface PronosticWithUser {
  id: number;
  externalId: string;
  userId: number;
  prediction: any;
  processed: boolean;
  livePoints: number;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

interface CacheEntry {
  data: Map<string, PronosticWithUser[]>;
  timestamp: number;
  roundId: number;
}

@Injectable()
export class MatchdayCacheService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly logger = new Logger(MatchdayCacheService.name);
  private readonly baseUrl = 'https://api.promiedos.com.ar';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene pronósticos de una fecha desde cache o DB
   */
  async getMatchdayPronostics(
    roundId: number,
  ): Promise<Map<string, PronosticWithUser[]>> {
    const cacheKey = `matchday_${roundId}`;
    const cached = this.cache.get(cacheKey);

    if (cached) {
      this.logger.debug(`🎯 Cache HIT para fecha ${roundId}`);
      return cached.data;
    }

    this.logger.debug(`❌ Cache MISS para fecha ${roundId}, consultando DB...`);

    const pronosticsData = await this.fetchOptimizedMatchdayPronostics(roundId);

    this.cache.set(cacheKey, {
      data: pronosticsData,
      timestamp: Date.now(),
      roundId,
    });

    return pronosticsData;
  }

  /**
   * Consulta optimizada: una sola query para toda la fecha
   */
  private async fetchOptimizedMatchdayPronostics(
    roundId: number,
  ): Promise<Map<string, PronosticWithUser[]>> {
    try {
      // 1. Obtener todos los externalIds de la fecha
      const { data }: { data: PromiedosApiResponse } = await axios.get(
        `${this.baseUrl}/league/games/hc/72_224_8_${roundId}`,
      );

      if (!data.games || data.games.length === 0) {
        this.logger.warn(`⚠️ No hay partidos para fecha ${roundId}`);
        return new Map();
      }

      const externalIds = data.games.map((game) => game.id);

      // 2. UNA SOLA consulta para todos los pronósticos de la fecha
      const allPronostics = await this.prisma.pronostic.findMany({
        where: {
          externalId: { in: externalIds },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // 3. Agrupar por externalId para acceso O(1)
      const pronosticsMap = new Map<string, PronosticWithUser[]>();

      allPronostics.forEach((pronostic) => {
        if (!pronosticsMap.has(pronostic.externalId)) {
          pronosticsMap.set(pronostic.externalId, []);
        }
        pronosticsMap
          .get(pronostic.externalId)!
          .push(pronostic as PronosticWithUser);
      });

      this.logger.log(
        `✅ Cargados ${allPronostics.length} pronósticos para fecha ${roundId} (${externalIds.length} partidos)`,
      );

      return pronosticsMap;
    } catch (error) {
      this.logger.error(
        `❌ Error obteniendo pronósticos para fecha ${roundId}: ${error.message}`,
      );
      return new Map();
    }
  }

  /**
   * Invalidación inteligente basada en externalIds
   */
  async invalidateByExternalIds(externalIds: string[]): Promise<void> {
    if (externalIds.length === 0) return;

    this.logger.log(`🔄 Invalidando cache para ${externalIds.length} partidos`);

    try {
      // Determinar qué fechas están afectadas
      const affectedRounds = await this.getAffectedRounds(externalIds);

      // Invalidar solo las fechas afectadas
      affectedRounds.forEach((roundId) => {
        this.cache.delete(`matchday_${roundId}`);
        this.logger.debug(`🗑️ Cache invalidado para fecha ${roundId}`);
      });

      this.logger.log(
        `✅ Cache invalidado para ${affectedRounds.length} fechas`,
      );
    } catch (error) {
      this.logger.error(`❌ Error invalidando cache: ${error.message}`);
      // En caso de error, invalidar el cache por seguridad
      this.invalidateAll();
    }
  }

  /**
   * Determina qué fechas están afectadas por los externalIds dados
   */
  private async getAffectedRounds(externalIds: string[]): Promise<number[]> {
    const affectedRounds = new Set<number>();

    // Revisar cache actual para encontrar fechas afectadas
    for (const [cacheKey, entry] of this.cache.entries()) {
      const hasAffectedGames = externalIds.some((externalId) =>
        entry.data.has(externalId),
      );

      if (hasAffectedGames) {
        affectedRounds.add(entry.roundId);
      }
    }

    // Si no encontramos en cache, consultar DB para determinar fechas
    if (affectedRounds.size === 0) {
      try {
        // Buscar en qué fechas aparecen estos externalIds
        for (let roundId = 1; roundId <= 16; roundId++) {
          try {
            const { data }: { data: PromiedosApiResponse } = await axios.get(
              `${this.baseUrl}/league/games/hc/72_224_8_${roundId}`,
            );

            const hasMatchingGames = data.games?.some((game) =>
              externalIds.includes(game.id),
            );

            if (hasMatchingGames) {
              affectedRounds.add(roundId);
            }
          } catch (error) {
            // Ignorar errores de fechas específicas
            continue;
          }
        }
      } catch (error) {
        this.logger.warn(
          `⚠️ Error determinando fechas afectadas, invalidando fechas comunes`,
        );
        // Fallback: invalidar fechas más comunes (1-5)
        [1, 2, 3, 4, 5].forEach((round) => affectedRounds.add(round));
      }
    }

    return Array.from(affectedRounds);
  }

  /**
   * Invalidación completa del cache
   */
  async invalidateAll(): Promise<void> {
    this.cache.clear();
    this.logger.log('🗑️ Cache completamente invalidado');
  }

  /**
   * Obtiene estadísticas del cache
   */
  getCacheStats(): {
    totalEntries: number;
    entries: Array<{
      roundId: number;
      gamesCount: number;
      pronosticsCount: number;
      timestamp: Date;
    }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      roundId: entry.roundId,
      gamesCount: entry.data.size,
      pronosticsCount: Array.from(entry.data.values()).reduce(
        (total, pronostics) => total + pronostics.length,
        0,
      ),
      timestamp: new Date(entry.timestamp),
    }));

    return {
      totalEntries: this.cache.size,
      entries,
    };
  }
}
