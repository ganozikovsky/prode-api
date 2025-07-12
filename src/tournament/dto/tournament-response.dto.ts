import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ParticipantResponseDto {
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

  @ApiProperty({
    description: 'Puntos del usuario en este torneo',
    example: 150,
  })
  points: number;

  @ApiProperty({
    description: 'Fecha cuando se unió al torneo',
    example: '2025-01-15T10:30:00Z',
  })
  joinedAt: string;
}

export class TournamentResponseDto {
  @ApiProperty({
    description: 'ID del torneo',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Nombre del torneo',
    example: 'Liga Amigos 2025',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Descripción del torneo',
    example: 'Torneo de pronósticos entre amigos para la Liga Profesional',
  })
  description?: string;

  @ApiProperty({
    description: 'Código de invitación',
    example: 'ABC123',
  })
  inviteCode: string;

  @ApiProperty({
    description: 'Información del creador del torneo',
    type: () => ({
      id: { type: 'number' },
      name: { type: 'string' },
      email: { type: 'string' },
    }),
  })
  creator: {
    id: number;
    name: string;
    email: string;
  };

  @ApiProperty({
    description: 'Si el torneo está activo',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Fecha de creación',
    example: '2025-01-15T10:30:00Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Número total de participantes',
    example: 8,
  })
  participantCount: number;

  @ApiProperty({
    description: 'Lista de participantes (opcional)',
    type: [ParticipantResponseDto],
    required: false,
  })
  participants?: ParticipantResponseDto[];
}

export class JoinTournamentResponseDto {
  @ApiProperty({
    description: 'Éxito de la operación',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Mensaje de confirmación',
    example: 'Te has unido al torneo exitosamente',
  })
  message: string;

  @ApiProperty({
    description: 'Información del torneo',
    type: TournamentResponseDto,
  })
  tournament: TournamentResponseDto;
}
