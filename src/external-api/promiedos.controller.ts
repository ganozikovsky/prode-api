import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PromiedosService } from './promiedos.service';
import {
  GameWithPronostics,
  GroupedMatchdayResponse,
  EnhancedMatchdayResponse,
} from './interfaces/game.interface';

@ApiTags('external-api')
@Controller('promiedos')
export class PromiedosController {
  constructor(private readonly promiedosService: PromiedosService) {}

  /**
   * 📅 Función helper para parsear fechas del formato "13-07-2025 21:00"
   * Ahora incluye la hora y maneja correctamente la zona horaria argentina
   */
  private parseMatchDate(dateString: string): Date {
    if (!dateString) return new Date();

    try {
      // Parsear formato "DD-MM-YYYY HH:MM"
      const regex = /(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})/;
      const match = regex.exec(dateString);

      if (!match) {
        // Fallback: solo fecha sin hora
        const [datePart] = dateString.split(' ');
        const [day, month, year] = datePart.split('-');
        return new Date(`${year}-${month}-${day}`);
      }

      const [, day, month, year, hour, minute] = match;

      // Crear fecha en horario argentino (UTC-3)
      // Nota: Los horarios vienen de Argentina, así que los interpretamos como tal
      const argDate = new Date(
        parseInt(year),
        parseInt(month) - 1, // Los meses en JS van de 0-11
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
      );

      return argDate;
    } catch (error) {
      // En caso de error, usar la fecha actual
      return new Date();
    }
  }

  /**
   * 🗓️ Función helper para agrupar partidos por fecha
   * Ahora preserva las horas originales de los partidos
   */
  private groupMatchesByDate(
    games: GameWithPronostics[],
  ): GroupedMatchdayResponse[] {
    const groupedGames = new Map<string, GameWithPronostics[]>();

    games.forEach((game) => {
      // Para agrupar por fecha, solo usamos la parte de la fecha (sin hora)
      const [datePart] = game.start_time.split(' ');
      const [day, month, year] = datePart.split('-');
      const dateKey = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

      if (!groupedGames.has(dateKey)) {
        groupedGames.set(dateKey, []);
      }
      groupedGames.get(dateKey).push(game);
    });

    const result = Array.from(groupedGames.entries()).map(([date, matches]) => {
      // Ordenar partidos por hora dentro de cada fecha
      const sortedMatches = [...matches].sort((a, b) => {
        const timeA = a.start_time.split(' ')[1] || '00:00';
        const timeB = b.start_time.split(' ')[1] || '00:00';
        return timeA.localeCompare(timeB);
      });

      // Enriquecer cada partido con información de zona horaria clara
      const enrichedMatches = sortedMatches.map((match) => ({
        ...match,
        // Mantener el start_time original sin conversión (ya está en horario argentino)
        // start_time_iso: this.parseMatchDate(match.start_time).toISOString(), // ❌ Causaba el problema
        // Mantener timezone info para el frontend
        timezone: 'America/Argentina/Buenos_Aires',
        timezone_offset: '-03:00',
      }));

      return {
        date: new Date(date + 'T00:00:00.000Z').toISOString(), // Fecha normalizada a UTC
        matches: enrichedMatches,
      };
    });

    // Ordenar por fecha
    return result.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }

  @Get('lpf/current')
  @ApiOperation({
    summary:
      '🎯 Obtener la fecha actual automáticamente (con metadatos y agrupada por fecha)',
    description:
      'Calcula automáticamente qué fecha mostrar basándose en el estado de los partidos. ' +
      'Usa inteligencia artificial para determinar si mostrar la fecha en curso, ' +
      'la próxima fecha programada, o la última fecha con información válida. ' +
      'Los partidos se devuelven agrupados por fecha de juego, manteniendo los metadatos originales.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Datos de la fecha actual con metadatos y partidos agrupados por fecha',
    schema: {
      example: {
        round: 1,
        roundName: 'Fecha 1',
        totalGames: 14,
        externalIdPattern: '72_224_8_1',
        databaseStatus: 'available',
        gamesByDate: [
          {
            date: '2025-07-13T00:00:00.000Z',
            matches: [
              {
                id: 'game_id_123',
                stage_round_name: 'Fecha 1',
                winner: 0,
                teams: [
                  {
                    name: 'River Plate',
                    short_name: 'RIV',
                    id: 'hhij',
                  },
                ],
                scores: [2, 1],
                status: {
                  enum: 1,
                  name: 'Prog.',
                  short_name: 'Prog.',
                  symbol_name: 'Prog.',
                },
                start_time: '13-07-2025 21:00',
                pronostics: [
                  {
                    id: 1,
                    userId: 1,
                    prediction: { scores: [2, 1], scorers: ['Messi'] },
                    user: { id: 1, name: 'Juan', email: 'juan@test.com' },
                  },
                ],
                totalPronostics: 5,
              },
            ],
          },
          {
            date: '2025-07-14T00:00:00.000Z',
            matches: [
              // ... más partidos
            ],
          },
        ],
      },
    },
  })
  async getCurrentMatchday(): Promise<EnhancedMatchdayResponse> {
    const matchdayData = await this.promiedosService.getMatchday();

    return {
      round: matchdayData.round,
      roundName: matchdayData.roundName,
      totalGames: matchdayData.totalGames,
      externalIdPattern: matchdayData.externalIdPattern,
      databaseStatus: matchdayData.databaseStatus,
      gamesByDate: this.groupMatchesByDate(matchdayData.games),
    };
  }

  @Get('lpf/current/round')
  @ApiOperation({
    summary: '🧠 Obtener solo el número de fecha actual',
    description:
      'Devuelve únicamente el número de la fecha que se debería mostrar según la lógica automática',
  })
  @ApiResponse({
    status: 200,
    description: 'Número de la fecha actual',
    schema: {
      example: {
        currentRound: 1,
        reason: 'Fecha con partidos en vivo',
        timestamp: '2025-01-12T10:30:00Z',
      },
    },
  })
  async getCurrentRound() {
    const currentRound = await this.promiedosService.getCurrentRound();
    return {
      currentRound,
      reason: 'Calculado automáticamente',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('lpf/:roundId')
  @ApiOperation({
    summary: 'Obtener información completa de una fecha específica',
    description:
      'Obtiene los partidos de una fecha específica con sus pronósticos asociados',
  })
  @ApiParam({
    name: 'roundId',
    type: 'number',
    description: 'Número de la fecha/jornada (1-16)',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Datos de la fecha con pronósticos',
    schema: {
      example: {
        round: 1,
        roundName: 'Fecha 1',
        totalGames: 14,
        games: [
          {
            id: 'game_id_123',
            stage_round_name: 'Fecha 1',
            winner: 0,
            teams: [
              {
                name: 'River Plate',
                short_name: 'RIV',
                id: 'hhij',
              },
            ],
            scores: [2, 1],
            pronostics: [
              {
                id: 1,
                userId: 1,
                prediction: { scores: [2, 1], scorers: ['Messi'] },
                user: { id: 1, name: 'Juan', email: 'juan@test.com' },
              },
            ],
            totalPronostics: 5,
          },
        ],
      },
    },
  })
  async getMatchday(@Param('roundId', ParseIntPipe) roundId: number) {
    return this.promiedosService.getMatchday(roundId);
  }

  @Get('lpf/crest/:teamId')
  @ApiOperation({
    summary: 'Obtener URL del escudo del equipo',
    description:
      'Devuelve la URL directa del escudo del equipo desde promiedos.com.ar',
  })
  @ApiParam({
    name: 'teamId',
    type: 'string',
    description: 'ID del equipo (formato string, ej: hhij)',
    example: 'hhij',
  })
  @ApiQuery({
    name: 'size',
    type: 'number',
    description: 'Tamaño de la imagen (1-5)',
    example: 1,
    required: false,
  })
  getTeamCrest(
    @Param('teamId') teamId: string,
    @Query('size') size: string = '1',
  ) {
    const sizeNumber = parseInt(size, 10) || 1;
    return this.promiedosService.getTeamCrest(teamId, sizeNumber);
  }
}
