import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { RequireFormalActorIdentity } from '../../common/decorators/require-formal-actor-identity.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import {
  BindRepairPaymentIntentDto,
  BindRepairProcurementAllocationDto,
  CheckRepairDemandInventoryDto,
  CreateRepairPartFitmentEvidenceDto,
  CreateRepairProcurementDecisionDto,
  CreateRepairProcurementDemandDto,
  CreateRepairPurchaseOrderDto,
  CreateRepairSupplierInquiriesDto,
  CreateRepairSupplierWarrantyClaimDto,
  CreateRepairVehicleIdentityEvidenceDto,
  IssueRepairPurchaseOrderDto,
  MarkRepairProcurementInstalledDto,
  RecordRepairGoodsReceiptDto,
  RecordRepairSupplierQuoteDto,
  RecordRepairSupplierShipmentDto,
  RefreshRepairPaymentStateDto,
  RefreshRepairProcurementDecisionDto,
  RequestRepairProcurementLeaderApprovalDto,
  ReviewRepairEvidenceDto,
} from './dto/repair-shop-procurement.dto';
import { RepairShopProcurementService } from './repair-shop-procurement.service';

@Controller('repair-shop')
export class RepairShopProcurementController {
  constructor(private readonly service: RepairShopProcurementService) {}

  @Get('work-orders/:workOrderId/procurement/workspace')
  @Roles('operator', 'admin')
  getWorkspace(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('查询成功', this.service.getWorkspace(workOrderId, currentUser));
  }

  @Post('vehicles/:vehicleId/identity-evidence')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  createVehicleIdentityEvidence(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Body() dto: CreateRepairVehicleIdentityEvidenceDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('VIN 证据已创建，等待人工确认', this.service.createVehicleIdentityEvidence(vehicleId, dto, currentUser));
  }

  @Post('vehicles/:vehicleId/identity-evidence/:evidenceId/review')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  reviewVehicleIdentityEvidence(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('evidenceId', ParseIntPipe) evidenceId: number,
    @Body() dto: ReviewRepairEvidenceDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('VIN 证据审核完成', this.service.reviewVehicleIdentityEvidence(vehicleId, evidenceId, dto, currentUser));
  }

  @Post('work-orders/:workOrderId/procurement/fitment-evidence')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  createFitmentEvidence(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Body() dto: CreateRepairPartFitmentEvidenceDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('配件适配候选已创建', this.service.createFitmentEvidence(workOrderId, dto, currentUser));
  }

  @Post('work-orders/:workOrderId/procurement/fitment-evidence/:evidenceId/review')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  reviewFitmentEvidence(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Param('evidenceId', ParseIntPipe) evidenceId: number,
    @Body() dto: ReviewRepairEvidenceDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('配件适配证据审核完成', this.service.reviewFitmentEvidence(workOrderId, evidenceId, dto, currentUser));
  }

  @Post('work-orders/:workOrderId/procurement/demands')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  createDemand(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Body() dto: CreateRepairProcurementDemandDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('报料需求已建立', this.service.createDemand(workOrderId, dto, currentUser));
  }

  @Post('work-orders/:workOrderId/procurement/demands/:demandId/inventory-check')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  checkInventory(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Param('demandId', ParseIntPipe) demandId: number,
    @Body() dto: CheckRepairDemandInventoryDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('库存只读快照已刷新', this.service.checkInventory(workOrderId, demandId, dto, currentUser));
  }

  @Post('work-orders/:workOrderId/procurement/demands/:demandId/inquiries')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  createInquiries(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Param('demandId', ParseIntPipe) demandId: number,
    @Body() dto: CreateRepairSupplierInquiriesDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('供应商询价草稿已创建', this.service.createInquiries(workOrderId, demandId, dto, currentUser));
  }

  @Post('work-orders/:workOrderId/procurement/inquiries/:inquiryId/quotes')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  recordQuote(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Param('inquiryId', ParseIntPipe) inquiryId: number,
    @Body() dto: RecordRepairSupplierQuoteDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('供应商报价已登记', this.service.recordQuote(workOrderId, inquiryId, dto, currentUser));
  }

  @Post('work-orders/:workOrderId/procurement/demands/:demandId/leader-approval-requests')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  requestLeaderApproval(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Param('demandId', ParseIntPipe) demandId: number,
    @Body() dto: RequestRepairProcurementLeaderApprovalDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '精确采购审批请求已提交至现有审批中心',
      this.service.requestLeaderApproval(workOrderId, demandId, dto, currentUser),
    );
  }

  @Post('work-orders/:workOrderId/procurement/demands/:demandId/decisions')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  createDecision(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Param('demandId', ParseIntPipe) demandId: number,
    @Body() dto: CreateRepairProcurementDecisionDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('比价决策已创建', this.service.createDecision(workOrderId, demandId, dto, currentUser));
  }

  @Post('work-orders/:workOrderId/procurement/decisions/:decisionId/refresh')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  refreshDecision(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Param('decisionId', ParseIntPipe) decisionId: number,
    @Body() dto: RefreshRepairProcurementDecisionDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('授权状态已刷新', this.service.refreshDecision(workOrderId, decisionId, dto, currentUser));
  }

  @Post('work-orders/:workOrderId/procurement/purchase-orders')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  createPurchaseOrder(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Body() dto: CreateRepairPurchaseOrderDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('采购单已创建', this.service.createPurchaseOrder(workOrderId, dto, currentUser));
  }

  @Post('work-orders/:workOrderId/procurement/purchase-orders/:orderId/issue')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  issuePurchaseOrder(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: IssueRepairPurchaseOrderDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('采购单人工下发证据已登记', this.service.issuePurchaseOrder(workOrderId, orderId, dto, currentUser));
  }

  @Post('work-orders/:workOrderId/procurement/purchase-orders/:orderId/payment-intent')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  bindPaymentIntent(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: BindRepairPaymentIntentDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('总部付款意图已只读关联', this.service.bindPaymentIntent(workOrderId, orderId, dto, currentUser));
  }

  @Post('work-orders/:workOrderId/procurement/purchase-orders/:orderId/payment-state/refresh')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  refreshPaymentState(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: RefreshRepairPaymentStateDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('付款证据投影已刷新', this.service.refreshPaymentState(workOrderId, orderId, dto, currentUser));
  }

  @Post('work-orders/:workOrderId/procurement/purchase-orders/:orderId/shipments')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  recordShipment(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: RecordRepairSupplierShipmentDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('供应商发货已登记', this.service.recordShipment(workOrderId, orderId, dto, currentUser));
  }

  @Post('work-orders/:workOrderId/procurement/purchase-orders/:orderId/receipts')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  recordReceipt(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: RecordRepairGoodsReceiptDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('到货验收已登记，未自动改变库存', this.service.recordReceipt(workOrderId, orderId, dto, currentUser));
  }

  @Post('work-orders/:workOrderId/procurement/receipts/:receiptId/allocations')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  bindAllocation(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Param('receiptId', ParseIntPipe) receiptId: number,
    @Body() dto: BindRepairProcurementAllocationDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('到货材料已关联现有库存/工单材料记录', this.service.bindAllocation(workOrderId, receiptId, dto, currentUser));
  }

  @Post('work-orders/:workOrderId/procurement/allocations/:allocationId/install')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  markInstalled(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Param('allocationId', ParseIntPipe) allocationId: number,
    @Body() dto: MarkRepairProcurementInstalledDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('配件安装关联已登记', this.service.markInstalled(workOrderId, allocationId, dto, currentUser));
  }

  @Post('work-orders/:workOrderId/procurement/warranty-claims')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  createWarrantyClaim(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Body() dto: CreateRepairSupplierWarrantyClaimDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('供应商售后草稿已创建', this.service.createWarrantyClaim(workOrderId, dto, currentUser));
  }

  private async wrap(message: string, dataPromise: Promise<unknown>) {
    return { success: true, message, data: await dataPromise };
  }
}
