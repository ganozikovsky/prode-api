import { Module } from '@nestjs/common';
import { TournamentController } from './tournament.controller';
import { TournamentService } from './tournament.service';
import { PrismaService } from '../prisma.service';
import { ExternalApiModule } from '../external-api/external-api.module';

@Module({
  imports: [ExternalApiModule],
  controllers: [TournamentController],
  providers: [TournamentService, PrismaService],
  exports: [TournamentService],
})
export class TournamentModule {}
