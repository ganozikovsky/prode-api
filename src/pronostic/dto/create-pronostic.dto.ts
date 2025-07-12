import { ApiProperty } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';

export class CreatePronosticDto {
  @ApiProperty({
    description: 'ID externo del partido obtenido de la API de promiedos',
    example: 'edcgcdj',
    type: 'string',
  })
  externalId: string;

  @ApiProperty({
    description: 'Predicción del usuario conteniendo marcadores y goleadores',
    example: {
      scores: [2, 1],
      scorers: ['Messi', 'Di María'],
    },
    type: 'object',
  })
  prediction: Prisma.JsonValue;
}
