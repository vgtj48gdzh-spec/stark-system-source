import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryTransactionsModule } from '../inventory-transactions/inventory-transactions.module';
import { MaterialPreparationsModule } from '../material-preparations/material-preparations.module';
import { MaterialPreparation } from '../material-preparations/entities/material-preparation.entity';
import { Material } from '../materials/entities/material.entity';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { WorkOrderMaterial } from './entities/work-order-material.entity';
import { WorkOrderMaterialsController } from './work-order-materials.controller';
import { WorkOrderMaterialsService } from './work-order-materials.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkOrderMaterial,
      WorkOrder,
      Material,
      Warehouse,
      MaterialPreparation,
    ]),
    InventoryTransactionsModule,
    MaterialPreparationsModule,
    OperationLogsModule,
  ],
  controllers: [WorkOrderMaterialsController],
  providers: [WorkOrderMaterialsService],
  exports: [WorkOrderMaterialsService],
})
export class WorkOrderMaterialsModule {}
