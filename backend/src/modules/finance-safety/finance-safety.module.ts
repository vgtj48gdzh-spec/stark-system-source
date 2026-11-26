import { Module } from '@nestjs/common';
import { FinanceSafetyService } from './finance-safety.service';

@Module({
  providers: [FinanceSafetyService],
  exports: [FinanceSafetyService],
})
export class FinanceSafetyModule {}
