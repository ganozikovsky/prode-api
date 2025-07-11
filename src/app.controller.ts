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
        promiedos: {
          'GET /promiedos/league/:leagueCode/:tournamentId/:roundNumber/:seasonId':
            'Obtener partidos de Promiedos',
          'GET /promiedos/external-id/:leagueCode/:tournamentId/:roundNumber/:seasonId':
            'Generar ID externo',
        },
      },
    };
  }
}
