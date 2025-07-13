import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ArrayMaxSize,
  ArrayMinSize,
  Min,
} from 'class-validator';

export class PredictionDto {
  @ApiProperty({
    description:
      'Array de marcadores (obligatorio). Debe contener exactamente 2 números >= 0',
    example: [1, 1],
    type: 'array',
    items: { type: 'number', minimum: 0 },
    minItems: 2,
    maxItems: 2,
  })
  @IsArray()
  @IsNotEmpty()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  scores: number[];

  @ApiPropertyOptional({
    description: 'Array opcional de goleadores. Máximo 2 elementos',
    example: ['Cavani', 'Suarez'],
    type: 'array',
    items: { type: 'string' },
    maxItems: 2,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsString({ each: true })
  scorers?: string[];
}
