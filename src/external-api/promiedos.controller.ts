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

  @Get('lpf/current')
  @ApiOperation({
    summary: '🎯 Obtener la fecha actual automáticamente',
    description:
      'Calcula automáticamente qué fecha mostrar basándose en el estado de los partidos. ' +
      'Usa inteligencia artificial para determinar si mostrar la fecha en curso, ' +
      'la próxima fecha programada, o la última fecha con información válida.',
  })
  @ApiResponse({
    status: 200,
    description: 'Datos de la fecha actual calculada automáticamente',
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
    },
  })
  async getCurrentMatchday() {
    return this.promiedosService.getMatchday();
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

  // ==========================================
  // 🔧 ENDPOINTS ADMINISTRATIVOS
  // ==========================================

  @Get('admin/refresh-current-round')
  @ApiOperation({
    summary: '🔄 Forzar recálculo de current_matchday',
    description:
      'Ejecuta manualmente la lógica pesada de cálculo de fecha actual y actualiza la base de datos. ' +
      'Útil cuando sabes que hubo cambios importantes en los horarios de partidos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Recálculo ejecutado correctamente',
    schema: {
      example: {
        success: true,
        previousRound: 4,
        newRound: 5,
        updatedBy: 'manual',
        timestamp: '2025-01-15T14:30:00Z',
        executionTimeMs: 2847,
      },
    },
  })
  async refreshCurrentRound() {
    return await this.promiedosService.refreshCurrentMatchday('manual');
  }

  // ==========================================
  // 🎯 ENDPOINTS SISTEMA DE PUNTOS (TESTING)
  // ==========================================

  @Get('admin/points/process-now')
  @ApiOperation({
    summary: '🎲 Procesar puntos manualmente',
    description:
      'Ejecuta inmediatamente el procesamiento de puntos para partidos finalizados. ' +
      'Útil para testing o cuando necesitas forzar el cálculo de puntos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Procesamiento de puntos ejecutado',
    schema: {
      example: {
        success: true,
        message: 'Procesamiento de puntos completado',
        timestamp: '2025-01-15T16:45:00Z',
      },
    },
  })
  async processPointsManually() {
    try {
      await this.promiedosService.executePointsProcessingManually();
      return {
        success: true,
        message: 'Procesamiento de puntos completado',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('admin/points/activate')
  @ApiOperation({
    summary: '🔋 Activar procesamiento automático de puntos',
    description:
      'Activa manualmente el sistema de procesamiento automático de puntos ' +
      '(15:00-01:00, cada 5 minutos). Útil para testing.',
  })
  @ApiResponse({
    status: 200,
    description: 'Procesamiento automático activado',
  })
  async activatePointsProcessing() {
    try {
      await this.promiedosService.forceActivatePointsProcessing();
      return {
        success: true,
        message: 'Procesamiento automático de puntos ACTIVADO',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('admin/points/deactivate')
  @ApiOperation({
    summary: '🛑 Desactivar procesamiento automático de puntos',
    description:
      'Desactiva manualmente el sistema de procesamiento automático de puntos. ' +
      'Útil para testing o mantenimiento.',
  })
  @ApiResponse({
    status: 200,
    description: 'Procesamiento automático desactivado',
  })
  async deactivatePointsProcessing() {
    try {
      await this.promiedosService.forceDeactivatePointsProcessing();
      return {
        success: true,
        message: 'Procesamiento automático de puntos DESACTIVADO',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('admin/points/status')
  @ApiOperation({
    summary: '📊 Estado del sistema de puntos',
    description:
      'Obtiene información sobre el estado actual del sistema de procesamiento de puntos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado del sistema de puntos',
    schema: {
      example: {
        pointsProcessing: {
          isActive: true,
          cronName: 'process-points-dynamic',
          description: 'Procesando puntos cada 5 min (15:00-01:00)',
        },
        hasMatchesToday: true,
        timestamp: '2025-01-15T16:45:00Z',
      },
    },
  })
  async getPointsSystemStatus() {
    try {
      const status = await this.promiedosService.getPointsProcessingStatus();
      const hasMatchesToday = await this.promiedosService.hasMatchesToday();

      return {
        pointsProcessing: status,
        hasMatchesToday,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
