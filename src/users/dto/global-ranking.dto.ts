import { ApiProperty } from '@nestjs/swagger';

export class GlobalUserDto {
  @ApiProperty({
    description: 'ID del usuario',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Nombre del usuario',
    example: 'Juan Pérez',
  })
  name: string;

  @ApiProperty({
    description: 'Email del usuario',
    example: 'juan@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Avatar del usuario',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  avatar?: string;
}

export class GlobalRankingResponseDto {
  @ApiProperty({
    description: 'Posición en el ranking global',
    example: 1,
  })
  position: number;

  @ApiProperty({
    description: 'Información del usuario',
    type: GlobalUserDto,
  })
  user: GlobalUserDto;

  @ApiProperty({
    description: 'Puntos globales acumulados del usuario',
    example: 87,
  })
  globalPoints: number;

  @ApiProperty({
    description: 'Cantidad de torneos en los que participa',
    example: 3,
  })
  tournamentsCount: number;

  @ApiProperty({
    description: 'Fecha cuando se registró en la plataforma',
    example: '2025-01-15T10:30:00Z',
  })
  joinedAt: string;
} 