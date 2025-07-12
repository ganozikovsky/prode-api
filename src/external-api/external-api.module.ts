import { Module } from '@nestjs/common';
import { PromiedosService } from './promiedos.service';
import { PromiedosController } from './promiedos.controller';
import { PronosticModule } from '../pronostic/pronostic.module';

@Module({
  imports: [PronosticModule], // Importar el módulo de pronósticos
  controllers: [PromiedosController],
  providers: [PromiedosService],
  exports: [PromiedosService],
})
export class ExternalApiModule {}
