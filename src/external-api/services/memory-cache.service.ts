import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

/**
 * 🚀 Servicio de Cache en Memoria
 * Solución temporal antes de implementar Redis
 * Ideal para un solo dyno en Heroku
 */
@Injectable()
export class MemoryCacheService {
  private readonly logger = new Logger(MemoryCacheService.name);
  private cache = new Map<string, CacheEntry<any>>();
  private readonly maxCacheSize = 100; // Límite de entradas

  /**
   * 📥 Obtiene un valor del cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Verificar si expiró
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.logger.debug(`Cache expirado para key: ${key}`);
      return null;
    }

    this.logger.debug(`Cache hit para key: ${key}`);
    return entry.data as T;
  }

  /**
   * 📤 Guarda un valor en el cache
   */
  async set<T>(key: string, data: T, ttlSeconds: number = 300): Promise<void> {
    const expiry = Date.now() + (ttlSeconds * 1000);
    
    // Si llegamos al límite, limpiar cache viejo
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldest();
    }

    this.cache.set(key, { data, expiry });
    this.logger.debug(`Cache guardado para key: ${key}, TTL: ${ttlSeconds}s`);
  }

  /**
   * 🗑️ Elimina una entrada del cache
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    this.logger.debug(`Cache eliminado para key: ${key}`);
  }

  /**
   * 🧹 Limpia todo el cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.logger.log('Cache completamente limpiado');
  }

  /**
   * 📊 Obtiene estadísticas del cache
   */
  getStats(): {
    size: number;
    maxSize: number;
    keys: string[];
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * 🔄 Cache con función de carga
   */
  async getOrSet<T>(
    key: string,
    loader: () => Promise<T>,
    ttlSeconds: number = 300,
  ): Promise<T> {
    // Intentar obtener del cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Si no está en cache, cargar
    try {
      const data = await loader();
      await this.set(key, data, ttlSeconds);
      return data;
    } catch (error) {
      this.logger.error(`Error cargando datos para cache key ${key}:`, error);
      throw error;
    }
  }

  /**
   * 🗑️ Elimina las entradas más viejas cuando llegamos al límite
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestExpiry = Infinity;

    // Buscar la entrada más vieja
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiry < oldestExpiry) {
        oldestExpiry = entry.expiry;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.logger.debug(`Cache eviction: eliminado ${oldestKey}`);
    }
  }

  /**
   * 🧹 Limpia entradas expiradas (para ejecutar periódicamente)
   */
  cleanupExpired(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Limpiados ${cleaned} entries expirados del cache`);
    }

    return cleaned;
  }
}

/**
 * 🎯 Claves de cache predefinidas para consistencia
 */
export const CACHE_KEYS = {
  MATCHDAY: (roundId: number) => `matchday:${roundId}`,
  CURRENT_ROUND: 'current:round',
  TEAM_CREST: (teamId: string, size: number) => `team:${teamId}:${size}`,
  USER_TOURNAMENTS: (userId: number) => `user:${userId}:tournaments`,
  TOURNAMENT_RANKING: (tournamentId: number) => `tournament:${tournamentId}:ranking`,
  MATCHDAY_RANKING: (tournamentId: number, matchday: number) => 
    `tournament:${tournamentId}:matchday:${matchday}:ranking`,
} as const;

/**
 * 🕐 TTL predefinidos en segundos
 */
export const CACHE_TTL = {
  LIVE_DATA: 60,        // 1 minuto para datos en vivo
  MATCHDAY: 300,        // 5 minutos para datos de fecha
  STATIC: 3600,         // 1 hora para datos estáticos
  RANKING: 180,         // 3 minutos para rankings
  USER_DATA: 120,       // 2 minutos para datos de usuario
} as const;