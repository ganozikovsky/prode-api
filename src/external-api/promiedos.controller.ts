import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { PromiedosService } from './promiedos.service';

@ApiTags('external-api')
@Controller('promiedos')
export class PromiedosController {
  constructor(private readonly promiedosService: PromiedosService) {}

  @Get('lpf/:roundId')
  @ApiOperation({
    summary: 'Obtener información completa de una fecha',
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
                // ... otros campos
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
