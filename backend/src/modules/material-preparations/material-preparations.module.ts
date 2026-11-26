import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Material } from '../materials/entities/material.entity';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { SequenceModule } from '../sequence/sequence.module';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { User } from '../users/entities/user.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { MaterialPreparation } from './entities/material-preparation.entity';
import { MaterialPreparationsController } from './material-preparations.controller';
import { MaterialPreparationsService } from './material-preparations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MaterialPreparation,
      Material,
      Supplier,
      WorkOrder,
      User,
      Warehouse,
    ]),
    SequenceModule,
    OperationLogsModule,
  ],
  controllers: [MaterialPreparationsController],
  providers: [MaterialPreparationsService],
  exports: [MaterialPreparationsService],
})
export class MaterialPreparationsModule {}
