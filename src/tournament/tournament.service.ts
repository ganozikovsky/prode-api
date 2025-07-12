import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PointsService } from '../external-api/services/points.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { JoinTournamentDto } from './dto/join-tournament.dto';
import {
  TournamentResponseDto,
  ParticipantResponseDto,
  JoinTournamentResponseDto,
} from './dto/tournament-response.dto';

@Injectable()
export class TournamentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pointsService: PointsService,
  ) {}

  /**
   * Genera un código único de invitación para el torneo
   */
  private generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Crea un nuevo torneo
   */
  async createTournament(
    createTournamentDto: CreateTournamentDto,
    userId: number,
  ): Promise<TournamentResponseDto> {
    // Verificar que el usuario existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Generar código único de invitación
    let inviteCode: string;
    let isUnique = false;
    let attempts = 0;

    do {
      inviteCode = this.generateInviteCode();
      const existing = await this.prisma.tournament.findUnique({
        where: { inviteCode },
      });
      isUnique = !existing;
      attempts++;

      if (attempts > 10) {
        throw new BadRequestException(
          'Error generando código único, intenta nuevamente',
        );
      }
    } while (!isUnique);

    // Crear el torneo
    const tournament = await this.prisma.tournament.create({
      data: {
        name: createTournamentDto.name,
        description: createTournamentDto.description,
        inviteCode,
        createdById: userId,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            participants: true,
          },
        },
      },
    });

    // Automáticamente unir al creador al torneo
    await this.prisma.tournamentParticipant.create({
      data: {
        tournamentId: tournament.id,
        userId: userId,
        points: 0,
      },
    });

    return {
      id: tournament.id,
      name: tournament.name,
      description: tournament.description,
      inviteCode: tournament.inviteCode,
      creator: tournament.creator,
      isActive: tournament.isActive,
      createdAt: tournament.createdAt.toISOString(),
      participantCount: 1, // El creador ya está incluido
    };
  }

  /**
   * Unirse a un torneo usando código de invitación
   */
  async joinTournament(
    joinTournamentDto: JoinTournamentDto,
    userId: number,
  ): Promise<JoinTournamentResponseDto> {
    // Verificar que el usuario existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Buscar el torneo por código de invitación
    const tournament = await this.prisma.tournament.findUnique({
      where: { inviteCode: joinTournamentDto.inviteCode },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            participants: true,
          },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException('Código de torneo inválido');
    }

    if (!tournament.isActive) {
      throw new BadRequestException('El torneo no está activo');
    }

    // Verificar si el usuario ya está en el torneo
    const existingParticipation =
      await this.prisma.tournamentParticipant.findUnique({
        where: {
          tournamentId_userId: {
            tournamentId: tournament.id,
            userId: userId,
          },
        },
      });

    if (existingParticipation) {
      throw new ConflictException('Ya estás participando en este torneo');
    }

    // Unir al usuario al torneo
    await this.prisma.tournamentParticipant.create({
      data: {
        tournamentId: tournament.id,
        userId: userId,
        points: 0,
      },
    });

    const tournamentResponse: TournamentResponseDto = {
      id: tournament.id,
      name: tournament.name,
      description: tournament.description,
      inviteCode: tournament.inviteCode,
      creator: tournament.creator,
      isActive: tournament.isActive,
      createdAt: tournament.createdAt.toISOString(),
      participantCount: tournament._count.participants + 1,
    };

    return {
      success: true,
      message: 'Te has unido al torneo exitosamente',
      tournament: tournamentResponse,
    };
  }

  /**
   * Obtener todos los torneos donde participa un usuario
   */
  async getUserTournaments(userId: number): Promise<TournamentResponseDto[]> {
    const participations = await this.prisma.tournamentParticipant.findMany({
      where: { userId },
      include: {
        tournament: {
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            _count: {
              select: {
                participants: true,
              },
            },
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    return participations.map((participation) => ({
      id: participation.tournament.id,
      name: participation.tournament.name,
      description: participation.tournament.description,
      inviteCode: participation.tournament.inviteCode,
      creator: participation.tournament.creator,
      isActive: participation.tournament.isActive,
      createdAt: participation.tournament.createdAt.toISOString(),
      participantCount: participation.tournament._count.participants,
    }));
  }

  /**
   * Obtener detalles de un torneo específico con sus participantes
   */
  async getTournamentById(
    tournamentId: number,
    userId: number,
  ): Promise<TournamentResponseDto> {
    // Verificar que el usuario participa en este torneo
    const participation = await this.prisma.tournamentParticipant.findUnique({
      where: {
        tournamentId_userId: {
          tournamentId,
          userId,
        },
      },
    });

    if (!participation) {
      throw new NotFoundException(
        'No tienes acceso a este torneo o el torneo no existe',
      );
    }

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        participants: {
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
            { points: 'desc' }, // Ordenar por puntos descendente
            { joinedAt: 'asc' }, // En caso de empate, por quien se unió primero
          ],
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    const participants: ParticipantResponseDto[] = tournament.participants.map(
      (participant) => ({
        id: participant.user.id,
        name: participant.user.name,
        email: participant.user.email,
        avatar: participant.user.avatar,
        points: participant.points,
        joinedAt: participant.joinedAt.toISOString(),
      }),
    );

    return {
      id: tournament.id,
      name: tournament.name,
      description: tournament.description,
      inviteCode: tournament.inviteCode,
      creator: tournament.creator,
      isActive: tournament.isActive,
      createdAt: tournament.createdAt.toISOString(),
      participantCount: tournament.participants.length,
      participants,
    };
  }

  /**
   * Obtener la tabla de posiciones de un torneo
   */
  async getTournamentLeaderboard(
    tournamentId: number,
    userId: number,
  ): Promise<ParticipantResponseDto[]> {
    // Verificar que el usuario participa en este torneo
    const participation = await this.prisma.tournamentParticipant.findUnique({
      where: {
        tournamentId_userId: {
          tournamentId,
          userId,
        },
      },
    });

    if (!participation) {
      throw new NotFoundException(
        'No tienes acceso a este torneo o el torneo no existe',
      );
    }

    const participants = await this.prisma.tournamentParticipant.findMany({
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
      orderBy: [{ points: 'desc' }, { joinedAt: 'asc' }],
    });

    return participants.map((participant) => ({
      id: participant.user.id,
      name: participant.user.name,
      email: participant.user.email,
      avatar: participant.user.avatar,
      points: participant.points,
      joinedAt: participant.joinedAt.toISOString(),
    }));
  }

  /**
   * Actualizar puntos de un usuario en un torneo (para uso interno del sistema)
   */
  async updateUserPoints(
    tournamentId: number,
    userId: number,
    points: number,
  ): Promise<void> {
    await this.prisma.tournamentParticipant.update({
      where: {
        tournamentId_userId: {
          tournamentId,
          userId,
        },
      },
      data: {
        points,
        updatedAt: new Date(),
      },
    });
  }

  // ==========================================
  // 🎯 NUEVOS MÉTODOS - RANKINGS POR FECHA
  // ==========================================

  /**
   * Obtener ranking de una fecha específica de un torneo
   */
  async getMatchdayRanking(
    tournamentId: number,
    matchday: number,
    userId: number,
  ): Promise<any[]> {
    // Verificar que el usuario participa en este torneo
    const participation = await this.prisma.tournamentParticipant.findUnique({
      where: {
        tournamentId_userId: {
          tournamentId,
          userId,
        },
      },
    });

    if (!participation) {
      throw new NotFoundException(
        'No tienes acceso a este torneo o el torneo no existe',
      );
    }

    return await this.pointsService.getMatchdayRanking(tournamentId, matchday);
  }

  /**
   * Obtener ranking acumulativo del torneo (usando PointsService para consistencia)
   */
  async getTournamentRankingViaPoints(
    tournamentId: number,
    userId: number,
  ): Promise<any[]> {
    // Verificar que el usuario participa en este torneo
    const participation = await this.prisma.tournamentParticipant.findUnique({
      where: {
        tournamentId_userId: {
          tournamentId,
          userId,
        },
      },
    });

    if (!participation) {
      throw new NotFoundException(
        'No tienes acceso a este torneo o el torneo no existe',
      );
    }

    return await this.pointsService.getTournamentRanking(tournamentId);
  }
}
