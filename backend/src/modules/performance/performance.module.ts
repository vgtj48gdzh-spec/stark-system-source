import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbcRawCard } from '../abc-raw/entities/abc-raw-card.entity';
import { AbcRawOrder } from '../abc-raw/entities/abc-raw-order.entity';
import { AbcRawTransaction } from '../abc-raw/entities/abc-raw-transaction.entity';
import { AbcSyncCardLedger } from '../abc-sync/entities/abc-sync-card-ledger.entity';
import { AbcSyncFund } from '../abc-sync/entities/abc-sync-fund.entity';
import { AbcSyncOrder } from '../abc-sync/entities/abc-sync-order.entity';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { User } from '../users/entities/user.entity';
import { WorkOrderMaterial } from '../work-order-materials/entities/work-order-material.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { CustomerIdentificationBinding } from './entities/customer-identification-binding.entity';
import { EmployeeSourceBinding } from './entities/employee-source-binding.entity';
import { Employee } from './entities/employee.entity';
import { ExternalCardSalesStaging } from './entities/external-card-sales-staging.entity';
import { PerformanceEvent } from './entities/performance-event.entity';
import { PerformanceEventClassification } from './entities/performance-event-classification.entity';
import { PerformancePeriod } from './entities/performance-period.entity';
import { PerformanceRule } from './entities/performance-rule.entity';
import { PerformanceSummaryManualDecision } from './entities/performance-summary-manual-decision.entity';
import { PerformanceSummary } from './entities/performance-summary.entity';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Employee,
      CustomerIdentificationBinding,
      ExternalCardSalesStaging,
      EmployeeSourceBinding,
      PerformanceEvent,
      PerformanceEventClassification,
      PerformancePeriod,
      PerformanceRule,
      PerformanceSummaryManualDecision,
      PerformanceSummary,
      WorkOrder,
      WorkOrderMaterial,
      AbcSyncOrder,
      AbcSyncFund,
      AbcSyncCardLedger,
      AbcRawOrder,
      AbcRawCard,
      AbcRawTransaction,
    ]),
    OperationLogsModule,
  ],
  controllers: [PerformanceController],
  providers: [PerformanceService],
  exports: [PerformanceService],
})
export class PerformanceModule {}
