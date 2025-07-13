import { Module } from '@nestjs/common';
import { ExternalApiModule } from '../external-api/external-api.module';
import { MonitoringController } from './monitoring.controller';

@Module({
  imports: [ExternalApiModule],
  controllers: [MonitoringController],
})
export class MonitoringModule {}
