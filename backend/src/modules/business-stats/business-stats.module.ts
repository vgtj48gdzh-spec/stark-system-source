import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbcRawCard } from '../abc-raw/entities/abc-raw-card.entity';
import { AbcRawOrder } from '../abc-raw/entities/abc-raw-order.entity';
import { AbcRawTransaction } from '../abc-raw/entities/abc-raw-transaction.entity';
import { AbcSyncCard } from '../abc-sync/entities/abc-sync-card.entity';
import { AbcSyncFund } from '../abc-sync/entities/abc-sync-fund.entity';
import { AbcSyncOrder } from '../abc-sync/entities/abc-sync-order.entity';
import { EmployeeBenefitCardRecord } from '../employee-benefits/entities/employee-benefit-card-record.entity';
import { EmployeeBenefitIssueItem } from '../employee-benefits/entities/employee-benefit-issue-item.entity';
import { EmployeeBenefitIssue } from '../employee-benefits/entities/employee-benefit-issue.entity';
import { EmployeeBenefitNotification } from '../employee-benefits/entities/employee-benefit-notification.entity';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { PayrollTrialItemDetail } from '../payroll-trials/entities/payroll-trial-item-detail.entity';
import { CustomerIdentificationBinding } from '../performance/entities/customer-identification-binding.entity';
import { EmployeeSourceBinding } from '../performance/entities/employee-source-binding.entity';
import { Employee } from '../performance/entities/employee.entity';
import { ExternalCardSalesStaging } from '../performance/entities/external-card-sales-staging.entity';
import { PaymentRecord } from '../payment-records/entities/payment-record.entity';
import { PayoutRecord } from '../payout-records/entities/payout-record.entity';
import { User } from '../users/entities/user.entity';
import { WorkOrderMaterial } from '../work-order-materials/entities/work-order-material.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { BusinessStatsController } from './business-stats.controller';
import { BusinessStatsService } from './business-stats.service';
import { BusinessStatSummary } from './entities/business-stat-summary.entity';
import { BusinessStatTag } from './entities/business-stat-tag.entity';
import { RewardEvent } from './entities/reward-event.entity';
import { RewardEventRule } from './entities/reward-event-rule.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Employee,
      CustomerIdentificationBinding,
      ExternalCardSalesStaging,
      EmployeeSourceBinding,
      WorkOrder,
      WorkOrderMaterial,
      PaymentRecord,
      PayoutRecord,
      AbcRawOrder,
      AbcRawCard,
      AbcRawTransaction,
      AbcSyncOrder,
      AbcSyncFund,
      AbcSyncCard,
      EmployeeBenefitIssue,
      EmployeeBenefitIssueItem,
      EmployeeBenefitCardRecord,
      EmployeeBenefitNotification,
      PayrollTrialItemDetail,
      BusinessStatTag,
      RewardEvent,
      RewardEventRule,
      BusinessStatSummary,
  ]),
    OperationLogsModule,
  ],
  providers: [BusinessStatsService],
  controllers: [BusinessStatsController],
  exports: [BusinessStatsService],
})
export class BusinessStatsModule {}
