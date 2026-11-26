import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { BusinessFoundationModule } from '../business-foundation/business-foundation.module';
import { SequenceModule } from '../sequence/sequence.module';
import { Employee } from '../performance/entities/employee.entity';
import { User } from '../users/entities/user.entity';
import { WorkOrderMaterial } from '../work-order-materials/entities/work-order-material.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { REPAIR_SHOP_ENTITIES } from './entities/repair-shop.entities';
import { RepairShopAiDraftService } from './repair-shop-ai-draft.service';
import { RepairShopAssistantController } from './repair-shop-assistant.controller';
import { RepairShopController } from './repair-shop.controller';
import { RepairShopProcurementController } from './repair-shop-procurement.controller';
import { RepairShopProcurementService } from './repair-shop-procurement.service';
import { RepairShopScopeService } from './repair-shop-scope.service';
import { RepairShopService } from './repair-shop.service';
import { RepairAuthorityCaptureController } from './repair-authority-capture.controller';
import { RepairAuthorityCaptureService } from './repair-authority-capture.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ...REPAIR_SHOP_ENTITIES,
      WorkOrder,
      WorkOrderMaterial,
      Employee,
      User,
    ]),
    OperationLogsModule,
    BusinessFoundationModule,
    SequenceModule,
  ],
  controllers: [RepairShopController, RepairShopAssistantController, RepairShopProcurementController, RepairAuthorityCaptureController],
  providers: [
    RepairShopService,
    RepairShopScopeService,
    RepairShopAiDraftService,
    RepairShopProcurementService,
    RepairAuthorityCaptureService,
  ],
  exports: [RepairShopService, RepairShopProcurementService],
})
export class RepairShopModule {}
