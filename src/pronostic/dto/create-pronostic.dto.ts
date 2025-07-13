import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PredictionDto } from './prediction.dto';

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
    type: PredictionDto,
  })
  @ValidateNested()
  @Type(() => PredictionDto)
  prediction: PredictionDto;
}
