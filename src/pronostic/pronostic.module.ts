import { Module } from '@nestjs/common';
import { PronosticService } from './pronostic.service';
import { PronosticController } from './pronostic.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [PronosticController],
  providers: [PronosticService, PrismaService],
  exports: [PronosticService],
})
export class PronosticModule {}
