import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PromiedosService } from './promiedos.service';

@ApiTags('external-api')
@Controller('promiedos')
export class PromiedosController {
  constructor(private readonly promiedosService: PromiedosService) {}

  @Get('lpf/:roundId')
  @ApiOperation({
    summary: 'Obtener información de fecha de LPF',
    description:
      'Obtiene los partidos y datos de una fecha específica de la Liga Profesional de Fútbol desde promiedos.com.ar',
  })
  @ApiParam({
    name: 'roundId',
    type: 'number',
    description: 'Número de la fecha/jornada',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Información de la fecha obtenida exitosamente',
    schema: {
      example: {
        roundId: 1,
        matches: [
          {
            id: '12345',
            homeTeam: 'Boca Juniors',
            awayTeam: 'River Plate',
            date: '2024-07-15T21:00:00Z',
            status: 'scheduled',
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'ID de fecha inválido',
  })
  @ApiResponse({
    status: 404,
    description: 'Fecha no encontrada',
  })
  @ApiResponse({
    status: 503,
    description: 'Error al conectar con la API externa',
  })
  getLeagueInfo(@Param('roundId', ParseIntPipe) roundId: number) {
    return this.promiedosService.getMatchday(roundId);
  }
}
