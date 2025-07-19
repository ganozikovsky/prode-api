import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { PointsService } from '../external-api/services/points.service';
import { GlobalRankingResponseDto } from './dto/global-ranking.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly pointsService: PointsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Crear nuevo usuario',
    description:
      'Crea un nuevo usuario en el sistema con email y nombre opcional',
  })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: 201,
    description: 'Usuario creado exitosamente',
    schema: {
      example: {
        id: 1,
        email: 'usuario@ejemplo.com',
        name: 'Juan Pérez',
        createdAt: '2024-07-11T19:00:00.000Z',
        updatedAt: '2024-07-11T19:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
  })
  @ApiResponse({
    status: 409,
    description: 'El email ya está registrado',
  })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener todos los usuarios',
    description:
      'Retorna una lista de todos los usuarios registrados en el sistema',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios obtenida exitosamente',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        example: {
          id: 1,
          email: 'usuario@ejemplo.com',
          name: 'Juan Pérez',
          createdAt: '2024-07-11T19:00:00.000Z',
          updatedAt: '2024-07-11T19:00:00.000Z',
        },
      },
    },
  })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener usuario por ID',
    description: 'Retorna los datos de un usuario específico basado en su ID',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID único del usuario',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario encontrado exitosamente',
    schema: {
      example: {
        id: 1,
        email: 'usuario@ejemplo.com',
        name: 'Juan Pérez',
        createdAt: '2024-07-11T19:00:00.000Z',
        updatedAt: '2024-07-11T19:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  @ApiResponse({
    status: 400,
    description: 'ID inválido',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  // ==========================================
  // 🌟 NUEVO ENDPOINT - RANKING GLOBAL
  // ==========================================

  @Get('ranking/global')
  @ApiOperation({
    summary: '🏆 Obtener ranking global de usuarios',
    description:
      'Obtiene el ranking global de TODOS los usuarios basado en sus puntos totales acumulados ' +
      'de todos los torneos en los que han participado. Incluye usuarios sin puntos (0 puntos) al final del ranking.',
  })
  @ApiResponse({
    status: 200,
    description: 'Ranking global obtenido exitosamente',
    type: [GlobalRankingResponseDto],
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
  })
  async getGlobalRanking(): Promise<GlobalRankingResponseDto[]> {
    return this.pointsService.getGlobalRanking();
  }
}
