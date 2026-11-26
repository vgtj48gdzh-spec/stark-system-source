import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { RequireFormalActorIdentity } from '../../common/decorators/require-formal-actor-identity.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import {
  AttachRepairWorkOrderDto,
  CloseRepairVehicleCustomerLinkDto,
  CreateRepairAiDraftDto,
  CreateRepairConfirmationRequestDto,
  CreateRepairDeliveryDto,
  CreateRepairDocumentVersionDto,
  CreateRepairKnowledgeReferenceDto,
  CreateRepairLaborItemDto,
  CreateRepairPartLinkDto,
  CreateRepairQualityInspectionDto,
  CreateRepairTaskDto,
  CreateRepairVehicleDto,
  CreateRepairVehicleCustomerLinkDto,
  CreateRepairWarrantyDto,
  QueryRepairKnowledgeDto,
  QueryRepairVehiclesDto,
  RecordRepairConfirmationDecisionDto,
  ReviewRepairDocumentVersionDto,
  TransitionRepairLifecycleDto,
  UpdateRepairKnowledgeReviewDto,
  UpdateRepairTaskStatusDto,
  UpdateRepairVehicleDto,
} from './dto/repair-shop.dto';
import { RepairShopService } from './repair-shop.service';
import { AdmitRepairPrequoteDto, QueryRepairPrequoteReadinessDto } from './dto/repair-prequote.dto';
import { QueryRepairFirstVisitDto, ReviewRepairFirstVisitDto } from './dto/repair-first-visit.dto';

@Controller('repair-shop')
export class RepairShopController {
  constructor(private readonly repairShopService: RepairShopService) {}

  @Get('vehicles')
  @Roles('operator', 'admin')
  listVehicles(
    @Query() query: QueryRepairVehiclesDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('查询成功', this.repairShopService.listVehicles(query, currentUser));
  }

  @Post('vehicles')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  createVehicle(
    @Body() dto: CreateRepairVehicleDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('车辆档案已创建', this.repairShopService.createVehicle(dto, currentUser));
  }

  @Patch('vehicles/:id')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  updateVehicle(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRepairVehicleDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('车辆档案已更新', this.repairShopService.updateVehicle(id, dto, currentUser));
  }

  @Post('vehicles/:id/customer-links')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  createVehicleCustomerLink(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateRepairVehicleCustomerLinkDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '车辆客户关系已追加',
      this.repairShopService.createVehicleCustomerLink(id, dto, currentUser),
    );
  }

  @Patch('vehicles/:id/customer-links/:linkId/close')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  closeVehicleCustomerLink(
    @Param('id', ParseIntPipe) id: number,
    @Param('linkId', ParseIntPipe) linkId: number,
    @Body() dto: CloseRepairVehicleCustomerLinkDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '车辆客户关系已关闭',
      this.repairShopService.closeVehicleCustomerLink(id, linkId, dto, currentUser),
    );
  }

  @Get('work-orders/:workOrderId/workspace')
  @Roles('operator', 'admin')
  getWorkspace(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('查询成功', this.repairShopService.getWorkspace(workOrderId, currentUser));
  }

  @Post('work-orders/:workOrderId/profile')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  attachWorkOrder(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Body() dto: AttachRepairWorkOrderDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('汽修工单档案已建立', this.repairShopService.attachWorkOrder(workOrderId, dto, currentUser));
  }

  @Get('work-orders/:workOrderId/first-visit-review')
  @Header('Cache-Control', 'no-store')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  firstVisitPreview(@Param('workOrderId', ParseIntPipe) id: number,
    @Query() dto: QueryRepairFirstVisitDto, @CurrentUserDecorator() actor: CurrentUser) {
    return this.wrap('首访客户车辆核实预览；未确认报价或工资', this.repairShopService.firstVisitPreview(id, dto, actor));
  }

  @Post('work-orders/:workOrderId/first-visit-review')
  @Header('Cache-Control', 'no-store')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  reviewFirstVisit(@Param('workOrderId', ParseIntPipe) id: number,
    @Body() dto: ReviewRepairFirstVisitDto, @CurrentUserDecorator() actor: CurrentUser) {
    return this.wrap('首访资料已独立核实；请回读原单继续报价前流程', this.repairShopService.reviewFirstVisit(id, dto, actor));
  }

  @Get('work-orders/:workOrderId/prequote-readiness')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  prequoteReadiness(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Query() dto: QueryRepairPrequoteReadinessDto,
    @CurrentUserDecorator() actor: CurrentUser,
  ) {
    return this.wrap('报价前接入核验；不是业务授权', this.repairShopService.prequoteReadiness(workOrderId, dto, actor));
  }

  @Post('work-orders/:workOrderId/prequote-admission')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  admitPrequote(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Body() dto: AdmitRepairPrequoteDto,
    @CurrentUserDecorator() actor: CurrentUser,
  ) {
    return this.wrap('原工单已接入报价前资料流程；禁止施工或收款', this.repairShopService.admitPrequote(workOrderId, dto, actor));
  }

  @Get('work-orders/:workOrderId/owner-proposal-document-source')
  @Header('Cache-Control', 'no-store')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  getOwnerProposalDocumentSource(@Param('workOrderId', ParseIntPipe) id: number,
    @CurrentUserDecorator() actor: CurrentUser) {
    return this.wrap('原单材料来源；尚未确认报价、成本或付款', this.repairShopService.getOwnerProposalDocumentSource(id, actor));
  }

  @Post('work-orders/:workOrderId/documents')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  createDocument(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Body() dto: CreateRepairDocumentVersionDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '汽修业务版本已保存',
      this.repairShopService.createDocumentVersion(workOrderId, dto, currentUser),
    );
  }

  @Post('work-orders/:workOrderId/documents/:documentId/review')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  reviewDocument(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Param('documentId', ParseIntPipe) documentId: number,
    @Body() dto: ReviewRepairDocumentVersionDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '汽修业务版本审核结果已记录',
      this.repairShopService.reviewDocumentVersion(workOrderId, documentId, dto, currentUser),
    );
  }

  @Post('work-orders/:workOrderId/confirmation-requests')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  requestConfirmation(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Body() dto: CreateRepairConfirmationRequestDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '客户确认请求已生成；尚未代表客户确认',
      this.repairShopService.createConfirmationRequest(workOrderId, dto, currentUser),
    );
  }

  @Post('work-orders/:workOrderId/confirmation-requests/:requestId/decision')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  recordConfirmationDecision(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Param('requestId', ParseIntPipe) requestId: number,
    @Body() dto: RecordRepairConfirmationDecisionDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '客户决定及证据已记录',
      this.repairShopService.recordConfirmationDecision(workOrderId, requestId, dto, currentUser),
    );
  }

  @Post('work-orders/:workOrderId/tasks')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  createTask(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Body() dto: CreateRepairTaskDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('维修任务已创建', this.repairShopService.createTask(workOrderId, dto, currentUser));
  }

  @Patch('work-orders/:workOrderId/tasks/:taskId/status')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  updateTaskStatus(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: UpdateRepairTaskStatusDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '维修任务状态已更新',
      this.repairShopService.updateTaskStatus(workOrderId, taskId, dto, currentUser),
    );
  }

  @Post('work-orders/:workOrderId/labor-items')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  createLaborItem(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Body() dto: CreateRepairLaborItemDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('工时项目已关联', this.repairShopService.createLaborItem(workOrderId, dto, currentUser));
  }

  @Post('work-orders/:workOrderId/part-links')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  createPartLink(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Body() dto: CreateRepairPartLinkDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '既有工单材料已关联；未执行库存出库',
      this.repairShopService.createPartLink(workOrderId, dto, currentUser),
    );
  }

  @Post('work-orders/:workOrderId/quality-inspections')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  createQualityInspection(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Body() dto: CreateRepairQualityInspectionDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '质检结果已记录',
      this.repairShopService.createQualityInspection(workOrderId, dto, currentUser),
    );
  }

  @Post('work-orders/:workOrderId/delivery')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  createDelivery(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Body() dto: CreateRepairDeliveryDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('交车记录已保存', this.repairShopService.createDelivery(workOrderId, dto, currentUser));
  }

  @Post('work-orders/:workOrderId/warranties')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  createWarranty(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Body() dto: CreateRepairWarrantyDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('保修/售后记录已保存', this.repairShopService.createWarranty(workOrderId, dto, currentUser));
  }

  @Post('work-orders/:workOrderId/transition')
  @Roles('admin')
  @RequireFormalActorIdentity()
  transitionLifecycle(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Body() dto: TransitionRepairLifecycleDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '汽修工单状态已更新',
      this.repairShopService.transitionLifecycle(workOrderId, dto, currentUser),
    );
  }

  @Post('work-orders/:workOrderId/ai-drafts')
  @Roles('operator', 'admin')
  @RequireFormalActorIdentity()
  createAiDraft(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Body() dto: CreateRepairAiDraftDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      'AI 辅助草稿已生成；必须人工复核',
      this.repairShopService.createAiDraft(workOrderId, dto, currentUser),
    );
  }

  @Get('knowledge-references')
  @Roles('operator', 'admin')
  queryKnowledge(@Query() query: QueryRepairKnowledgeDto) {
    return this.wrap('查询成功', this.repairShopService.queryKnowledge(query));
  }

  @Post('knowledge-references')
  @Roles('admin')
  @RequireFormalActorIdentity()
  createKnowledgeReference(
    @Body() dto: CreateRepairKnowledgeReferenceDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '知识引用已登记',
      this.repairShopService.createKnowledgeReference(dto, currentUser),
    );
  }

  @Patch('knowledge-references/:id/review')
  @Roles('admin')
  @RequireFormalActorIdentity()
  updateKnowledgeReview(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRepairKnowledgeReviewDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '知识引用审核状态已更新',
      this.repairShopService.updateKnowledgeReview(id, dto, currentUser),
    );
  }

  private async wrap(message: string, dataPromise: Promise<unknown>) {
    return { success: true, message, data: await dataPromise };
  }
}
