import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbcSyncInventoryLedger } from '../abc-sync/entities/abc-sync-inventory-ledger.entity';
import { AbcSyncMaterial } from '../abc-sync/entities/abc-sync-material.entity';
import { AbcSyncSupplier } from '../abc-sync/entities/abc-sync-supplier.entity';
import { AbcSyncWarehouse } from '../abc-sync/entities/abc-sync-warehouse.entity';
import { InventoryTransaction } from '../inventory-transactions/entities/inventory-transaction.entity';
import { MaterialStock } from '../material-stocks/entities/material-stock.entity';
import { Material } from '../materials/entities/material.entity';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { SequenceModule } from '../sequence/sequence.module';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { WorkOrderMaterial } from '../work-order-materials/entities/work-order-material.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { ApprovalRequestDraftsController } from './approval-request-drafts.controller';
import { ApprovalRequestDraftsService } from './approval-request-drafts.service';
import { ApprovalWarehouseEvidenceIntakeService } from './approval-warehouse-evidence-intake.service';
import { ApprovalWarehousePreviewReadonlyController } from './approval-warehouse-preview-readonly.controller';
import { ApprovalWarehousePreviewReadonlyService } from './approval-warehouse-preview-readonly.service';
import { ApprovalRequestsController } from './approval-requests.controller';
import { ApprovalRequestsService } from './approval-requests.service';
import { ApprovalLog } from './entities/approval-log.entity';
import { ApprovalRequestDraft } from './entities/approval-request-draft.entity';
import { ApprovalRequest } from './entities/approval-request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApprovalRequest,
      ApprovalRequestDraft,
      ApprovalLog,
      WorkOrder,
      AbcSyncMaterial,
      AbcSyncSupplier,
      AbcSyncWarehouse,
      AbcSyncInventoryLedger,
      Warehouse,
      Material,
      Supplier,
      MaterialStock,
      InventoryTransaction,
      WorkOrderMaterial,
    ]),
    SequenceModule,
    OperationLogsModule,
  ],
  controllers: [
    ApprovalRequestDraftsController,
    ApprovalWarehousePreviewReadonlyController,
    ApprovalRequestsController,
  ],
  providers: [
    ApprovalRequestsService,
    ApprovalRequestDraftsService,
    ApprovalWarehouseEvidenceIntakeService,
    ApprovalWarehousePreviewReadonlyService,
  ],
  exports: [ApprovalRequestsService],
})
export class ApprovalRequestsModule {}
