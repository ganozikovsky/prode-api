import { ApiProperty } from '@nestjs/swagger';
import { IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ScorersDto {
  @ApiProperty({ required: false })
  local?: string;

  @ApiProperty({ required: false })
  visitor?: string;
}

class PredictionDto {
  @ApiProperty({ type: [Number], description: 'Marcadores [local, visitante]' })
  scores: number[];

  @ApiProperty({ type: ScorersDto, description: 'Goleadores por equipo' })
  @ValidateNested()
  @Type(() => ScorersDto)
  scorers: ScorersDto;
}

export class UpdatePronosticDto {
  @ApiProperty({
    description: 'Predicción actualizada del usuario',
    example: {
      scores: [2, 1],
      scorers: {
        local: 'Messi',
        visitor: 'Di María'
      },
    },
    type: PredictionDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => PredictionDto)
  prediction: any; // Cambiado a any para compatibilidad con Prisma.JsonValue
}
