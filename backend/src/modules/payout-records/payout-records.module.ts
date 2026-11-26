import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalRequest } from '../approval-requests/entities/approval-request.entity';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { SequenceModule } from '../sequence/sequence.module';
import { PayoutRecordsController } from './payout-records.controller';
import { PayoutRecordsService } from './payout-records.service';
import { PayoutRecord } from './entities/payout-record.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PayoutRecord, ApprovalRequest]),
    SequenceModule,
    OperationLogsModule,
  ],
  controllers: [PayoutRecordsController],
  providers: [PayoutRecordsService],
  exports: [PayoutRecordsService],
})
export class PayoutRecordsModule {}
