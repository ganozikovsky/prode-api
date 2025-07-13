import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getApiInfo() {
    return {
      name: 'Prode API',
      description: 'API para pronósticos deportivos',
      version: '1.0.0',
      endpoints: {
        auth: {
          'GET /auth/google': 'Iniciar login con Google',
          'GET /auth/google/callback': 'Callback de Google (automático)',
          'POST /auth/google/verify':
            'Verificar token de Google desde frontend',
          'GET /auth/profile':
            'Obtener perfil del usuario autenticado (requiere JWT)',
        },
        users: {
          'POST /users': 'Crear usuario',
          'GET /users': 'Obtener todos los usuarios',
          'GET /users/:id': 'Obtener usuario por ID',
        },
        pronostics: {
          'POST /pronostics': 'Crear pronóstico',
          'GET /pronostics': 'Obtener todos los pronósticos',
          'GET /pronostics?externalId=XXX':
            'Obtener pronósticos por ID externo',
          'GET /pronostics?userId=XXX': 'Obtener pronósticos por usuario',
          'GET /pronostics/:id': 'Obtener pronóstico por ID',
          'PATCH /pronostics/:id': 'Actualizar pronóstico',
          'DELETE /pronostics/:id': 'Eliminar pronóstico',
        },
        promiedos: {},
      },
      authentication: {
        message: '🔐 Autenticación implementada con Google OAuth',
        instructions: 'Ver GOOGLE_AUTH_SETUP.md para configuración',
      },
    };
  }
}
