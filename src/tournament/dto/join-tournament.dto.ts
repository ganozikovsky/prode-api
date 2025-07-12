import { IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class JoinTournamentDto {
  @ApiProperty({
    description: 'Código de invitación del torneo',
    example: 'ABC123',
    minLength: 6,
    maxLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 10)
  inviteCode: string;
}
