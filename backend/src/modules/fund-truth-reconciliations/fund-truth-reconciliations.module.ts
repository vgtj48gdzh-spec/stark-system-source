import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbcSyncFund } from '../abc-sync/entities/abc-sync-fund.entity';
import { ApprovalLog } from '../approval-requests/entities/approval-log.entity';
import { ApprovalRequest } from '../approval-requests/entities/approval-request.entity';
import { PaymentRecord } from '../payment-records/entities/payment-record.entity';
import { PayoutRecord } from '../payout-records/entities/payout-record.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { FundTruthReconciliationsController } from './fund-truth-reconciliations.controller';
import { FundTruthReconciliationsService } from './fund-truth-reconciliations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApprovalRequest,
      ApprovalLog,
      PaymentRecord,
      PayoutRecord,
      AbcSyncFund,
      WorkOrder,
    ]),
  ],
  controllers: [FundTruthReconciliationsController],
  providers: [FundTruthReconciliationsService],
})
export class FundTruthReconciliationsModule {}
