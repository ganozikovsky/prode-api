import { ApiProperty } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';

export class CreatePronosticDto {
  @ApiProperty({
    description: 'ID externo del partido obtenido de la API de promiedos',
    example: '12345',
    type: 'string',
  })
  externalId: string;

  @ApiProperty({
    description: 'ID del usuario que hace el pronóstico',
    example: 1,
    type: 'number',
  })
  userId: number;

  @ApiProperty({
    description: 'Predicción del usuario conteniendo marcadores y goleadores',
    example: {
      homeScore: 2,
      awayScore: 1,
      homeScorers: ['Messi', 'Di Maria'],
      awayScorers: ['Cavani'],
    },
    type: 'object',
  })
  prediction: Prisma.JsonValue;
}
