import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ScorersDto {
  @ApiProperty({ required: false })
  @IsString()
  local?: string;

  @ApiProperty({ required: false })
  @IsString()
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

export class CreatePronosticDto {
  @ApiProperty({
    description: 'ID externo del partido obtenido de la API de promiedos',
    example: 'edcgcdj',
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  externalId: string;

  @ApiProperty({
    description: 'Predicción del usuario conteniendo marcadores y goleadores',
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
