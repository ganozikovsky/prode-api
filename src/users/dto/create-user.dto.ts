import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'Email único del usuario',
    example: 'usuario@ejemplo.com',
    format: 'email'
  })
  email: string;

  @ApiProperty({
    description: 'Nombre completo del usuario (opcional)',
    example: 'Juan Pérez',
    required: false
  })
  name?: string;
}
