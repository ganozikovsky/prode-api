import { ApiProperty } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';

export class UpdatePronosticDto {
  @ApiProperty({
    description: 'Nueva predicción del usuario (opcional)',
    example: {
      homeScore: 3,
      awayScore: 1,
      homeScorers: ["Messi", "Di Maria", "Lautaro"],
      awayScorers: ["Cavani"]
    },
    type: 'object',
    required: false
  })
  prediction?: Prisma.JsonValue;
}
