import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PredictionDto } from './prediction.dto';

export class UpdatePronosticDto {
  @ApiProperty({
    description: 'Nueva predicción del usuario (opcional)',
    type: PredictionDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PredictionDto)
  prediction?: PredictionDto;
}
