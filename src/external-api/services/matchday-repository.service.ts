import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class MatchdayRepositoryService {
  private readonly logger = new Logger(MatchdayRepositoryService.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * 📖 Lee el current_matchday desde la base de datos
   */
  async getCurrentMatchday(): Promise<number | null> {
    try {
      const config = await this.prismaService.systemConfig.findUnique({
        where: { key: 'current_matchday' },
      });

      if (!config) {
        this.logger.warn('⚠️ current_matchday no encontrado en DB');
        return null;
      }

      const currentRound = parseInt(config.value);
      this.logger.log(
        `📖 current_matchday leído desde DB: ${currentRound} (actualizado: ${config.updatedAt})`,
      );

      return currentRound;
    } catch (error) {
      this.logger.error(
        `❌ Error leyendo current_matchday desde DB: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * 💾 Guarda el current_matchday en la base de datos
   */
  async saveCurrentMatchday(
    roundId: number,
    updatedBy: string = 'system',
  ): Promise<void> {
    try {
      await this.prismaService.systemConfig.upsert({
        where: { key: 'current_matchday' },
        update: {
          value: roundId.toString(),
          updatedBy,
          updatedAt: new Date(),
        },
        create: {
          key: 'current_matchday',
          value: roundId.toString(),
          updatedBy,
        },
      });

      this.logger.log(
        `💾 current_matchday guardado en DB: ${roundId} por ${updatedBy}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error guardando current_matchday en DB: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * 📊 Obtiene metadatos del current_matchday
   */
  async getCurrentMatchdayMetadata(): Promise<{
    value: number | null;
    updatedAt: Date | null;
    updatedBy: string | null;
  }> {
    try {
      const config = await this.prismaService.systemConfig.findUnique({
        where: { key: 'current_matchday' },
      });

      if (!config) {
        return {
          value: null,
          updatedAt: null,
          updatedBy: null,
        };
      }

      return {
        value: parseInt(config.value),
        updatedAt: config.updatedAt,
        updatedBy: config.updatedBy,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error obteniendo metadata de current_matchday: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * 🔍 Verifica si existe configuración para current_matchday
   */
  async hasCurrentMatchday(): Promise<boolean> {
    try {
      const config = await this.prismaService.systemConfig.findUnique({
        where: { key: 'current_matchday' },
      });

      return config !== null;
    } catch (error) {
      this.logger.error(
        `❌ Error verificando existencia de current_matchday: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * 🗑️ Elimina la configuración de current_matchday (para testing/reset)
   */
  async deleteCurrentMatchday(): Promise<void> {
    try {
      await this.prismaService.systemConfig.delete({
        where: { key: 'current_matchday' },
      });

      this.logger.log('🗑️ current_matchday eliminado de DB');
    } catch (error) {
      this.logger.error(
        `❌ Error eliminando current_matchday: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * 📜 Obtiene historial de cambios (si necesario en el futuro)
   * Por ahora solo devuelve el valor actual, pero se puede extender
   */
  async getCurrentMatchdayHistory(): Promise<Array<{
    value: number;
    updatedAt: Date;
    updatedBy: string | null;
  }>> {
    try {
      const config = await this.prismaService.systemConfig.findUnique({
        where: { key: 'current_matchday' },
      });

      if (!config) {
        return [];
      }

      // Por ahora solo el valor actual, se puede extender con tabla de historial
      return [
        {
          value: parseInt(config.value),
          updatedAt: config.updatedAt,
          updatedBy: config.updatedBy,
        },
      ];
    } catch (error) {
      this.logger.error(
        `❌ Error obteniendo historial de current_matchday: ${error.message}`,
      );
      throw error;
    }
  }
} 