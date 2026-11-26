import { Module } from '@nestjs/common';
import { FinanceSafetyModule } from '../finance-safety/finance-safety.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [FinanceSafetyModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
