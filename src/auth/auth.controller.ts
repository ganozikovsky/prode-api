import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { GoogleTokenDto } from './dto/google-token.dto';
import { Request, Response } from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @ApiOperation({
    summary: 'Iniciar autenticación con Google',
    description: 'Redirige al usuario a Google para autenticación OAuth',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirección a Google OAuth',
  })
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    return {
      message: '🔄 Iniciando autenticación con Google',
    };
  }

  @Get('google/callback')
  @ApiOperation({
    summary: 'Callback de Google OAuth',
    description: 'Maneja el callback de Google y genera tokens JWT',
  })
  @ApiResponse({
    status: 200,
    description: 'Autenticación exitosa, tokens generados',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 1,
          email: 'usuario@gmail.com',
          name: 'Usuario Ejemplo',
          avatar: 'https://lh3.googleusercontent.com/...',
        },
      },
    },
  })
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user;
    const tokens = await this.authService.generateTokens(user);

    // En producción, podrías redirigir al frontend con el token
    // res.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${tokens.access_token}`);

    // Para desarrollo, retornamos JSON
    return res.json({
      message: '🎉 Autenticación exitosa con Google',
      ...tokens,
    });
  }

  @Post('google/verify')
  @ApiOperation({
    summary: 'Verificar token de Google desde frontend',
    description: 'Verifica el token de Google Identity Services y retorna JWT',
  })
  @ApiBody({ type: GoogleTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Token verificado exitosamente',
    schema: {
      example: {
        message: '🎉 Autenticación exitosa con Google',
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 1,
          email: 'usuario@gmail.com',
          name: 'Usuario Ejemplo',
          avatar: 'https://lh3.googleusercontent.com/...',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Token de Google inválido',
  })
  async verifyGoogleToken(@Body() body: GoogleTokenDto) {
    try {
      // Verificar el token de Google
      const ticket = await this.authService.verifyGoogleToken(body.credential);
      const payload = ticket.getPayload();

      if (!payload) {
        throw new BadRequestException('Token de Google inválido');
      }

      // Validar o crear usuario
      const user = await this.authService.validateGoogleUser({
        id: payload.sub,
        displayName: payload.name,
        emails: [{ value: payload.email }],
        photos: [{ value: payload.picture }],
      });

      // Generar tokens JWT
      const tokens = await this.authService.generateTokens(user);

      return {
        message: '🎉 Autenticación exitosa con Google',
        ...tokens,
      };
    } catch (error) {
      throw new BadRequestException('Token de Google inválido');
    }
  }

  @Get('profile')
  @ApiOperation({
    summary: 'Obtener perfil del usuario autenticado',
    description: 'Retorna los datos del usuario actual basado en el JWT',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil del usuario',
    schema: {
      example: {
        id: 1,
        email: 'usuario@gmail.com',
        name: 'Usuario Ejemplo',
        avatar: 'https://lh3.googleusercontent.com/...',
        createdAt: '2024-07-11T19:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Token inválido o expirado',
  })
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Req() req: Request) {
    return {
      message: '✅ Usuario autenticado',
      user: req.user,
    };
  }
}
