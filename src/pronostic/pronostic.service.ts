import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePronosticDto } from './dto/create-pronostic.dto';
import { UpdatePronosticDto } from './dto/update-pronostic.dto';
import { Prisma } from '@prisma/client';
import { MatchdayCacheService } from '../external-api/services/matchday-cache.service';

@Injectable()
export class PronosticService {
  private readonly logger = new Logger(PronosticService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => MatchdayCacheService))
    private readonly cacheService: MatchdayCacheService,
  ) {}

  async create(createPronosticDto: CreatePronosticDto, userId: number) {
    // Verificar si el usuario ya tiene un pronóstico para este partido
    const existingPronostic = await this.prisma.pronostic.findFirst({
      where: {
        externalId: createPronosticDto.externalId,
        userId: userId,
      },
    });

    if (existingPronostic) {
      throw new ConflictException(
        `Ya tienes un pronóstico para este partido. Puedes editarlo usando PATCH /pronostics/${existingPronostic.id}`,
      );
    }

    const result = await this.prisma.pronostic.create({
      data: {
        externalId: createPronosticDto.externalId,
        userId: userId,
        prediction:
          createPronosticDto.prediction as unknown as Prisma.JsonObject,
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
    });

    // Invalidar cache para este partido específico
    await this.cacheService.invalidateByExternalIds([
      createPronosticDto.externalId,
    ]);

    return result;
  }

  async createBulk(pronostics: CreatePronosticDto[], userId: number) {
    const startTime = Date.now();

    // Log inicial del pool de conexiones
    const initialPoolMetrics = await this.getPoolMetrics();
    this.logger.log(
      `🔄 [BULK START] Pool inicial: ${JSON.stringify(initialPoolMetrics)}`,
    );
    this.logger.log(
      `🔄 [BULK START] Procesando ${pronostics.length} pronósticos para usuario ${userId}`,
    );

    const upsertPromises = pronostics.map((pronostic, index) => {
      this.logger.debug(
        `📝 [BULK] Preparando upsert ${index + 1}/${pronostics.length} para partido ${pronostic.externalId}`,
      );

      return this.prisma.pronostic.upsert({
        where: {
          externalId_userId: {
            externalId: pronostic.externalId,
            userId: userId,
          },
        },
        create: {
          externalId: pronostic.externalId,
          userId: userId,
          prediction: pronostic.prediction as unknown as Prisma.JsonObject,
        },
        update: {
          prediction: pronostic.prediction as unknown as Prisma.JsonObject,
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
      });
    });

    // Log antes de la transacción
    const preTransactionMetrics = await this.getPoolMetrics();
    this.logger.log(
      `🔄 [BULK TRANSACTION] Pool antes de transacción: ${JSON.stringify(preTransactionMetrics)}`,
    );

    try {
      const result = await this.prisma.$transaction(upsertPromises);

      // Log después de la transacción
      const postTransactionMetrics = await this.getPoolMetrics();
      const transactionTime = Date.now() - startTime;

      this.logger.log(
        `✅ [BULK TRANSACTION] Completada en ${transactionTime}ms`,
      );
      this.logger.log(
        `✅ [BULK TRANSACTION] Pool después de transacción: ${JSON.stringify(postTransactionMetrics)}`,
      );
      this.logger.log(
        `✅ [BULK TRANSACTION] Resultados: ${result.length} pronósticos procesados`,
      );

      // 🔄 Invalidar cache después del bulk
      const cacheStartTime = Date.now();
      const externalIds = pronostics.map((p) => p.externalId);

      this.logger.log(
        `🗑️ [BULK CACHE] Invalidando cache para ${externalIds.length} partidos`,
      );
      await this.cacheService.invalidateByExternalIds(externalIds);

      const cacheTime = Date.now() - cacheStartTime;
      this.logger.log(`✅ [BULK CACHE] Cache invalidado en ${cacheTime}ms`);

      // Log final del pool
      const finalPoolMetrics = await this.getPoolMetrics();
      const totalTime = Date.now() - startTime;

      this.logger.log(`✅ [BULK COMPLETE] Tiempo total: ${totalTime}ms`);
      this.logger.log(
        `✅ [BULK COMPLETE] Pool final: ${JSON.stringify(finalPoolMetrics)}`,
      );
      this.logger.log(
        `✅ [BULK COMPLETE] Cambios en pool: conexiones activas ${finalPoolMetrics.active - initialPoolMetrics.active}, idle ${finalPoolMetrics.idle - initialPoolMetrics.idle}`,
      );

      return result;
    } catch (error) {
      // Log en caso de error
      const errorMetrics = await this.getPoolMetrics();
      const errorTime = Date.now() - startTime;

      this.logger.error(
        `❌ [BULK ERROR] Falló después de ${errorTime}ms: ${error.message}`,
      );
      this.logger.error(
        `❌ [BULK ERROR] Pool en error: ${JSON.stringify(errorMetrics)}`,
      );

      throw error;
    }
  }

  /**
   * Obtiene métricas del pool de conexiones de Prisma
   */
  private async getPoolMetrics(): Promise<{
    active: number;
    idle: number;
    total: number;
  }> {
    try {
      // Acceder a las métricas internas del pool de Prisma
      const poolMetrics = (this.prisma as any)._engine?.pool?.metrics || {};

      return {
        active: poolMetrics.active || 0,
        idle: poolMetrics.idle || 0,
        total: (poolMetrics.active || 0) + (poolMetrics.idle || 0),
      };
    } catch (error) {
      this.logger.warn(
        `⚠️ No se pudieron obtener métricas del pool: ${error.message}`,
      );
      return {
        active: -1,
        idle: -1,
        total: -1,
      };
    }
  }

  async findAll() {
    return this.prisma.pronostic.findMany({
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
  }

  async findByExternalId(externalId: string) {
    return this.prisma.pronostic.findMany({
      where: {
        externalId,
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
  }

  async findOne(id: number) {
    const pronostic = await this.prisma.pronostic.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!pronostic) {
      throw new NotFoundException(`Pronóstico con ID ${id} no encontrado`);
    }

    return pronostic;
  }

  async update(
    id: number,
    updatePronosticDto: UpdatePronosticDto,
    userId?: number,
  ) {
    const pronostic = await this.findOne(id);

    if (!pronostic) {
      throw new NotFoundException(`Pronóstico con ID ${id} no encontrado`);
    }

    // Verificar permisos si se proporciona userId
    if (userId && pronostic.userId !== userId) {
      throw new ForbiddenException(
        'No tienes permisos para actualizar este pronóstico',
      );
    }

    const result = await this.prisma.pronostic.update({
      where: { id },
      data: {
        prediction:
          updatePronosticDto.prediction as unknown as Prisma.JsonObject,
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
    });

    // Invalidar cache para este partido específico
    await this.cacheService.invalidateByExternalIds([pronostic.externalId]);

    return result;
  }

  async remove(id: number, userId?: number) {
    const pronostic = await this.findOne(id);

    if (!pronostic) {
      throw new NotFoundException(`Pronóstico con ID ${id} no encontrado`);
    }

    // Verificar permisos si se proporciona userId
    if (userId && pronostic.userId !== userId) {
      throw new ForbiddenException(
        'No tienes permisos para eliminar este pronóstico',
      );
    }

    const result = await this.prisma.pronostic.delete({
      where: { id },
    });

    // Invalidar cache para este partido específico
    await this.cacheService.invalidateByExternalIds([pronostic.externalId]);

    return result;
  }

  async findByUserId(userId: number) {
    return this.prisma.pronostic.findMany({
      where: { userId },
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
  }
}
