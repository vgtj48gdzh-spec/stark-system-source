import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessStatSummary } from '../business-stats/entities/business-stat-summary.entity';
import { RewardEventRule } from '../business-stats/entities/reward-event-rule.entity';
import { RewardEvent } from '../business-stats/entities/reward-event.entity';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { Employee } from '../performance/entities/employee.entity';
import { PerformancePeriod } from '../performance/entities/performance-period.entity';
import { PerformanceSummary } from '../performance/entities/performance-summary.entity';
import { User } from '../users/entities/user.entity';
import { PayrollTrialsController } from './payroll-trials.controller';
import { PayrollTrialsService } from './payroll-trials.service';
import { PayrollTrialItemDetail } from './entities/payroll-trial-item-detail.entity';
import { PayrollTrialItem } from './entities/payroll-trial-item.entity';
import { PayrollTrialRun } from './entities/payroll-trial-run.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Employee,
      PerformancePeriod,
      PerformanceSummary,
      RewardEvent,
      RewardEventRule,
      BusinessStatSummary,
      PayrollTrialRun,
      PayrollTrialItem,
      PayrollTrialItemDetail,
    ]),
    OperationLogsModule,
  ],
  controllers: [PayrollTrialsController],
  providers: [PayrollTrialsService],
  exports: [PayrollTrialsService],
})
export class PayrollTrialsModule {}
