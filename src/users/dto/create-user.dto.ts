import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'Email único del usuario (opcional para usuarios de Google)',
    example: 'usuario@ejemplo.com',
    format: 'email',
    required: false,
  })
  email?: string;

  @ApiProperty({
    description: 'Nombre completo del usuario (opcional)',
    example: 'Juan Pérez',
    required: false,
  })
  name?: string;

  @ApiProperty({
    description: 'Google ID del usuario (opcional)',
    example: '123456789',
    required: false,
  })
  googleId?: string;

  @ApiProperty({
    description: 'URL del avatar del usuario (opcional)',
    example: 'https://lh3.googleusercontent.com/...',
    required: false,
  })
  avatar?: string;
}
