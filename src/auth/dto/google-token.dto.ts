import { ApiProperty } from '@nestjs/swagger';

export class GoogleTokenDto {
  @ApiProperty({
    description: 'Token de Google Identity Services',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjZmNzI1YTdkZjU5ZWQ...',
  })
  credential: string;
}
