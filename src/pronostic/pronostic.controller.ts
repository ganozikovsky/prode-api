import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { PronosticService } from './pronostic.service';
import { CreatePronosticDto } from './dto/create-pronostic.dto';
import { UpdatePronosticDto } from './dto/update-pronostic.dto';

@ApiTags('pronostics')
@Controller('pronostics')
export class PronosticController {
  constructor(private readonly pronosticService: PronosticService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear nuevo pronóstico',
    description: 'Crea un nuevo pronóstico para un partido específico',
  })
  @ApiBody({ type: CreatePronosticDto })
  @ApiResponse({
    status: 201,
    description: 'Pronóstico creado exitosamente',
    schema: {
      example: {
        id: 1,
        externalId: '12345',
        userId: 1,
        prediction: {
          homeScore: 2,
          awayScore: 1,
          homeScorers: ['Messi', 'Di Maria'],
          awayScorers: ['Cavani'],
        },
        createdAt: '2024-07-11T19:00:00.000Z',
        updatedAt: '2024-07-11T19:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
  })
  create(@Body() createPronosticDto: CreatePronosticDto) {
    return this.pronosticService.create(createPronosticDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener pronósticos',
    description:
      'Obtiene pronósticos con filtros opcionales por externalId o userId',
  })
  @ApiQuery({
    name: 'externalId',
    required: false,
    description: 'ID externo del partido para filtrar pronósticos',
    example: '12345',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'ID del usuario para filtrar sus pronósticos',
    example: '1',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de pronósticos obtenida exitosamente',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        example: {
          id: 1,
          externalId: '12345',
          userId: 1,
          prediction: {
            homeScore: 2,
            awayScore: 1,
            homeScorers: ['Messi', 'Di Maria'],
            awayScorers: ['Cavani'],
          },
          createdAt: '2024-07-11T19:00:00.000Z',
          updatedAt: '2024-07-11T19:00:00.000Z',
        },
      },
    },
  })
  findAll(
    @Query('externalId') externalId?: string,
    @Query('userId') userId?: string,
  ) {
    if (externalId) {
      return this.pronosticService.findByExternalId(externalId);
    }

    if (userId) {
      return this.pronosticService.findByUserId(parseInt(userId));
    }

    return this.pronosticService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener pronóstico por ID',
    description: 'Retorna un pronóstico específico basado en su ID',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID único del pronóstico',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Pronóstico encontrado exitosamente',
    schema: {
      example: {
        id: 1,
        externalId: '12345',
        userId: 1,
        prediction: {
          homeScore: 2,
          awayScore: 1,
          homeScorers: ['Messi', 'Di Maria'],
          awayScorers: ['Cavani'],
        },
        createdAt: '2024-07-11T19:00:00.000Z',
        updatedAt: '2024-07-11T19:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Pronóstico no encontrado',
  })
  @ApiResponse({
    status: 400,
    description: 'ID inválido',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pronosticService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar pronóstico',
    description: 'Actualiza un pronóstico existente con nuevos datos',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID único del pronóstico a actualizar',
    example: 1,
  })
  @ApiBody({ type: UpdatePronosticDto })
  @ApiResponse({
    status: 200,
    description: 'Pronóstico actualizado exitosamente',
    schema: {
      example: {
        id: 1,
        externalId: '12345',
        userId: 1,
        prediction: {
          homeScore: 3,
          awayScore: 1,
          homeScorers: ['Messi', 'Di Maria', 'Lautaro'],
          awayScorers: ['Cavani'],
        },
        createdAt: '2024-07-11T19:00:00.000Z',
        updatedAt: '2024-07-11T20:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Pronóstico no encontrado',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePronosticDto: UpdatePronosticDto,
  ) {
    return this.pronosticService.update(id, updatePronosticDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar pronóstico',
    description: 'Elimina un pronóstico específico del sistema',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID único del pronóstico a eliminar',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Pronóstico eliminado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Pronóstico no encontrado',
  })
  @ApiResponse({
    status: 400,
    description: 'ID inválido',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.pronosticService.remove(id);
  }
}
