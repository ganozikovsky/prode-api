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
    const upsertPromises = pronostics.map((pronostic) => {
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

    try {
      const result = await this.prisma.$transaction(upsertPromises);

      const externalIds = pronostics.map((p) => p.externalId);
      this.cacheService.invalidateByExternalIds(externalIds).catch((error) => {
        this.logger.error(
          `❌ Error invalidando cache (asíncrono): ${error.message}`,
        );
      });

      this.logger.log(
        `✅ Bulk creado exitosamente: ${result.length} pronósticos`,
      );
      return result;
    } catch (error) {
      this.logger.error(`❌ Error en createBulk: ${error.message}`);
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
