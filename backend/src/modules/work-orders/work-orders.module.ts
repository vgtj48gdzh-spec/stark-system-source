import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { SequenceModule } from '../sequence/sequence.module';
import { User } from '../users/entities/user.entity';
import { TemporaryServiceOrder } from './entities/temporary-service-order.entity';
import { WorkOrder } from './entities/work-order.entity';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersService } from './work-orders.service';
import { BusinessFoundationModule } from '../business-foundation/business-foundation.module';
import { WorkOrderIntakeService } from './work-order-intake.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TemporaryServiceOrder, WorkOrder, User]),
    SequenceModule,
    OperationLogsModule,
    BusinessFoundationModule,
  ],
  controllers: [WorkOrdersController],
  providers: [WorkOrdersService, WorkOrderIntakeService],
  exports: [WorkOrdersService],
})
export class WorkOrdersModule {}
