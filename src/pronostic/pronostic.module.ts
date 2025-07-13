import { Module, forwardRef } from '@nestjs/common';
import { PronosticService } from './pronostic.service';
import { PronosticController } from './pronostic.controller';
import { PrismaService } from '../prisma.service';
import { ExternalApiModule } from '../external-api/external-api.module';

@Module({
  imports: [forwardRef(() => ExternalApiModule)],
  controllers: [PronosticController],
  providers: [PronosticService, PrismaService],
  exports: [PronosticService],
})
export class PronosticModule {}
