import { Module } from '@nestjs/common';
import { ExternalApiModule } from '../external-api/external-api.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [ExternalApiModule],
  controllers: [AdminController],
})
export class AdminModule {}
