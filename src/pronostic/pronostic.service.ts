import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePronosticDto } from './dto/create-pronostic.dto';
import { UpdatePronosticDto } from './dto/update-pronostic.dto';
import { Prisma } from '@prisma/client';
import { MatchdayCacheService } from '../external-api/services/matchday-cache.service';

@Injectable()
export class PronosticService {
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

    const result = await this.prisma.$transaction(upsertPromises);

    // 🔄 Invalidar cache después del bulk
    const externalIds = pronostics.map((p) => p.externalId);
    await this.cacheService.invalidateByExternalIds(externalIds);

    return result;
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
