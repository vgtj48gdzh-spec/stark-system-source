import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialPreparation } from '../material-preparations/entities/material-preparation.entity';
import { ApprovalLog } from '../approval-requests/entities/approval-log.entity';
import { ApprovalRequest } from '../approval-requests/entities/approval-request.entity';
import { Material } from '../materials/entities/material.entity';
import { MaterialStock } from '../material-stocks/entities/material-stock.entity';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { SequenceModule } from '../sequence/sequence.module';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { WorkOrderMaterial } from '../work-order-materials/entities/work-order-material.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { InventoryTransaction } from './entities/inventory-transaction.entity';
import { InventoryTransactionsController } from './inventory-transactions.controller';
import { InventoryMasterDataPreflightService } from './inventory-master-data-preflight.service';
import { InventoryTransactionsService } from './inventory-transactions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryTransaction,
      MaterialStock,
      Warehouse,
      Material,
      WorkOrder,
      MaterialPreparation,
      WorkOrderMaterial,
      Supplier,
      ApprovalRequest,
      ApprovalLog,
    ]),
    SequenceModule,
    OperationLogsModule,
  ],
  controllers: [InventoryTransactionsController],
  providers: [InventoryTransactionsService, InventoryMasterDataPreflightService],
  exports: [InventoryTransactionsService],
})
export class InventoryTransactionsModule {}
