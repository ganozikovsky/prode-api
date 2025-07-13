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
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PronosticService } from './pronostic.service';
import { CreatePronosticDto } from './dto/create-pronostic.dto';
import { UpdatePronosticDto } from './dto/update-pronostic.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('pronostics')
@Controller('pronostics')
export class PronosticController {
  constructor(private readonly pronosticService: PronosticService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Crear nuevo pronóstico (requiere autenticación)',
    description:
      'Crea un nuevo pronóstico para un partido específico. Solo usuarios autenticados pueden crear pronósticos. Un usuario solo puede crear un pronóstico por partido. Si ya existe un pronóstico para ese partido, retorna error 409.',
  })
  @ApiBody({ type: CreatePronosticDto })
  @ApiResponse({
    status: 201,
    description: 'Pronóstico creado exitosamente',
    schema: {
      example: {
        id: 1,
        externalId: 'edcgcdj',
        userId: 1,
        prediction: {
          scores: [2, 1],
          scorers: ['Messi', 'Di María'],
        },
        createdAt: '2024-07-11T19:00:00.000Z',
        updatedAt: '2024-07-11T19:00:00.000Z',
        user: {
          id: 1,
          name: 'Juan Pérez',
          email: 'juan@ejemplo.com',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
  })
  @ApiResponse({
    status: 401,
    description: 'Token de autenticación requerido',
  })
  @ApiResponse({
    status: 409,
    description:
      'Ya tienes un pronóstico para este partido. Usa PATCH para editarlo.',
  })
  async create(
    @Body() createPronosticDto: CreatePronosticDto,
    @CurrentUser() user: any,
  ) {
    return this.pronosticService.create(createPronosticDto, user.id);
  }

  @Post('bulk')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Crear/actualizar múltiples pronósticos (requiere autenticación)',
    description:
      'Crea o actualiza múltiples pronósticos para diferentes partidos en una sola operación. Si ya existe un pronóstico para un partido, lo actualiza; si no existe, lo crea. Un usuario solo puede tener un pronóstico por partido.',
  })
  @ApiBody({
    type: [CreatePronosticDto],
    description: 'Array de pronósticos a crear',
    examples: {
      'bulk-pronostics': {
        summary: 'Múltiples pronósticos',
        value: [
          {
            externalId: 'edcgcdj',
            prediction: {
              scores: [2, 1],
              scorers: ['Messi', 'Di María'],
            },
          },
          {
            externalId: 'abcdef',
            prediction: {
              scores: [1, 1],
              scorers: ['Cavani', 'Suarez'],
            },
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Pronósticos creados/actualizados exitosamente',
    schema: {
      example: [
        {
          id: 1,
          externalId: 'edcgcdj',
          userId: 1,
          prediction: {
            scores: [2, 1],
            scorers: ['Messi', 'Di María'],
          },
          createdAt: '2024-07-11T19:00:00.000Z',
          updatedAt: '2024-07-11T19:00:00.000Z',
          user: {
            id: 1,
            name: 'Juan Pérez',
            email: 'juan@ejemplo.com',
          },
        },
        {
          id: 2,
          externalId: 'abcdef',
          userId: 1,
          prediction: {
            scores: [1, 1],
            scorers: ['Cavani', 'Suarez'],
          },
          createdAt: '2024-07-11T19:00:00.000Z',
          updatedAt: '2024-07-11T19:00:00.000Z',
          user: {
            id: 1,
            name: 'Juan Pérez',
            email: 'juan@ejemplo.com',
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
  })
  @ApiResponse({
    status: 401,
    description: 'Token de autenticación requerido',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
  })
  async createBulk(
    @Body() pronostics: CreatePronosticDto[],
    @CurrentUser() user: any,
  ) {
    return this.pronosticService.createBulk(pronostics, user.id);
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

  @Get('my-pronostics')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener mis pronósticos (requiere autenticación)',
    description: 'Obtiene todos los pronósticos del usuario autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de pronósticos del usuario autenticado',
  })
  @ApiResponse({
    status: 401,
    description: 'Token de autenticación requerido',
  })
  async getMyPronostics(@CurrentUser() user: any) {
    return {
      message: `✅ Pronósticos de ${user.name || user.email}`,
      pronostics: await this.pronosticService.findByUserId(user.id),
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener pronóstico por ID',
    description: 'Obtiene un pronóstico específico por su ID',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del pronóstico',
    example: '1',
  })
  @ApiResponse({
    status: 200,
    description: 'Pronóstico encontrado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Pronóstico no encontrado',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pronosticService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Actualizar pronóstico (requiere autenticación)',
    description:
      'Actualiza un pronóstico existente. Solo el propietario puede actualizarlo.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del pronóstico a actualizar',
    example: '1',
  })
  @ApiBody({ type: UpdatePronosticDto })
  @ApiResponse({
    status: 200,
    description: 'Pronóstico actualizado exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'Token de autenticación requerido',
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes permisos para actualizar este pronóstico',
  })
  @ApiResponse({
    status: 404,
    description: 'Pronóstico no encontrado',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePronosticDto: UpdatePronosticDto,
    @CurrentUser() user: any,
  ) {
    return this.pronosticService.update(id, updatePronosticDto, user.id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Eliminar pronóstico (requiere autenticación)',
    description:
      'Elimina un pronóstico existente. Solo el propietario puede eliminarlo.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del pronóstico a eliminar',
    example: '1',
  })
  @ApiResponse({
    status: 200,
    description: 'Pronóstico eliminado exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'Token de autenticación requerido',
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes permisos para eliminar este pronóstico',
  })
  @ApiResponse({
    status: 404,
    description: 'Pronóstico no encontrado',
  })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.pronosticService.remove(id, user.id);
  }
}
