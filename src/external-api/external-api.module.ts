import { Module } from '@nestjs/common';
import { PromiedosService } from './promiedos.service';
import { PromiedosController } from './promiedos.controller';

@Module({
  controllers: [PromiedosController],
  providers: [PromiedosService],
  exports: [PromiedosService],
})
export class ExternalApiModule {}
