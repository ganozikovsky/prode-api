import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { TournamentService } from './tournament.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { JoinTournamentDto } from './dto/join-tournament.dto';
import {
  TournamentResponseDto,
  ParticipantResponseDto,
  JoinTournamentResponseDto,
} from './dto/tournament-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('tournaments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tournaments')
export class TournamentController {
  constructor(private readonly tournamentService: TournamentService) {}

  @Post()
  @ApiOperation({
    summary: '🏆 Crear un nuevo torneo',
    description:
      'Crea un nuevo torneo de pronósticos. El usuario que lo crea automáticamente se une al torneo con 0 puntos.',
  })
  @ApiResponse({
    status: 201,
    description: 'Torneo creado exitosamente',
    type: TournamentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o error generando código único',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - token requerido',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  async createTournament(
    @Body() createTournamentDto: CreateTournamentDto,
    @CurrentUser() user: User,
  ): Promise<TournamentResponseDto> {
    return this.tournamentService.createTournament(
      createTournamentDto,
      user.id,
    );
  }

  @Post('join')
  @ApiOperation({
    summary: '🎯 Unirse a un torneo',
    description:
      'Únete a un torneo existente usando el código de invitación. Empezarás con 0 puntos.',
  })
  @ApiResponse({
    status: 201,
    description: 'Te has unido al torneo exitosamente',
    type: JoinTournamentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Código inválido o torneo inactivo',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - token requerido',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario o torneo no encontrado',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya estás participando en este torneo',
  })
  async joinTournament(
    @Body() joinTournamentDto: JoinTournamentDto,
    @CurrentUser() user: User,
  ): Promise<JoinTournamentResponseDto> {
    return this.tournamentService.joinTournament(joinTournamentDto, user.id);
  }

  @Get('my-tournaments')
  @ApiOperation({
    summary: '📋 Obtener mis torneos',
    description:
      'Lista todos los torneos en los que participa el usuario actual, ordenados por fecha de participación.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de torneos del usuario',
    type: [TournamentResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - token requerido',
  })
  async getUserTournaments(
    @CurrentUser() user: User,
  ): Promise<TournamentResponseDto[]> {
    return this.tournamentService.getUserTournaments(user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: '🔍 Obtener detalles de un torneo',
    description:
      'Obtiene información detallada de un torneo específico, incluyendo la lista completa de participantes ordenada por puntos.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID del torneo',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Detalles del torneo con participantes',
    type: TournamentResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - token requerido',
  })
  @ApiResponse({
    status: 404,
    description: 'Torneo no encontrado o sin acceso',
  })
  async getTournamentById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ): Promise<TournamentResponseDto> {
    return this.tournamentService.getTournamentById(id, user.id);
  }

  @Get(':id/leaderboard')
  @ApiOperation({
    summary: '🏅 Obtener tabla de posiciones',
    description:
      'Obtiene la tabla de posiciones del torneo, ordenada por puntos de mayor a menor. En caso de empate, se ordena por quien se unió primero.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID del torneo',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Tabla de posiciones del torneo',
    type: [ParticipantResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - token requerido',
  })
  @ApiResponse({
    status: 404,
    description: 'Torneo no encontrado o sin acceso',
  })
  async getTournamentLeaderboard(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ): Promise<ParticipantResponseDto[]> {
    return this.tournamentService.getTournamentLeaderboard(id, user.id);
  }

  // ==========================================
  // 🎯 NUEVOS ENDPOINTS - RANKINGS POR FECHA
  // ==========================================

  @Get(':id/matchday/:matchday/ranking')
  @ApiOperation({
    summary: '📅 Obtener ranking de una fecha específica',
    description:
      'Obtiene el ranking de puntos de los participantes para una fecha específica del torneo. ' +
      'Esto permite ver quién ganó una fecha particular.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID del torneo',
    example: 1,
  })
  @ApiParam({
    name: 'matchday',
    type: 'number',
    description: 'Número de la fecha (1, 2, 3, etc.)',
    example: 5,
  })
  @ApiResponse({
    status: 200,
    description: 'Ranking de la fecha específica',
    schema: {
      example: [
        {
          position: 1,
          user: {
            id: 1,
            name: 'Juan Pérez',
            email: 'juan@example.com',
            avatar: 'https://example.com/avatar.jpg',
          },
          points: 9,
          matchday: 5,
        },
        {
          position: 2,
          user: {
            id: 2,
            name: 'María González',
            email: 'maria@example.com',
            avatar: null,
          },
          points: 6,
          matchday: 5,
        },
      ],
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - token requerido',
  })
  @ApiResponse({
    status: 404,
    description: 'Torneo no encontrado o sin acceso',
  })
  async getMatchdayRanking(
    @Param('id', ParseIntPipe) id: number,
    @Param('matchday', ParseIntPipe) matchday: number,
    @CurrentUser() user: User,
  ): Promise<any[]> {
    return this.tournamentService.getMatchdayRanking(id, matchday, user.id);
  }

  @Get(':id/ranking-detailed')
  @ApiOperation({
    summary: '🏆 Obtener ranking acumulativo detallado',
    description:
      'Obtiene el ranking acumulativo del torneo usando el sistema de puntos avanzado. ' +
      'Incluye información adicional sobre posiciones y metadatos.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID del torneo',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Ranking acumulativo detallado del torneo',
    schema: {
      example: [
        {
          position: 1,
          user: {
            id: 1,
            name: 'Juan Pérez',
            email: 'juan@example.com',
            avatar: 'https://example.com/avatar.jpg',
          },
          points: 45,
          joinedAt: '2025-01-15T10:30:00Z',
        },
        {
          position: 2,
          user: {
            id: 2,
            name: 'María González',
            email: 'maria@example.com',
            avatar: null,
          },
          points: 42,
          joinedAt: '2025-01-16T14:20:00Z',
        },
      ],
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - token requerido',
  })
  @ApiResponse({
    status: 404,
    description: 'Torneo no encontrado o sin acceso',
  })
  async getTournamentRankingDetailed(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ): Promise<any[]> {
    return this.tournamentService.getTournamentRankingViaPoints(id, user.id);
  }
}
