import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { OperationLog } from '../operation-logs/entities/operation-log.entity';
import { SequenceModule } from '../sequence/sequence.module';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { PaymentRecord } from './entities/payment-record.entity';
import { PaymentRecordsController } from './payment-records.controller';
import { PaymentRecordsService } from './payment-records.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentRecord, WorkOrder, OperationLog]),
    SequenceModule,
    OperationLogsModule,
  ],
  controllers: [PaymentRecordsController],
  providers: [PaymentRecordsService],
  exports: [PaymentRecordsService],
})
export class PaymentRecordsModule {}
