import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { DataSource, EntityManager, In, IsNull, Not } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { addMoney, compareMoney, normalizeMoney } from '../../common/utils/decimal.util';
import { BankSmsTransaction } from '../finance-bank-sms/entities/bank-sms-transaction.entity';
import { FinanceCollectionOrder } from '../finance-reconciliation/entities/finance-collection-order.entity';
import { FinanceCollectionConfirmationAuthority } from '../finance-reconciliation/entities/finance-collection-confirmation-authority.entity';
import { FinanceReconciliationLink } from '../finance-reconciliation/entities/finance-reconciliation-link.entity';
import {
  collectAuthorityEnvelopeProblems,
  isCollectionOrderStrictlyConfirmed,
} from '../finance-reconciliation/collection-order-confirmation.contract';
import { centsToDecimal } from '../../common/utils/decimal.util';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { CustomerMasterRecord } from '../business-foundation/entities/business-foundation.entities';
import { CustomerIdentificationBinding } from '../performance/entities/customer-identification-binding.entity';
import { Employee } from '../performance/entities/employee.entity';
import { User } from '../users/entities/user.entity';
import { WorkOrderMaterial } from '../work-order-materials/entities/work-order-material.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { assertWorkOrderNotUnquoted, isWorkOrderUnquoted } from '../work-orders/work-order-intake.policy';
import { AdmitRepairPrequoteDto, QueryRepairPrequoteReadinessDto } from './dto/repair-prequote.dto';
import { RepairPrequoteService } from './repair-prequote.service';
import { Material } from '../materials/entities/material.entity';
import { MaterialStatus } from '../../shared/enums/material-status.enum';
import { proposalAmounts } from '../work-orders/work-order-intake-proposal.policy';
import { assertProposalDocumentReview, buildProposalDocument, loadProposalDocumentSource,
  normalizeProposalDocumentInput, PROPOSAL_DOCUMENT_SOURCE, proposalDocumentEnvelope,
  proposalDocumentRequestHash } from './repair-proposal-document-source';
import { RepairFirstVisitService } from './repair-first-visit.service';
import { QueryRepairFirstVisitDto, ReviewRepairFirstVisitDto } from './dto/repair-first-visit.dto';
import { assertQuotedRepairRoot, prequoteAdmission } from './repair-prequote.policy';
import { assertIntakeExecutionStage, bindIntakeConfirmation, clearIntakeConfirmation, intakeDecisionPackage, intakeExecutionBinding } from './repair-intake-execution.policy';
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
import {
  RepairAiDraft,
  RepairConfirmationRequest,
  RepairDeliveryRecord,
  RepairDocumentType,
  RepairDocumentVersion,
  isFormalRepairDocumentType,
  RepairKnowledgeReference,
  RepairLaborItem,
  RepairPartLink,
  RepairQualityInspection,
  RepairTask,
  RepairVehicleCustomerLink,
  RepairVehiclePlateHistory,
  RepairVehicleProfile,
  RepairWarrantyRecord,
  RepairWorkOrderProfile,
} from './entities/repair-shop.entities';
import { RepairShopAiDraftService } from './repair-shop-ai-draft.service';
import { RepairResourceScope, RepairShopScopeService } from './repair-shop-scope.service';
import {
  assertCanCreateTask,
  assertCanDeliver,
  assertCanInspectQuality,
  assertCanRequestConfirmation,
  assertExpectedVersion,
  assertManualTransition,
  assertTaskStatusTransition,
  documentPermission,
  knowledgeAuthorityRank,
  maskCustomerRef,
  maskVin,
  statusAfterCustomerDecision,
  statusAfterDocument,
  statusAfterTaskActivity,
} from './repair-shop-workflow.policy';

type AssistantEffectClass = 'read_only' | 'draft_only' | 'confirmation_request_only' | 'no_effect';

interface AssistantCallContext {
  requestId: string;
  correlationId: string;
  capability: string;
  requestedEffectClass: Exclude<AssistantEffectClass, 'no_effect'>;
}

interface AuditedArtifact<T> {
  artifact: T;
  auditId: number;
  created: boolean;
}

@Injectable()
export class RepairShopService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly operationLogsService: OperationLogsService,
    private readonly scopeService: RepairShopScopeService,
    private readonly aiDraftService: RepairShopAiDraftService,
  ) {}

  async listVehicles(query: QueryRepairVehiclesDto, currentUser: CurrentUser) {
    const scope = this.scopeFrom(query);
    await this.scopeService.assertAccess(currentUser, scope, 'repair.read');
    const links = await this.dataSource.getRepository(RepairVehicleCustomerLink).find({
      where: {
        companyRef: scope.companyRef,
        businessSectorRef: scope.businessSectorRef,
        customerRef: scope.customerRef,
        confirmationStatus: 'confirmed',
        status: 'active',
      },
      order: { updatedAt: 'DESC' },
    });
    if (!links.length) return [];
    const vehicles = await this.dataSource.getRepository(RepairVehicleProfile).find({
      where: {
        id: In(links.map((link) => link.vehicleId)),
        companyRef: scope.companyRef,
        businessSectorRef: scope.businessSectorRef,
        status: 'active',
      },
      order: { updatedAt: 'DESC' },
    });
    return vehicles.map((vehicle) => ({
      id: vehicle.id,
      plateNumber: vehicle.plateNumber,
      vinMasked: maskVin(vehicle.vin),
      brand: vehicle.brand,
      model: vehicle.model,
      modelYear: vehicle.modelYear,
      engineCode: vehicle.engineCode,
      salesMarket: vehicle.salesMarket,
      odometerKm: vehicle.odometerKm,
      version: vehicle.version,
      customerRelationships: links
        .filter((link) => link.vehicleId === vehicle.id)
        .map((link) => ({
          ref: `repair-vehicle-customer-link:${link.id}`,
          relationshipType: link.relationshipType,
          confirmationStatus: link.confirmationStatus,
        })),
    }));
  }

  async createVehicle(dto: CreateRepairVehicleDto, currentUser: CurrentUser) {
    return this.dataSource.transaction(async (manager) => {
      const scope = this.scopeFrom(dto);
      const access = await this.scopeService.assertAccess(
        currentUser,
        scope,
        'vehicle.manage',
        manager,
      );
      const repo = manager.getRepository(RepairVehicleProfile);
      const plateNumber = this.normalizePlate(dto.plateNumber);
      const vin = this.normalizeVin(dto.vin);
      this.assertOpaqueEvidenceRef(dto.customerRelationshipEvidenceRef, '客户车辆关系证据');
      this.assertOpaqueEvidenceRef(dto.plateEvidenceRef, '车辆号牌证据');
      if (vin) {
        const duplicateVin = await repo.findOne({ where: { companyRef: scope.companyRef, vin } });
        if (duplicateVin) throw new ConflictException('该公司下 VIN 已存在车辆档案');
      }
      const resolved = access.resolved;
      const vehicle = await repo.save(
        repo.create({
          companyRef: scope.companyRef,
          businessSectorRef: scope.businessSectorRef,
          initialServiceStoreRef: scope.storeRef,
          companyDisplaySnapshot: resolved.companyDisplaySnapshot,
          businessSectorDisplaySnapshot: resolved.businessSectorDisplaySnapshot,
          initialServiceStoreDisplaySnapshot: resolved.storeDisplaySnapshot,
          scopeSnapshotVersion: resolved.scopeSnapshotVersion,
          plateNumber,
          vin,
          brand: dto.brand?.trim() || null,
          model: dto.model?.trim() || null,
          modelYear: dto.modelYear ?? null,
          engineCode: dto.engineCode?.trim() || null,
          salesMarket: dto.salesMarket?.trim().toUpperCase() || null,
          odometerKm: dto.odometerKm ?? null,
          status: 'active',
          version: 1,
          createdBy: currentUser.id,
          updatedBy: null,
        }),
      );
      const now = new Date();
      const link = await manager.getRepository(RepairVehicleCustomerLink).save(
        manager.getRepository(RepairVehicleCustomerLink).create({
          vehicleId: vehicle.id,
          ...scope,
          relationshipType: dto.customerRelationshipType,
          confirmationStatus: 'confirmed',
          status: 'active',
          validFrom: now,
          validUntil: null,
          relationshipSource: dto.customerRelationshipEvidenceRef.trim(),
          reviewedBy: currentUser.id,
          closedBy: null,
          closureEvidenceRef: null,
          createdBy: currentUser.id,
        }),
      );
      await manager.getRepository(RepairVehiclePlateHistory).save(
        manager.getRepository(RepairVehiclePlateHistory).create({
          vehicleId: vehicle.id,
          companyRef: vehicle.companyRef,
          plateNumber,
          validFrom: now,
          validUntil: null,
          sourceEvidenceRef: dto.plateEvidenceRef.trim(),
          reviewedBy: currentUser.id,
          createdBy: currentUser.id,
        }),
      );
      await this.audit('repair_vehicle', vehicle.id, 'create', currentUser, {
        companyRef: vehicle.companyRef,
        initialServiceStoreRef: vehicle.initialServiceStoreRef,
        customerRefMasked: maskCustomerRef(link.customerRef),
        customerRelationshipType: link.relationshipType,
        plateMasked: this.maskPlate(vehicle.plateNumber),
      }, manager);
      return vehicle;
    });
  }

  async updateVehicle(id: number, dto: UpdateRepairVehicleDto, currentUser: CurrentUser) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(RepairVehicleProfile);
      const vehicle = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!vehicle) {
        throw new NotFoundException('车辆档案不存在');
      }
      await this.assertVehicleManageAccess(vehicle, currentUser, manager);
      assertExpectedVersion(vehicle.version, dto.expectedVersion, '车辆档案');
      const nextPlate = dto.plateNumber ? this.normalizePlate(dto.plateNumber) : vehicle.plateNumber;
      if (nextPlate !== vehicle.plateNumber) {
        if (!dto.plateChangeEvidenceRef?.trim()) {
          throw new BadRequestException('换牌必须提供审核后的号牌变更证据引用');
        }
        this.assertOpaqueEvidenceRef(dto.plateChangeEvidenceRef, '号牌变更证据');
      }
      const nextVin = dto.vin !== undefined ? this.normalizeVin(dto.vin) : vehicle.vin;
      if (nextVin && nextVin !== vehicle.vin) {
        throw new BadRequestException('VIN 变更必须通过车辆身份候选与人工确认流程完成');
      }
      const previousPlate = vehicle.plateNumber;
      vehicle.plateNumber = nextPlate;
      vehicle.vin = nextVin;
      if (dto.brand !== undefined) vehicle.brand = dto.brand.trim() || null;
      if (dto.model !== undefined) vehicle.model = dto.model.trim() || null;
      if (dto.modelYear !== undefined) vehicle.modelYear = dto.modelYear;
      if (dto.engineCode !== undefined) vehicle.engineCode = dto.engineCode.trim() || null;
      if (dto.salesMarket !== undefined) {
        vehicle.salesMarket = dto.salesMarket.trim().toUpperCase() || null;
      }
      if (dto.odometerKm !== undefined) vehicle.odometerKm = dto.odometerKm;
      vehicle.version += 1;
      vehicle.updatedBy = currentUser.id;
      const saved = await repo.save(vehicle);
      if (nextPlate !== previousPlate) {
        const changedAt = new Date();
        await manager.getRepository(RepairVehiclePlateHistory).update(
          { vehicleId: vehicle.id, validUntil: IsNull() },
          { validUntil: changedAt },
        );
        await manager.getRepository(RepairVehiclePlateHistory).save(
          manager.getRepository(RepairVehiclePlateHistory).create({
            vehicleId: vehicle.id,
            companyRef: vehicle.companyRef,
            plateNumber: nextPlate,
            validFrom: changedAt,
            validUntil: null,
            sourceEvidenceRef: dto.plateChangeEvidenceRef!.trim(),
            reviewedBy: currentUser.id,
            createdBy: currentUser.id,
          }),
        );
      }
      const staleAiDraftCount = await this.markVehicleAiDraftsStale(saved.id, manager);
      await this.audit('repair_vehicle', saved.id, 'update', currentUser, {
        version: saved.version,
        plateChanged: nextPlate !== previousPlate,
        staleAiDraftCount,
      }, manager);
      return saved;
    });
  }

  async createVehicleCustomerLink(
    vehicleId: number,
    dto: CreateRepairVehicleCustomerLinkDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const vehicleRepo = manager.getRepository(RepairVehicleProfile);
      const vehicle = await vehicleRepo.findOne({
        where: { id: vehicleId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!vehicle) throw new NotFoundException('车辆档案不存在');
      const scope = this.scopeFrom(dto);
      await this.scopeService.assertAccess(currentUser, scope, 'vehicle.manage', manager);
      this.assertVehicleOrganizationScope(vehicle, scope);
      this.assertOpaqueEvidenceRef(dto.evidenceRef, '客户车辆关系证据');
      assertExpectedVersion(vehicle.version, dto.expectedVehicleVersion, '车辆档案');
      const repo = manager.getRepository(RepairVehicleCustomerLink);
      const existing = await repo.findOne({
        where: {
          vehicleId,
          customerRef: scope.customerRef,
          relationshipType: dto.relationshipType,
          confirmationStatus: 'confirmed',
          status: 'active',
        },
      });
      if (existing) throw new ConflictException('该车辆客户关系已处于有效状态');
      const link = await repo.save(
        repo.create({
          vehicleId,
          ...scope,
          relationshipType: dto.relationshipType,
          confirmationStatus: 'confirmed',
          status: 'active',
          validFrom: new Date(),
          validUntil: null,
          relationshipSource: dto.evidenceRef.trim(),
          reviewedBy: currentUser.id,
          closedBy: null,
          closureEvidenceRef: null,
          createdBy: currentUser.id,
        }),
      );
      vehicle.version += 1;
      vehicle.updatedBy = currentUser.id;
      await vehicleRepo.save(vehicle);
      await this.audit('repair_vehicle_customer_link', link.id, 'create_confirmed', currentUser, {
        vehicleId,
        customerRefMasked: maskCustomerRef(link.customerRef),
        relationshipType: link.relationshipType,
        vehicleVersion: vehicle.version,
      }, manager);
      return { link, vehicle };
    });
  }

  async closeVehicleCustomerLink(
    vehicleId: number,
    linkId: number,
    dto: CloseRepairVehicleCustomerLinkDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const vehicleRepo = manager.getRepository(RepairVehicleProfile);
      const vehicle = await vehicleRepo.findOne({
        where: { id: vehicleId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!vehicle) throw new NotFoundException('车辆档案不存在');
      const linkRepo = manager.getRepository(RepairVehicleCustomerLink);
      const link = await linkRepo.findOne({
        where: { id: linkId, vehicleId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!link) throw new NotFoundException('车辆客户关系不存在');
      await this.scopeService.assertAccess(currentUser, this.scopeFrom(link), 'vehicle.manage', manager);
      assertExpectedVersion(vehicle.version, dto.expectedVehicleVersion, '车辆档案');
      this.assertOpaqueEvidenceRef(dto.evidenceRef, '客户车辆关系关闭证据');
      if (link.status !== 'active' || link.validUntil) {
        throw new BadRequestException('车辆客户关系已经关闭');
      }
      link.status = 'inactive';
      link.validUntil = new Date();
      link.closedBy = currentUser.id;
      link.closureEvidenceRef = dto.evidenceRef.trim();
      await linkRepo.save(link);
      vehicle.version += 1;
      vehicle.updatedBy = currentUser.id;
      await vehicleRepo.save(vehicle);
      await this.audit('repair_vehicle_customer_link', link.id, 'close', currentUser, {
        vehicleId,
        customerRefMasked: maskCustomerRef(link.customerRef),
        relationshipType: link.relationshipType,
        vehicleVersion: vehicle.version,
      }, manager);
      return { link, vehicle };
    });
  }

  async attachWorkOrder(
    workOrderId: number,
    dto: AttachRepairWorkOrderDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const workOrder = await manager.getRepository(WorkOrder).findOne({
        where: { id: workOrderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!workOrder) {
        throw new NotFoundException('正式工单不存在');
      }
      assertWorkOrderNotUnquoted(workOrder);
      const profileRepo = manager.getRepository(RepairWorkOrderProfile);
      const existing = await profileRepo.findOne({ where: { workOrderId } });
      if (existing) {
        await this.scopeService.assertAccess(
          currentUser,
          this.scopeFrom(existing),
          'repair.read',
          manager,
        );
        await this.audit('repair_work_order', workOrderId, 'attach_profile_idempotent', currentUser, {
          profileId: existing.id,
        }, manager);
        return existing;
      }
      if (
        workOrder.createdBy !== currentUser.id &&
        workOrder.responsibleUserId !== currentUser.id
      ) {
        throw new ForbiddenException(
          '[scope_resolution_pending] 只有正式工单创建人或责任人可以发起首次汽修作用域适配',
        );
      }
      const vehicle = await manager.getRepository(RepairVehicleProfile).findOne({
        where: { id: dto.vehicleId },
      });
      if (!vehicle) {
        throw new NotFoundException('车辆档案不存在');
      }
      const scope = this.scopeFrom(dto);
      const access = await this.scopeService.assertAccess(
        currentUser,
        scope,
        'intake.manage',
        manager,
      );
      await this.scopeService.assertAccess(
        currentUser,
        scope,
        'scope.resolve',
        manager,
      );
      this.assertVehicleOrganizationScope(vehicle, scope);
      const vehicleCustomerLink = await this.loadConfirmedVehicleCustomerLink(
        vehicle.id,
        scope,
        manager,
      );
      const legacyCustomerBindingId = await this.assertLegacyWorkOrderScopeMapping(
        workOrder,
        vehicleCustomerLink,
        scope,
        dto.scopeResolutionEvidenceRef,
        manager,
      );
      const scopeResolvedAt = new Date();
      const profile = await profileRepo.save(
        profileRepo.create({
          workOrderId,
          ...scope,
          companyDisplaySnapshot: access.resolved.companyDisplaySnapshot,
          businessSectorDisplaySnapshot: access.resolved.businessSectorDisplaySnapshot,
          storeDisplaySnapshot: access.resolved.storeDisplaySnapshot,
          customerDisplaySnapshot: access.resolved.customerDisplaySnapshot,
          scopeSnapshotVersion: access.resolved.scopeSnapshotVersion,
          scopeResolutionEvidenceRef: dto.scopeResolutionEvidenceRef.trim(),
          legacyCustomerBindingId,
          scopeResolvedAt,
          vehicleId: vehicle.id,
          lifecycleStatus: 'intake_draft',
          suspendedFromStatus: null,
          suspendedAt: null,
          suspendedBy: null,
          suspensionReason: null,
          resumedAt: null,
          resumedBy: null,
          resumeReason: null,
          activePlanVersion: null,
          activeQuoteVersion: null,
          activeExplanationVersion: null,
          customerConfirmationState: 'not_requested',
          version: 1,
          knowledgeCatalogVersion: 1,
          createdBy: currentUser.id,
          updatedBy: null,
        }),
      );
      await this.audit('repair_work_order', workOrderId, 'attach_profile', currentUser, {
        companyRef: profile.companyRef,
        storeRef: profile.storeRef,
        customerRefMasked: maskCustomerRef(profile.customerRef),
        vehicleId: profile.vehicleId,
        scopeResolutionEvidenceRef: profile.scopeResolutionEvidenceRef,
        legacyCustomerBindingId: profile.legacyCustomerBindingId,
        vehicleCustomerLinkId: vehicleCustomerLink.id,
        scopeResolvedAt: profile.scopeResolvedAt,
      }, manager);
      return profile;
    });
  }

  async getWorkspace(workOrderId: number, currentUser: CurrentUser) {
    const root = await this.dataSource.getRepository(WorkOrder).findOne({ where: { id: workOrderId } });
    const existingProfile = await this.dataSource.getRepository(RepairWorkOrderProfile).findOne({ where: { workOrderId } });
    if (root && (isWorkOrderUnquoted(root) || (existingProfile && prequoteAdmission(existingProfile)))) {
      return this.prequote.run(async (manager) => {
        const hint = await manager.getRepository(RepairWorkOrderProfile).findOne({ where: { workOrderId } });
        if (!hint) {
          // Intake read owns privacy/current actor/store access; no vehicle/customer enumeration here.
          const workOrder = await this.prequote.assertUnconfiguredRead(workOrderId, currentUser, manager);
          return { workOrder,
            profile: null, prequoteOnly: true, financialEffect: false, wagesAvailable: false };
        }
        const { profile, data } = await this.prequote.boundProfile(workOrderId, currentUser, manager, 'repair.read');
        await assertIntakeExecutionStage(profile, manager, 'read');
        return { ...await this.loadWorkspace(profile, manager, true, true), actorContext: { employeeId: data.employeeId },
          intakeSnapshot: { revision: data.revision, odometerKm: data.odometerKm, verificationStatus: 'pending' } };
      });
    }
    const profileRepo = this.dataSource.getRepository(RepairWorkOrderProfile);
    const profile = await profileRepo.findOne({ where: { workOrderId } });
    if (!profile) {
      const workOrder = await this.dataSource.getRepository(WorkOrder).findOne({
        where: { id: workOrderId },
      });
      if (!workOrder) throw new NotFoundException('正式工单不存在');
      if (
        workOrder.createdBy !== currentUser.id &&
        workOrder.responsibleUserId !== currentUser.id
      ) {
        throw new ForbiddenException(
          '[scope_resolution_pending] 未建立组织作用域的历史工单只允许创建人或责任人发起适配',
        );
      }
      return {
        workOrder: {
          id: workOrder.id,
          workOrderNo: workOrder.workOrderNo,
          title: workOrder.title,
          status: workOrder.status,
        },
        profile: null,
      };
    }
    const access = await this.scopeService.assertAccess(
      currentUser,
      this.scopeFrom(profile),
      'repair.read',
    );
    const workspace = await this.loadWorkspace(profile);
    return {
      ...workspace,
      actorContext: { employeeId: access.linkedEmployeeId },
    };
  }

  async getOwnerProposalDocumentSource(workOrderId: number, currentUser: CurrentUser) {
    return this.prequote.run(async manager => {
      const profile = await this.loadDocumentProfile(workOrderId, currentUser, 'quote.manage', manager);
      await this.scopeService.assertAccess(currentUser, this.scopeFrom(profile), 'diagnosis.manage', manager, { lockAuthorityRows: true });
      const source = await loadProposalDocumentSource(manager, profile);
      const documents = await manager.getRepository(RepairDocumentVersion).find({ where: { workOrderId },
        order: { version: 'DESC' }, lock: { mode: 'pessimistic_read' } });
      const materials = await manager.getRepository(Material).find({ where: { status: MaterialStatus.ACTIVE },
        order: { id: 'ASC' }, take: 201, select: { id: true, materialNo: true, name: true, specification: true, unit: true } });
      const imported = documents.filter(d => proposalDocumentEnvelope(d)?.input.proposalHash === source.snapshot.requestHash)
        .map(d => ({ id: d.id, documentType: d.documentType, version: d.version, status: d.status }));
      const plan = documents.find(d => d.documentType === 'repair_plan' && d.version === profile.activePlanVersion && d.status === 'approved');
      const audit = await this.operationLogsService.create({ module: 'repair_document', targetId: workOrderId,
        action: 'owner_proposal_source_read', operatorId: currentUser.id, detail: '回读原单待核实方案材料；不确认成本或付款',
        detailJson: { contract: PROPOSAL_DOCUMENT_SOURCE, proposalVersion: source.document.version,
          financialEffect: false, personalDataIncluded: false } }, manager);
      if (!Number.isSafeInteger(audit?.id) || audit.id < 1) throw new ServiceUnavailableException('[proposal_document_audit] 暂不能确认审计结果');
      return { contract: PROPOSAL_DOCUMENT_SOURCE, workOrderId, profileVersion: profile.version,
        proposalVersion: source.document.version, proposalHash: source.snapshot.requestHash,
        plan: source.snapshot.input.plan, rows: source.snapshot.input.rows, quoteTotal: proposalAmounts(source.snapshot.input).quoteTotal,
        diagnosisVersion: documents.find(d => d.documentType === 'diagnosis' && ['approved', 'authorized'].includes(d.status))?.version ?? null,
        approvedPlanVersion: plan && proposalDocumentEnvelope(plan)?.input.proposalHash === source.snapshot.requestHash ? plan.version : null,
        approvedMaterialBindings: plan ? proposalDocumentEnvelope(plan)?.input.materialBindings ?? null : null,
        materials: materials.slice(0, 200).map(m => ({ id: m.id, materialNo: m.materialNo, name: m.name, specification: m.specification, unit: m.unit })),
        materialCatalogTruncated: materials.length > 200, imported,
        verificationStatus: 'pending', financialEffect: false, wagesAvailable: false,
        actualCost: null, supplierAuthority: 'unverified', paymentStatus: 'unknown' };
    });
  }

  async createDocumentVersion(
    workOrderId: number,
    dto: CreateRepairDocumentVersionDto,
    currentUser: CurrentUser,
  ) {
    return this.prequote.run(async (manager) => {
      const profile = await this.loadDocumentProfile(workOrderId, currentUser, documentPermission(dto.documentType), manager);
      if (prequoteAdmission(profile) && dto.generatedBy === 'ai') {
        throw new ForbiddenException('[repair_prequote_human_required] 本批次只允许有权人员录入并独立审核');
      }
      await this.scopeService.assertAccess(
        currentUser,
        this.scopeFrom(profile),
        documentPermission(dto.documentType),
        manager,
      );
      let proposalImport: Awaited<ReturnType<typeof buildProposalDocument>> | undefined;
      if (dto.ownerProposalSource !== undefined) {
        if (dto.generatedBy === 'ai' || Object.keys(dto.payload ?? {}).length || (dto.sourceReferences?.length ?? 0)) {
          throw new BadRequestException('[proposal_document_server_payload] 原单接入内容必须由服务器从已存草稿生成');
        }
        await this.scopeService.assertAccess(currentUser, this.scopeFrom(profile), 'quote.manage', manager, { lockAuthorityRows: true });
        await this.scopeService.assertAccess(currentUser, this.scopeFrom(profile), 'diagnosis.manage', manager, { lockAuthorityRows: true });
        const input = normalizeProposalDocumentInput(dto.ownerProposalSource);
        const source = await loadProposalDocumentSource(manager, profile);
        if (input.proposalHash !== source.snapshot.requestHash || input.proposalVersion !== source.document.version) {
          throw new ConflictException('[proposal_document_stale] 草稿来源已变化，请回读原单');
        }
        const prior = await manager.getRepository(RepairDocumentVersion).find({ where: { workOrderId }, lock: { mode: 'pessimistic_read' } });
        for (const d of prior) {
          const e = proposalDocumentEnvelope(d);
          if (!e) continue;
          if (e.input.requestId === input.requestId) {
            if (e.requestHash !== proposalDocumentRequestHash(workOrderId, dto.documentType, currentUser.id, dto.expectedProfileVersion, input)) {
              throw new ConflictException('[proposal_document_replay_conflict] 同一请求不能改变内容、人员或版本');
            }
            // Revalidate current source/catalog/dependencies even for an uncertain-commit retry.
            await assertProposalDocumentReview(manager, profile, d);
            return { document: d, profile: this.documentProfileView(profile), replayed: true };
          }
        }
        if (prior.some(d => d.documentType === dto.documentType && proposalDocumentEnvelope(d)?.input.proposalHash === input.proposalHash)) {
          throw new ConflictException('[proposal_document_already_imported] 本草稿已接入该类型，请回读原版本，不要重复生成');
        }
        proposalImport = await buildProposalDocument(manager, profile, source, dto.documentType, input, currentUser.id, dto.expectedProfileVersion);
      } else if (dto.sourceReferences?.some(r => String(r?.contract ?? '').startsWith('repair_owner_proposal'))) {
        throw new BadRequestException('[proposal_document_reserved_source] 不得手填系统草稿来源凭证');
      }
      assertExpectedVersion(profile.version, dto.expectedProfileVersion, '汽修工单');
      this.assertDocumentVersioningOpen(profile.lifecycleStatus);
      const payload = proposalImport?.payload ?? dto.payload;
      await this.validateDocumentPayload(dto.documentType, payload, profile, manager);

      const repo = manager.getRepository(RepairDocumentVersion);
      const latest = await repo.findOne({
        where: { workOrderId, documentType: dto.documentType },
        order: { version: 'DESC' },
      });
      if (latest && ['draft', 'review_pending'].includes(latest.status)) {
        latest.status = 'superseded';
        await repo.save(latest);
      }
      const cancelledConfirmations = await manager.getRepository(RepairConfirmationRequest).update(
        { workOrderId, status: 'pending' },
        { status: 'cancelled' },
      );
      const nextVersion = (latest?.version ?? 0) + 1;
      const document = await repo.save(
        repo.create({
          workOrderId,
          documentType: dto.documentType,
          version: nextVersion,
          status: dto.generatedBy === 'ai' ? 'draft' : 'review_pending',
          summary: proposalImport?.summary ?? dto.summary.trim(),
          payload,
          sourceReferences: proposalImport ? [proposalImport.envelope] : dto.sourceReferences ?? null,
          generatedBy: dto.generatedBy ?? 'human',
          createdBy: currentUser.id,
          reviewedBy: null,
          reviewedAt: null,
          reviewNote: null,
        }),
      );

      this.invalidateActiveDecisionPackageForDraft(profile, dto.documentType);
      if (prequoteAdmission(profile)) clearIntakeConfirmation(profile);
      profile.customerConfirmationState = 'not_requested';
      const staleAiDraftCount = prequoteAdmission(profile) ? 0 : await this.markOpenAiDraftsStale(workOrderId, manager);
      profile.version += 1;
      profile.updatedBy = currentUser.id;
      await manager.getRepository(RepairWorkOrderProfile).save(profile);
      const audit = await this.audit('repair_document', document.id, `create_${dto.documentType}`, currentUser, {
        workOrderId,
        documentType: dto.documentType,
        documentVersion: nextVersion,
        profileVersion: profile.version,
        cancelledPendingConfirmationCount: cancelledConfirmations.affected ?? 0,
        staleAiDraftCount,
      }, manager);
      if (proposalImport && (!Number.isSafeInteger(audit?.id) || audit.id < 1)) {
        throw new ServiceUnavailableException('[proposal_document_audit] 暂不能确认审计结果，请回读原单');
      }
      return { document, profile: this.documentProfileView(profile) };
    });
  }

  async reviewDocumentVersion(
    workOrderId: number,
    documentId: number,
    dto: ReviewRepairDocumentVersionDto,
    currentUser: CurrentUser,
  ) {
    return this.prequote.run(async (manager) => {
      const hint = await manager.getRepository(RepairDocumentVersion).findOne({ where: { id: documentId, workOrderId } });
      if (!hint || !isFormalRepairDocumentType(hint.documentType)) throw new NotFoundException('汽修业务版本不存在');
      const profile = await this.loadDocumentProfile(workOrderId, currentUser, documentPermission(hint.documentType), manager);
      const repo = manager.getRepository(RepairDocumentVersion);
      const document = await repo.findOne({
        where: { id: documentId, workOrderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!document || !isFormalRepairDocumentType(document.documentType)) throw new NotFoundException('汽修业务版本不存在');
      if (document.documentType !== hint.documentType) throw new ConflictException('[repair_prequote_document_changed] 文档类型已变化');
      if (prequoteAdmission(profile) && document.createdBy === currentUser.id) {
        throw new ForbiddenException('[repair_prequote_independent_review] 录入与审核必须由不同的有权人员完成');
      }
      await assertProposalDocumentReview(manager, profile, document, currentUser.id);
      await this.scopeService.assertAccess(
        currentUser,
        this.scopeFrom(profile),
        documentPermission(document.documentType),
        manager,
      );
      assertExpectedVersion(profile.version, dto.expectedProfileVersion, '汽修工单');
      this.assertDocumentVersioningOpen(profile.lifecycleStatus);
      if (!['draft', 'review_pending'].includes(document.status)) {
        throw new BadRequestException(`当前版本状态 ${document.status} 不可审核`);
      }
      const latest = await repo.findOne({
        where: { workOrderId, documentType: document.documentType },
        order: { version: 'DESC' },
      });
      if (!latest || latest.id !== document.id) {
        throw new BadRequestException('只能审核该类型的最新版本');
      }
      await this.validateDocumentPayload(
        document.documentType,
        document.payload,
        profile,
        manager,
      );
      document.status = dto.decision;
      document.reviewedBy = currentUser.id;
      document.reviewedAt = new Date();
      document.reviewNote = dto.reviewNote.trim();
      await repo.save(document);

      if (dto.decision === 'approved') {
        await this.supersedePriorDocumentVersions(
          workOrderId,
          document.documentType,
          document.id,
          manager,
        );
        await this.supersedeDownstreamDocuments(
          workOrderId,
          document.documentType,
          manager,
        );
        profile.lifecycleStatus = statusAfterDocument(
          profile.lifecycleStatus,
          document.documentType,
        );
        if (document.documentType === 'intake_inspection') {
          profile.activePlanVersion = null;
          profile.activeQuoteVersion = null;
          profile.activeExplanationVersion = null;
        }
        if (document.documentType === 'diagnosis') {
          profile.activePlanVersion = null;
          profile.activeQuoteVersion = null;
          profile.activeExplanationVersion = null;
        }
        if (document.documentType === 'repair_plan') {
          profile.activePlanVersion = document.version;
          profile.activeQuoteVersion = null;
          profile.activeExplanationVersion = null;
        }
        if (document.documentType === 'quote') {
          profile.activeQuoteVersion = document.version;
          profile.activeExplanationVersion = null;
        }
        if (document.documentType === 'customer_explanation') {
          profile.activeExplanationVersion = document.version;
        }
      }
      profile.customerConfirmationState = 'not_requested';
      const staleAiDraftCount = prequoteAdmission(profile) ? 0 : await this.markOpenAiDraftsStale(workOrderId, manager);
      profile.version += 1;
      profile.updatedBy = currentUser.id;
      await manager.getRepository(RepairWorkOrderProfile).save(profile);
      await this.audit('repair_document', document.id, `review_${dto.decision}`, currentUser, {
        workOrderId,
        documentType: document.documentType,
        documentVersion: document.version,
        profileStatus: profile.lifecycleStatus,
        profileVersion: profile.version,
        staleAiDraftCount,
      }, manager);
      return { document, profile: this.documentProfileView(profile) };
    });
  }

  async createConfirmationRequest(
    workOrderId: number,
    dto: CreateRepairConfirmationRequestDto,
    currentUser: CurrentUser,
  ) {
    return (await this.createConfirmationRequestOperation(workOrderId, dto, currentUser)).artifact;
  }

  private async createConfirmationRequestOperation(
    workOrderId: number,
    dto: CreateRepairConfirmationRequestDto,
    currentUser: CurrentUser,
    assistantContext?: AssistantCallContext,
  ): Promise<AuditedArtifact<RepairConfirmationRequest>> {
    const requestFingerprint = this.fingerprint({
      workOrderId,
      planVersion: dto.planVersion,
      quoteVersion: dto.quoteVersion,
      explanationVersion: dto.explanationVersion,
      channel: dto.channel,
      recipientMasked: dto.recipientMasked.trim(),
      message: dto.message?.trim() || null,
    });
    try {
      return await this.prequote.run(async (manager) => {
        const profile = assistantContext ? await this.loadProfile(workOrderId, manager)
          : await this.loadIntakeOperationalProfile(workOrderId, currentUser, 'confirmation.request', 'confirmation', manager);
        await this.scopeService.assertAccess(
          currentUser,
          this.scopeFrom(profile),
          'confirmation.request',
          manager,
        );
        const requestRepo = manager.getRepository(RepairConfirmationRequest);
        const idempotent = await requestRepo.findOne({
          where: { requestIdempotencyKey: dto.requestIdempotencyKey },
          lock: { mode: 'pessimistic_read' },
        });
        if (idempotent) {
          return this.replayConfirmationRequest(
            idempotent,
            workOrderId,
            requestFingerprint,
            currentUser,
            manager,
            assistantContext,
          );
        }
        const lockedProfile = prequoteAdmission(profile) ? profile : await this.loadProfileForUpdate(workOrderId, manager);
        assertExpectedVersion(lockedProfile.version, dto.expectedProfileVersion, '汽修工单');
        assertCanRequestConfirmation(lockedProfile.lifecycleStatus);
        await this.assertExactConfirmationVersions(workOrderId, dto, lockedProfile, manager);
        let packageHash: string | null = null;
        if (prequoteAdmission(lockedProfile)) {
          if (await requestRepo.findOne({ where: { workOrderId, status: 'pending' }, lock: { mode: 'pessimistic_read' } })) {
            throw new ConflictException('[intake_confirmation_pending] 已有待确认请求，请读取原请求，不要重复创建');
          }
          const decisionPackage = await intakeDecisionPackage(lockedProfile, manager);
          for (const document of decisionPackage.documents) {
            if (!isFormalRepairDocumentType(document.documentType)) throw new BadRequestException('[repair_document_not_formal] 个人待核实草稿不能请求客户确认');
            await assertProposalDocumentReview(manager, lockedProfile, document);
            await this.validateDocumentPayload(document.documentType, document.payload, lockedProfile, manager);
          }
          packageHash = decisionPackage.packageHash;
        }
        this.assertMaskedRecipient(dto.channel, dto.recipientMasked);
        if (dto.message) this.assertNoRawSensitiveText(dto.message, '客户确认消息');

        const request = await requestRepo.save(
          requestRepo.create({
            workOrderId,
            planVersion: dto.planVersion,
            quoteVersion: dto.quoteVersion,
            explanationVersion: dto.explanationVersion,
            requestIdempotencyKey: dto.requestIdempotencyKey,
            requestFingerprint,
            channel: dto.channel,
            recipientMasked: dto.recipientMasked.trim(),
            status: 'pending',
            message: dto.message?.trim() || null,
            decisionEvidenceRef: null,
            decisionNote: null,
            requestedBy: currentUser.id,
            requestedAt: new Date(),
            decidedBy: null,
            decidedAt: null,
            version: 1,
          }),
        );
        if (packageHash) {
          bindIntakeConfirmation(lockedProfile, request.id, packageHash);
          lockedProfile.version += 1;
          lockedProfile.updatedBy = currentUser.id;
          await manager.getRepository(RepairWorkOrderProfile).save(lockedProfile);
        }
        const audit = await this.auditAssistantAware('repair_confirmation', request.id, 'request_customer_confirmation', currentUser, {
          workOrderId,
          channel: request.channel,
          planVersion: request.planVersion,
          quoteVersion: request.quoteVersion,
          explanationVersion: request.explanationVersion,
          ...(assistantContext
            ? this.assistantAuditDetail(assistantContext, 'human_confirmation_required', true)
            : {}),
        }, manager, assistantContext);
        return { artifact: request, auditId: audit.id, created: true };
      });
    } catch (error) {
      if (!this.isDuplicateKeyError(error, 'uq_repair_confirmation_idempotency')) {
        throw error;
      }
      return this.prequote.run(async (manager) => {
        const profile = assistantContext ? await this.loadProfile(workOrderId, manager)
          : await this.loadIntakeOperationalProfile(workOrderId, currentUser, 'confirmation.request', 'confirmation', manager);
        await this.scopeService.assertAccess(
          currentUser,
          this.scopeFrom(profile),
          'confirmation.request',
          manager,
        );
        const idempotent = await manager.getRepository(RepairConfirmationRequest).findOne({
          where: { requestIdempotencyKey: dto.requestIdempotencyKey },
          lock: { mode: 'pessimistic_read' },
        });
        if (!idempotent) throw error;
        return this.replayConfirmationRequest(
          idempotent,
          workOrderId,
          requestFingerprint,
          currentUser,
          manager,
          assistantContext,
        );
      });
    }
  }

  private async replayConfirmationRequest(
    request: RepairConfirmationRequest,
    workOrderId: number,
    requestFingerprint: string,
    currentUser: CurrentUser,
    manager: EntityManager,
    assistantContext?: AssistantCallContext,
  ): Promise<AuditedArtifact<RepairConfirmationRequest>> {
    if (
      request.workOrderId !== workOrderId ||
      request.requestFingerprint !== requestFingerprint
    ) {
      throw new ConflictException('确认请求幂等键已绑定不同请求内容');
    }
    const assistantReplayBlocked = request.status !== 'pending';
    const audit = await this.auditAssistantAware('repair_confirmation', request.id, 'idempotent_replay', currentUser, {
      workOrderId,
      terminalStatus: request.status,
      ...(assistantContext
        ? this.assistantAuditDetail(
            assistantContext,
            assistantReplayBlocked ? 'blocked' : 'human_confirmation_required',
            false,
            assistantReplayBlocked ? 'no_effect' : assistantContext.requestedEffectClass,
          )
        : {}),
    }, manager, assistantContext);
    return { artifact: request, auditId: audit.id, created: false };
  }

  async recordConfirmationDecision(
    workOrderId: number,
    requestId: number,
    dto: RecordRepairConfirmationDecisionDto,
    currentUser: CurrentUser,
  ) {
    return this.prequote.run(async (manager) => {
      const profile = await this.loadIntakeOperationalProfile(workOrderId, currentUser, 'confirmation.record', 'confirmation', manager);
      const requestRepo = manager.getRepository(RepairConfirmationRequest);
      const request = await requestRepo.findOne({
        where: { id: requestId, workOrderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!request) throw new NotFoundException('客户确认请求不存在');
      await this.scopeService.assertAccess(
        currentUser,
        this.scopeFrom(profile),
        'confirmation.record',
        manager,
      );
      assertExpectedVersion(request.version, dto.expectedVersion, '客户确认请求');
      if (request.status !== 'pending') {
        throw new BadRequestException('只有待确认请求可以记录客户决定');
      }
      if (
        !['quote_pending_customer', 'diagnosed'].includes(profile.lifecycleStatus) ||
        profile.customerConfirmationState === 'confirmed'
      ) {
        throw new BadRequestException(
          `[confirmation_stale] 当前工单状态 ${profile.lifecycleStatus}/${profile.customerConfirmationState} 不再允许记录该确认请求`,
        );
      }
      if (
        profile.activePlanVersion !== request.planVersion ||
        profile.activeQuoteVersion !== request.quoteVersion ||
        profile.activeExplanationVersion !== request.explanationVersion
      ) {
        throw new BadRequestException('[confirmation_stale] 客户确认请求绑定版本已不是当前决策包');
      }
      this.assertOpaqueEvidenceRef(dto.evidenceRef, '客户确认凭证引用');
      if (prequoteAdmission(profile) && intakeExecutionBinding(profile)?.requestId !== request.id) {
        throw new ConflictException('[intake_confirmation_stale] 请求未绑定当前资料包');
      }
      if (dto.note) this.assertNoRawSensitiveText(dto.note, '客户确认备注');
      request.status = dto.decision;
      request.decisionEvidenceRef = dto.evidenceRef.trim();
      request.decisionNote = dto.note?.trim() || null;
      request.decidedBy = currentUser.id;
      request.decidedAt = new Date();
      request.version += 1;
      await requestRepo.save(request);

      profile.lifecycleStatus = statusAfterCustomerDecision(dto.decision);
      profile.customerConfirmationState = dto.decision;
      if (prequoteAdmission(profile) && dto.decision === 'rejected') clearIntakeConfirmation(profile);
      const staleAiDraftCount = prequoteAdmission(profile) ? 0 : await this.markOpenAiDraftsStale(workOrderId, manager);
      profile.version += 1;
      profile.updatedBy = currentUser.id;
      await manager.getRepository(RepairWorkOrderProfile).save(profile);
      if (dto.decision === 'confirmed') {
        await manager.getRepository(RepairDocumentVersion).update(
          { workOrderId, documentType: 'repair_plan', version: request.planVersion },
          { status: 'authorized' },
        );
        await manager.getRepository(RepairDocumentVersion).update(
          { workOrderId, documentType: 'quote', version: request.quoteVersion },
          { status: 'authorized' },
        );
        await manager.getRepository(RepairDocumentVersion).update(
          { workOrderId, documentType: 'customer_explanation', version: request.explanationVersion },
          { status: 'authorized' },
        );
      }
      await this.audit('repair_confirmation', request.id, `customer_${dto.decision}`, currentUser, {
        workOrderId,
        evidenceRefPresent: true,
        profileVersion: profile.version,
        staleAiDraftCount,
      }, manager);
      return { request, profile: this.documentProfileView(profile) };
    });
  }

  async createTask(workOrderId: number, dto: CreateRepairTaskDto, currentUser: CurrentUser) {
    return this.prequote.run(async (manager) => {
      const profile = await this.loadIntakeOperationalProfile(workOrderId, currentUser, 'repair.supervise', 'execution', manager);
      const currentRead = Boolean(prequoteAdmission(profile));
      await this.scopeService.assertAccess(
        currentUser,
        this.scopeFrom(profile),
        'repair.supervise',
        manager,
      );
      assertExpectedVersion(profile.version, dto.expectedProfileVersion, '汽修工单');
      assertCanCreateTask(profile.lifecycleStatus);
      if (profile.activePlanVersion !== dto.planVersion) {
        throw new BadRequestException('维修任务必须绑定客户已确认的当前方案版本');
      }
      const [plan, quote] = await Promise.all([
        this.loadApprovedDocument(
          workOrderId,
          'repair_plan',
          profile.activePlanVersion,
          manager,
          currentRead,
        ),
        this.loadApprovedDocument(
          workOrderId,
          'quote',
          profile.activeQuoteVersion,
          manager,
          currentRead,
        ),
      ]);
      if (!plan || !quote || plan.status !== 'authorized' || quote.status !== 'authorized') {
        throw new BadRequestException('维修任务必须绑定客户已确认的当前方案和报价');
      }
      const planItemRef = dto.planItemRef.trim();
      const authorizedExecutionRefs = this.readQuotePlanItemRefs(quote.payload, plan.payload);
      if (!authorizedExecutionRefs.includes(planItemRef)) {
        throw new BadRequestException('维修任务引用的方案项目不在当前客户确认报价范围');
      }
      const pendingRework = await this.loadPendingReworkInspection(workOrderId, manager, currentRead);
      if (pendingRework) {
        if (dto.reworkOfInspectionId !== pendingRework.id) {
          throw new BadRequestException('返工任务必须绑定当前最近一次失败质检');
        }
        if (!(pendingRework.reworkPlanItemRefs ?? []).includes(planItemRef)) {
          throw new BadRequestException('返工任务必须绑定失败质检明确列出的方案项目');
        }
      } else if (dto.reworkOfInspectionId !== undefined) {
        throw new BadRequestException('当前没有待关闭的失败质检，不得创建返工任务');
      }
      await this.assertEmployee(dto.technicianEmployeeId, manager);
      await this.scopeService.assertEmployeeAccess(
        dto.technicianEmployeeId,
        this.scopeFrom(profile),
        'repair.execute',
        manager,
      );
      const repo = manager.getRepository(RepairTask);
      const existingTasks = await repo.find({
        where: {
          workOrderId,
          planVersion: dto.planVersion,
          planItemRef,
          reworkOfInspectionId: pendingRework ? pendingRework.id : IsNull(),
        },
        ...(currentRead ? { lock: { mode: 'pessimistic_read' as const } } : {}),
      });
      if (existingTasks.some((task) => task.status !== 'cancelled')) {
        throw new ConflictException('该方案项目已经存在未取消的施工或返工任务');
      }
      const task = await repo.save(
        repo.create({
          workOrderId,
          planVersion: dto.planVersion,
          planItemRef,
          reworkOfInspectionId: pendingRework?.id ?? null,
          title: dto.title.trim(),
          system: dto.system?.trim() || null,
          technicianEmployeeId: dto.technicianEmployeeId,
          status: 'pending',
          safetyNotes: dto.safetyNotes?.trim() || null,
          completionEvidence: null,
          version: 1,
          createdBy: currentUser.id,
          updatedBy: null,
        }),
      );
      profile.lifecycleStatus = 'repair_scheduled';
      const staleAiDraftCount = prequoteAdmission(profile) ? 0 : await this.markOpenAiDraftsStale(workOrderId, manager);
      profile.version += 1;
      profile.updatedBy = currentUser.id;
      await manager.getRepository(RepairWorkOrderProfile).save(profile);
      await this.audit('repair_task', task.id, 'create', currentUser, {
        workOrderId,
        planVersion: task.planVersion,
        planItemRef: task.planItemRef,
        reworkOfInspectionId: task.reworkOfInspectionId,
        technicianEmployeeId: task.technicianEmployeeId,
        staleAiDraftCount,
      }, manager);
      return { task, profile: this.documentProfileView(profile) };
    });
  }

  async updateTaskStatus(
    workOrderId: number,
    taskId: number,
    dto: UpdateRepairTaskStatusDto,
    currentUser: CurrentUser,
  ) {
    return this.prequote.run(async (manager) => {
      const profile = await this.loadIntakeOperationalProfile(workOrderId, currentUser, 'repair.read', 'execution', manager);
      const taskRepo = manager.getRepository(RepairTask);
      const task = await taskRepo.findOne({
        where: { id: taskId, workOrderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!task) throw new NotFoundException('维修任务不存在');
      await this.scopeService.assertAssignedTechnicianOrSupervisor(
        currentUser,
        this.scopeFrom(profile),
        task.technicianEmployeeId,
        manager,
      );
      this.assertExecutionPhase(profile.lifecycleStatus);
      if (task.planVersion !== profile.activePlanVersion) {
        throw new BadRequestException('[task_plan_stale] 维修任务不再绑定当前客户授权方案');
      }
      assertExpectedVersion(task.version, dto.expectedVersion, '维修任务');
      assertTaskStatusTransition(task.status, dto.status);
      if (dto.status === 'completed' && !dto.completionEvidence) {
        throw new BadRequestException('任务完工必须附施工证据摘要');
      }
      if (prequoteAdmission(profile) && dto.status === 'completed') {
        const summary = dto.completionEvidence?.summary;
        if (typeof summary !== 'string' || !summary.trim()) {
          throw new BadRequestException('[intake_completion_evidence_required] 施工证据摘要不能为空');
        }
        this.assertNoRawSensitiveText(summary, '施工证据摘要');
      }
      task.status = dto.status;
      task.completionEvidence = dto.completionEvidence ?? task.completionEvidence;
      task.version += 1;
      task.updatedBy = currentUser.id;
      await taskRepo.save(task);

      const executionReadyForQuality = await this.isExecutionReadyForQuality(profile, manager);
      profile.lifecycleStatus = statusAfterTaskActivity(dto.status, executionReadyForQuality);
      const staleAiDraftCount = prequoteAdmission(profile) ? 0 : await this.markOpenAiDraftsStale(workOrderId, manager);
      profile.version += 1;
      profile.updatedBy = currentUser.id;
      await manager.getRepository(RepairWorkOrderProfile).save(profile);
      await this.audit('repair_task', task.id, `status_${dto.status}`, currentUser, {
        workOrderId,
        taskVersion: task.version,
        planItemRef: task.planItemRef,
        reworkOfInspectionId: task.reworkOfInspectionId,
        executionReadyForQuality,
        profileStatus: profile.lifecycleStatus,
        staleAiDraftCount,
      }, manager);
      return { task, profile: this.documentProfileView(profile) };
    });
  }

  async createLaborItem(
    workOrderId: number,
    dto: CreateRepairLaborItemDto,
    currentUser: CurrentUser,
  ) {
    return this.prequote.run(async (manager) => {
      const profile = await this.loadIntakeOperationalProfile(workOrderId, currentUser, 'repair.read', 'execution', manager);
      this.assertExecutionPhase(profile.lifecycleStatus);
      const task = await this.assertTaskBelongs(workOrderId, dto.taskId, manager, Boolean(prequoteAdmission(profile)));
      await this.scopeService.assertAssignedTechnicianOrSupervisor(
        currentUser,
        this.scopeFrom(profile),
        task.technicianEmployeeId,
        manager,
      );
      if (task.planVersion !== profile.activePlanVersion) {
        throw new BadRequestException('[task_plan_stale] 工时不能绑定过期维修方案任务');
      }
      if (task.technicianEmployeeId !== dto.technicianEmployeeId) {
        throw new BadRequestException('工时记录员工必须与当前任务的正式指派员工一致');
      }
      await this.assertEmployee(dto.technicianEmployeeId, manager);
      const quoteLine = await this.assertQuoteLineReference(
        workOrderId,
        profile,
        dto.quoteLineRef,
        'labor',
        manager,
      );
      if (prequoteAdmission(profile) && quoteLine.planItemRef !== task.planItemRef) {
        throw new BadRequestException('[intake_labor_plan_mismatch] 工时必须绑定当前任务的客户确认报价行');
      }
      const standardHours = normalizeMoney(dto.standardHours);
      const actualHours = normalizeMoney(dto.actualHours);
      const hourlyRate = normalizeMoney(dto.hourlyRate);
      if (Number(standardHours) <= 0 || Number(actualHours) < 0 || Number(hourlyRate) < 0) {
        throw new BadRequestException('标准工时必须大于零，实际工时和费率不得为负数');
      }
      const repo = manager.getRepository(RepairLaborItem);
      const duplicate = await repo.findOne({
        where: { workOrderId, taskId: dto.taskId, laborCode: dto.laborCode.trim() },
        lock: { mode: 'pessimistic_read' },
      });
      if (duplicate) throw new ConflictException('该维修任务已存在相同工时编码');
      const item = await repo.save(
        repo.create({
          workOrderId,
          taskId: dto.taskId,
          technicianEmployeeId: dto.technicianEmployeeId,
          laborCode: dto.laborCode.trim(),
          name: dto.name.trim(),
          standardHours,
          actualHours,
          hourlyRate,
          quoteLineRef: dto.quoteLineRef.trim(),
          createdBy: currentUser.id,
        }),
      );
      await this.audit('repair_labor', item.id, 'create', currentUser, {
        workOrderId,
        taskId: item.taskId,
        technicianEmployeeId: item.technicianEmployeeId,
        quoteLineRef: item.quoteLineRef,
        payrollMutation: false,
      }, manager);
      return item;
    });
  }

  async createPartLink(
    workOrderId: number,
    dto: CreateRepairPartLinkDto,
    currentUser: CurrentUser,
  ) {
    return this.prequote.run(async (manager) => {
      const profile = await this.loadIntakeOperationalProfile(workOrderId, currentUser, 'repair.read', 'execution', manager);
      this.assertExecutionPhase(profile.lifecycleStatus);
      const task = await this.assertTaskBelongs(workOrderId, dto.taskId, manager, Boolean(prequoteAdmission(profile)));
      await this.scopeService.assertAssignedTechnicianOrSupervisor(
        currentUser,
        this.scopeFrom(profile),
        task.technicianEmployeeId,
        manager,
      );
      if (task.planVersion !== profile.activePlanVersion) {
        throw new BadRequestException('[task_plan_stale] 配件不能绑定过期维修方案任务');
      }
      await this.assertQuoteLineReference(
        workOrderId,
        profile,
        dto.quoteLineRef,
        'part',
        manager,
      );
      const material = await manager.getRepository(WorkOrderMaterial).findOne({
        where: { id: dto.workOrderMaterialId, workOrderId },
        ...(prequoteAdmission(profile) ? { lock: { mode: 'pessimistic_read' as const } } : {}),
      });
      if (!material || material.deletedAt) {
        throw new NotFoundException('有效工单材料不存在；请先走既有材料/库存流程');
      }
      const repo = manager.getRepository(RepairPartLink);
      const existing = await repo.findOne({
        where: { workOrderId, workOrderMaterialId: dto.workOrderMaterialId },
        lock: { mode: 'pessimistic_read' },
      });
      if (existing) {
        if (
          existing.taskId !== dto.taskId ||
          existing.quoteLineRef !== dto.quoteLineRef.trim()
        ) {
          throw new ConflictException('该工单材料已绑定不同任务或报价行');
        }
        await this.audit('repair_part_link', existing.id, 'idempotent_replay', currentUser, {
          workOrderId,
          workOrderMaterialId: existing.workOrderMaterialId,
          inventoryMutation: false,
        }, manager);
        return existing;
      }
      const link = await repo.save(
        repo.create({
          workOrderId,
          taskId: dto.taskId,
          workOrderMaterialId: dto.workOrderMaterialId,
          quoteLineRef: dto.quoteLineRef.trim(),
          usageNote: dto.usageNote?.trim() || null,
          createdBy: currentUser.id,
        }),
      );
      await this.audit('repair_part_link', link.id, 'link_existing_work_order_material', currentUser, {
        workOrderId,
        workOrderMaterialId: link.workOrderMaterialId,
        inventoryMutation: false,
      }, manager);
      return link;
    });
  }

  async createQualityInspection(
    workOrderId: number,
    dto: CreateRepairQualityInspectionDto,
    currentUser: CurrentUser,
  ) {
    return this.prequote.run(async (manager) => {
      const profile = await this.loadIntakeOperationalProfile(workOrderId, currentUser, 'qc.inspect', 'execution', manager);
      const access = await this.scopeService.assertAccess(
        currentUser,
        this.scopeFrom(profile),
        'qc.inspect',
        manager,
      );
      assertExpectedVersion(profile.version, dto.expectedProfileVersion, '汽修工单');
      assertCanInspectQuality(profile.lifecycleStatus);
      if (!(await this.isExecutionReadyForQuality(profile, manager))) {
        throw new BadRequestException('[quality_not_ready] 当前客户确认方案或返工项目尚未全部完成');
      }
      if (prequoteAdmission(profile) && dto.result === 'passed') {
        if (!Array.isArray(dto.checklist) || !dto.checklist.length || dto.checklist.some(item =>
          !item || typeof item.item !== 'string' || !item.item.trim() || item.passed !== true)) {
          throw new BadRequestException('[intake_quality_checklist_incomplete] 质检通过必须逐项明确确认，不能包含未检查或未通过项目');
        }
        const quote = await this.loadApprovedDocument(workOrderId, 'quote', profile.activeQuoteVersion, manager, true);
        const requiredParts = (quote!.payload.lineItems as Array<Record<string, unknown>>).filter(line => line.category === 'part');
        const links = await manager.getRepository(RepairPartLink).find({ where: { workOrderId }, lock: { mode: 'pessimistic_read' } });
        for (const line of requiredParts) {
          const link = links.find(item => item.quoteLineRef === line.lineRef);
          const material = link && await manager.getRepository(WorkOrderMaterial).findOne({
            where: { id: link.workOrderMaterialId, workOrderId }, lock: { mode: 'pessimistic_read' },
          });
          if (!material || material.deletedAt) throw new BadRequestException('[intake_quality_material_missing] 报价配件缺少既有有效材料记录，不得假装已领料');
        }
      }
      if (dto.result === 'failed' && !dto.reworkReason?.trim()) {
        throw new BadRequestException('质检不通过必须填写返工原因');
      }
      const reworkPlanItemRefs = dto.result === 'failed'
        ? this.readStringArray(dto.reworkPlanItemRefs, '质检返工方案项目')
        : [];
      if (dto.result === 'passed' && dto.reworkPlanItemRefs?.length) {
        throw new BadRequestException('质检通过不得携带返工方案项目');
      }
      if (reworkPlanItemRefs.length) {
        const [plan, quote] = await Promise.all([
          this.loadApprovedDocument(
            workOrderId,
            'repair_plan',
            profile.activePlanVersion,
            manager,
          ),
          this.loadApprovedDocument(
            workOrderId,
            'quote',
            profile.activeQuoteVersion,
            manager,
          ),
        ]);
        if (!plan || !quote) throw new BadRequestException('当前客户确认维修决策包不存在');
        const authorizedExecutionRefs = new Set(
          this.readQuotePlanItemRefs(quote.payload, plan.payload),
        );
        if (reworkPlanItemRefs.some((ref) => !authorizedExecutionRefs.has(ref))) {
          throw new BadRequestException('返工项目必须来自当前客户确认报价范围');
        }
      }
      await this.assertEmployee(dto.inspectedByEmployeeId, manager);
      if (access.linkedEmployeeId !== dto.inspectedByEmployeeId) {
        throw new BadRequestException('质检记录人必须是当前正式员工身份');
      }
      const assignedTask = await manager.getRepository(RepairTask).findOne({
        where: { workOrderId, technicianEmployeeId: dto.inspectedByEmployeeId },
        ...(prequoteAdmission(profile) ? { lock: { mode: 'pessimistic_read' as const } } : {}),
      });
      if (assignedTask) {
        throw new BadRequestException('[duty_separation_required] 施工维修工不能质检同一工单');
      }
      const repo = manager.getRepository(RepairQualityInspection);
      const inspection = await repo.save(
        repo.create({
          workOrderId,
          result: dto.result,
          checklist: dto.checklist,
          roadTestResult: dto.roadTestResult?.trim() || null,
          reworkReason: dto.reworkReason?.trim() || null,
          reworkPlanItemRefs: reworkPlanItemRefs.length ? reworkPlanItemRefs : null,
          inspectedByEmployeeId: dto.inspectedByEmployeeId,
          createdBy: currentUser.id,
        }),
      );
      const invalidatedCaseReferenceIds =
        dto.result === 'failed' && !prequoteAdmission(profile)
          ? await this.invalidateReferencedCases(
              workOrderId,
              '质检返工使既有案例证据需要复核',
              currentUser,
              manager,
            )
          : [];
      profile.lifecycleStatus = dto.result === 'passed' ? 'ready_for_delivery' : 'rework_required';
      const staleAiDraftCount = prequoteAdmission(profile) ? 0 : await this.markOpenAiDraftsStale(workOrderId, manager);
      profile.version += 1;
      profile.updatedBy = currentUser.id;
      await manager.getRepository(RepairWorkOrderProfile).save(profile);
      await this.audit('repair_quality', inspection.id, `result_${dto.result}`, currentUser, {
        workOrderId,
        profileStatus: profile.lifecycleStatus,
        invalidatedCaseReferenceIds,
        staleAiDraftCount,
      }, manager);
      return { inspection, profile: this.documentProfileView(profile) };
    });
  }

  async createDelivery(workOrderId: number, dto: CreateRepairDeliveryDto, currentUser: CurrentUser) {
    // No-lock scope + delivered-by-actor preflight runs FIRST so a caller
    // without scope cannot learn any finance collection-set fact. Without valid
    // scope no transaction is opened and no business row lock is taken.
    const preflightProfile = await this.loadProfile(workOrderId, this.dataSource.manager);
    const preflightAccess = await this.scopeService.assertAccess(
      currentUser,
      this.scopeFrom(preflightProfile),
      'delivery.record',
    );
    if (preflightAccess.linkedEmployeeId !== dto.deliveredByEmployeeId) {
      throw new BadRequestException('交车记录人必须是当前正式员工身份');
    }

    // Locator-only snapshot. The transaction below never trusts these rows as
    // authority; it uses them only to acquire bank/link locks before current
    // locking reads of the collection set. Any drift fails closed.
    const preFinanceCollections = await this.dataSource
      .getRepository(FinanceCollectionOrder)
      .find({ where: { workOrderId }, order: { id: 'ASC' } });

    // Fail closed before opening a transaction or acquiring any business write
    // lock when the collection set is empty or incomplete.
    if (!preFinanceCollections.length) {
      throw new BadRequestException(
        '[delivery_finance_precondition] 同一维修工单没有正式收款记录，禁止交车',
      );
    }
    for (const item of preFinanceCollections) {
      if (
        item.bankTransactionId == null ||
        item.reconciliationLinkId == null ||
        item.formalConfirmationAuthorityId == null
      ) {
        throw new BadRequestException(
          '[delivery_finance_precondition] 收款集合来源不完整（缺银行/对账/正式权威），禁止交车',
        );
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const profile = await this.loadProfileForUpdate(workOrderId, manager);
      const workOrderEntity = await manager.getRepository(WorkOrder).findOne({
        where: { id: workOrderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!workOrderEntity) {
        throw new BadRequestException('[delivery_finance_precondition] 收款来源工单缺失，禁止交车');
      }
      assertExpectedVersion(profile.version, dto.expectedProfileVersion, '汽修工单');
      assertCanDeliver(profile.lifecycleStatus);
      await this.assertEmployee(dto.deliveredByEmployeeId, manager);
      this.assertOpaqueEvidenceRef(dto.customerAckEvidenceRef, '交车客户确认凭证引用');
      const [activePlan, activeQuote, activeExplanation, vehicle, latestPassedQuality, confirmedRequest] = await Promise.all([
        this.loadApprovedDocument(
          workOrderId,
          'repair_plan',
          profile.activePlanVersion,
          manager,
        ),
        this.loadApprovedDocument(
          workOrderId,
          'quote',
          profile.activeQuoteVersion,
          manager,
        ),
        this.loadApprovedDocument(
          workOrderId,
          'customer_explanation',
          profile.activeExplanationVersion,
          manager,
        ),
        manager.getRepository(RepairVehicleProfile).findOne({ where: { id: profile.vehicleId } }),
        manager.getRepository(RepairQualityInspection).findOne({
          where: { workOrderId, result: 'passed' },
          order: { createdAt: 'DESC' },
        }),
        manager.getRepository(RepairConfirmationRequest).findOne({
          where: {
            workOrderId,
            status: 'confirmed',
            planVersion: profile.activePlanVersion ?? -1,
            quoteVersion: profile.activeQuoteVersion ?? -1,
            explanationVersion: profile.activeExplanationVersion ?? -1,
          },
          order: { decidedAt: 'DESC' },
        }),
      ]);
      if (
        !activePlan ||
        !activeQuote ||
        !activeExplanation ||
        [activePlan.status, activeQuote.status, activeExplanation.status].some(
          (status) => status !== 'authorized',
        )
      ) {
        throw new BadRequestException('交车必须绑定客户已确认的当前方案、报价和解释版本');
      }
      if (!vehicle) {
        throw new NotFoundException('交车车辆档案不存在');
      }
      if (vehicle.odometerKm !== null && dto.finalOdometerKm < vehicle.odometerKm) {
        throw new BadRequestException('交车最终里程不得小于车辆档案当前里程');
      }
      const bankIds = [
        ...new Set(
          preFinanceCollections
            .map((item) => item.bankTransactionId)
            .filter((id): id is number => id != null),
        ),
      ].sort((a, b) => a - b);
      const linkIds = [
        ...new Set(
          preFinanceCollections
            .map((item) => item.reconciliationLinkId)
            .filter((id): id is number => id != null),
        ),
      ].sort((a, b) => a - b);
      const banks = await manager.getRepository(BankSmsTransaction).find({
        where: bankIds.map((id) => ({ id })),
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      const links = await manager.getRepository(FinanceReconciliationLink).find({
        where: linkIds.map((id) => ({ id })),
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      const allFinanceCollections = await manager.getRepository(FinanceCollectionOrder).find({
        where: { workOrderId },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      const preSourceSnapshot = preFinanceCollections.map((item) => ({
        id: item.id,
        workOrderId: item.workOrderId,
        bankTransactionId: item.bankTransactionId,
        reconciliationLinkId: item.reconciliationLinkId,
      }));
      const lockedSourceSnapshot = allFinanceCollections.map((item) => ({
        id: item.id,
        workOrderId: item.workOrderId,
        bankTransactionId: item.bankTransactionId,
        reconciliationLinkId: item.reconciliationLinkId,
      }));
      if (JSON.stringify(preSourceSnapshot) !== JSON.stringify(lockedSourceSnapshot)) {
        throw new ConflictException(
          '[delivery_finance_source_drift] 交车等待期间收款集合或资金来源发生变化，请刷新后重试',
        );
      }
      if (!allFinanceCollections.length) {
        throw new BadRequestException(
          '[delivery_finance_precondition] 同一维修工单没有正式收款记录，禁止交车',
        );
      }
      if (banks.length !== bankIds.length || links.length !== linkIds.length) {
        throw new BadRequestException('[delivery_finance_precondition] 收款来源（银行/对账/工单）缺失，禁止交车');
      }
      const authorityIds = allFinanceCollections
        .map((item) => item.formalConfirmationAuthorityId)
        .filter((id): id is number => id != null)
        .sort((a, b) => a - b);
      const authorities = await manager.getRepository(FinanceCollectionConfirmationAuthority).find({
        where: authorityIds.map((id) => ({ id })),
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      const authorityById = new Map(authorities.map((a) => [a.id, a]));
      if (authorities.length !== allFinanceCollections.length) {
        throw new BadRequestException('[delivery_finance_precondition] 收款权威数量与收款单数量不一致');
      }
      const access = await this.scopeService.assertAccess(
        currentUser,
        this.scopeFrom(profile),
        'delivery.record',
        manager,
        { lockAuthorityRows: true },
      );
      if (access.linkedEmployeeId !== dto.deliveredByEmployeeId) {
        throw new BadRequestException('交车记录人必须是当前正式员工身份');
      }
      const bankById = new Map(banks.map((b) => [b.id, b]));
      const linkById = new Map(links.map((l) => [l.id, l]));
      const seenAuthority = new Set<number>();
      const seenBank = new Set<number>();
      const seenLink = new Set<number>();
      for (const item of allFinanceCollections) {
        if (!isCollectionOrderStrictlyConfirmed(item)) {
          throw new BadRequestException(
            '[delivery_finance_precondition] 同一维修工单的收款集合尚未全部正式确认，禁止交车',
          );
        }
        const authority = item.formalConfirmationAuthorityId
          ? authorityById.get(item.formalConfirmationAuthorityId)
          : null;
        if (!authority) {
          throw new BadRequestException('[delivery_finance_precondition] 收款单缺少正式权威，禁止交车');
        }
        if (seenAuthority.has(authority.id)) {
          throw new BadRequestException('[delivery_finance_precondition] 同一正式权威被多笔收款复用');
        }
        seenAuthority.add(authority.id);
        if (item.bankTransactionId != null && seenBank.has(item.bankTransactionId)) {
          throw new BadRequestException('[delivery_finance_precondition] 同一银行流水被多笔收款复用');
        }
        if (item.reconciliationLinkId != null && seenLink.has(item.reconciliationLinkId)) {
          throw new BadRequestException('[delivery_finance_precondition] 同一对账链接被多笔收款复用');
        }
        if (item.bankTransactionId != null) seenBank.add(item.bankTransactionId);
        if (item.reconciliationLinkId != null) seenLink.add(item.reconciliationLinkId);

        const bank = item.bankTransactionId != null ? bankById.get(item.bankTransactionId) : null;
        const link = item.reconciliationLinkId != null ? linkById.get(item.reconciliationLinkId) : null;
        if (!bank || !link) {
          throw new BadRequestException('[delivery_finance_precondition] 收款单来源（银行/对账）缺失，禁止交车');
        }
        const problems = collectAuthorityEnvelopeProblems({
          order: item,
          authority,
          profile,
          bank,
          link,
          workOrder: workOrderEntity,
        });
        if (problems.length) {
          throw new BadRequestException(
            `[delivery_finance_precondition] 收款权威校验失败: ${problems.join(',')}`,
          );
        }
      }
      const financeCandidates = allFinanceCollections;
      const totalGrossCents = financeCandidates.reduce(
        (sum, item) => sum + BigInt(authorityById.get(item.formalConfirmationAuthorityId!)!.grossCents),
        0n,
      );
      const financeReadyAmount = centsToDecimal(totalGrossCents);
      const quoteTotal = normalizeMoney(activeQuote.payload.total as string | number);
      if (compareMoney(financeReadyAmount, quoteTotal) < 0) {
        throw new BadRequestException(
          '[delivery_finance_precondition] 既有资金主链尚无覆盖当前报价的已确认收款记录',
        );
      }
      const deliveredAt = new Date(dto.deliveredAt);
      this.assertDeliveryTimeline(
        deliveredAt,
        latestPassedQuality?.createdAt,
        confirmedRequest?.decidedAt,
      );
      const repo = manager.getRepository(RepairDeliveryRecord);
      if (await repo.findOne({ where: { workOrderId } })) {
        throw new ConflictException('该工单已存在交车记录');
      }
      const delivery = await repo.save(
        repo.create({
          workOrderId,
          checklist: dto.checklist,
          planVersion: activePlan.version,
          quoteVersion: activeQuote.version,
          explanationVersion: activeExplanation.version,
          financeEvidenceRefs: financeCandidates.map(
            (item) => `finance-collection-order:${item.id}`,
          ),
          quoteTotalSnapshot: quoteTotal,
          financeReadyAmountSnapshot: financeReadyAmount,
          finalOdometerKm: dto.finalOdometerKm,
          repairSummary: dto.repairSummary.trim(),
          unresolvedReminders: dto.unresolvedReminders
            .map((item) => item.trim())
            .filter(Boolean),
          customerAckEvidenceRef: dto.customerAckEvidenceRef.trim(),
          deliveredByEmployeeId: dto.deliveredByEmployeeId,
          deliveredAt,
          createdBy: currentUser.id,
        }),
      );
      profile.lifecycleStatus = 'delivered';
      const staleAiDraftCount = await this.markOpenAiDraftsStale(workOrderId, manager);
      profile.version += 1;
      profile.updatedBy = currentUser.id;
      await manager.getRepository(RepairWorkOrderProfile).save(profile);
      await this.audit('repair_delivery', delivery.id, 'record_delivery', currentUser, {
        workOrderId,
        customerAckEvidencePresent: true,
        financeCollectionOrderIds: financeCandidates.map((item) => item.id),
        planVersion: delivery.planVersion,
        quoteVersion: delivery.quoteVersion,
        explanationVersion: delivery.explanationVersion,
        finalOdometerKm: delivery.finalOdometerKm,
        financeReadyAmount,
        quoteTotal,
        financeReadOnly: true,
        paymentMutation: false,
        staleAiDraftCount,
      }, manager);
      return { delivery, profile };
    });
  }

  async createWarranty(workOrderId: number, dto: CreateRepairWarrantyDto, currentUser: CurrentUser) {
    return this.dataSource.transaction(async (manager) => {
      const profile = await this.loadProfileForUpdate(workOrderId, manager);
      await this.scopeService.assertAccess(
        currentUser,
        this.scopeFrom(profile),
        'warranty.manage',
        manager,
      );
      assertExpectedVersion(profile.version, dto.expectedProfileVersion, '汽修工单');
      if (!['delivered', 'after_sales'].includes(profile.lifecycleStatus)) {
        throw new BadRequestException('只有已交车工单可以建立保修或售后记录');
      }
      if (dto.endsAt && new Date(dto.endsAt) <= new Date(dto.startsAt)) {
        throw new BadRequestException('保修结束时间必须晚于开始时间');
      }
      if (dto.warrantyType === 'claim' && !dto.claimNote?.trim()) {
        throw new BadRequestException('售后索赔必须填写问题和处理说明');
      }
      const delivery = await manager.getRepository(RepairDeliveryRecord).findOne({
        where: { workOrderId },
      });
      if (!delivery || new Date(dto.startsAt) < delivery.deliveredAt) {
        throw new BadRequestException('保修或售后起始时间不得早于正式交车时间');
      }
      const repo = manager.getRepository(RepairWarrantyRecord);
      const warranty = await repo.save(
        repo.create({
          workOrderId,
          warrantyType: dto.warrantyType,
          coverageSnapshot: dto.coverageSnapshot,
          startsAt: new Date(dto.startsAt),
          endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
          status: dto.warrantyType === 'claim' ? 'claimed' : 'active',
          claimNote: dto.claimNote?.trim() || null,
          createdBy: currentUser.id,
        }),
      );
      const invalidatedCaseReferenceIds =
        dto.warrantyType === 'claim'
          ? await this.invalidateReferencedCases(
              workOrderId,
              '保修索赔使既有案例证据需要复核',
              currentUser,
              manager,
            )
          : [];
      if (dto.warrantyType === 'claim') profile.lifecycleStatus = 'after_sales';
      const staleAiDraftCount = await this.markOpenAiDraftsStale(workOrderId, manager);
      profile.version += 1;
      profile.updatedBy = currentUser.id;
      await manager.getRepository(RepairWorkOrderProfile).save(profile);
      await this.audit('repair_warranty', warranty.id, `create_${dto.warrantyType}`, currentUser, {
        workOrderId,
        customerRightsMutation: false,
        invalidatedCaseReferenceIds,
        staleAiDraftCount,
      }, manager);
      return { warranty, profile };
    });
  }

  async transitionLifecycle(
    workOrderId: number,
    dto: TransitionRepairLifecycleDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const profile = await this.loadProfileForUpdate(workOrderId, manager);
      await this.scopeService.assertAccess(
        currentUser,
        this.scopeFrom(profile),
        'repair.supervise',
        manager,
      );
      assertExpectedVersion(profile.version, dto.expectedProfileVersion, '汽修工单');
      assertManualTransition(profile.lifecycleStatus, dto.targetStatus);
      const from = profile.lifecycleStatus;
      const cancelledConfirmations = await manager.getRepository(RepairConfirmationRequest).update(
        { workOrderId, status: 'pending' },
        { status: 'cancelled' },
      );
      const transitionAt = new Date();
      if (dto.targetStatus === 'resume') {
        if (!profile.suspendedFromStatus || profile.suspendedFromStatus === 'suspended') {
          throw new BadRequestException('[resume_not_allowed] 暂停前状态证据缺失，不能猜测恢复阶段');
        }
        profile.lifecycleStatus = profile.suspendedFromStatus;
        profile.resumedAt = transitionAt;
        profile.resumedBy = currentUser.id;
        profile.resumeReason = dto.reason.trim();
      } else {
        profile.lifecycleStatus = dto.targetStatus;
        if (dto.targetStatus === 'suspended') {
          profile.suspendedFromStatus = from;
          profile.suspendedAt = transitionAt;
          profile.suspendedBy = currentUser.id;
          profile.suspensionReason = dto.reason.trim();
          profile.resumedAt = null;
          profile.resumedBy = null;
          profile.resumeReason = null;
        }
      }
      if ((cancelledConfirmations.affected ?? 0) > 0) {
        profile.customerConfirmationState = 'expired';
      }
      const staleAiDraftCount = await this.markOpenAiDraftsStale(workOrderId, manager);
      profile.version += 1;
      profile.updatedBy = currentUser.id;
      await manager.getRepository(RepairWorkOrderProfile).save(profile);
      await this.audit('repair_work_order', workOrderId, `transition_${dto.targetStatus}`, currentUser, {
        from,
        to: profile.lifecycleStatus,
        reason: dto.reason.trim(),
        suspendedFromStatus: profile.suspendedFromStatus,
        suspendedBy: profile.suspendedBy,
        resumedBy: profile.resumedBy,
        cancelledPendingConfirmationCount: cancelledConfirmations.affected ?? 0,
        staleAiDraftCount,
      }, manager);
      return profile;
    });
  }

  async createKnowledgeReference(
    dto: CreateRepairKnowledgeReferenceDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      this.assertNoRawSensitiveText(dto.title, '知识标题');
      this.assertNoRawSensitiveText(dto.sourceAuthority, '知识来源');
      for (const tag of dto.tags) this.assertNoRawSensitiveText(tag, '知识标签');
      if (dto.revision) this.assertNoRawSensitiveText(dto.revision, '知识修订号');
      if (dto.riskNotice) this.assertNoRawSensitiveText(dto.riskNotice, '知识风险提示');
      this.assertNoSensitiveJson(dto.applicability, '车型适用范围');
      if (dto.validUntil && dto.effectiveAt && new Date(dto.validUntil) <= new Date(dto.effectiveAt)) {
        throw new BadRequestException('知识引用有效期必须晚于生效时间');
      }
      const referenceUrl = new URL(dto.url.trim());
      if (referenceUrl.protocol !== 'https:') {
        throw new BadRequestException('知识引用必须使用 HTTPS 链接');
      }
      if (referenceUrl.username || referenceUrl.password) {
        throw new BadRequestException('知识引用链接不得包含用户名或密码');
      }
      if (
        [...referenceUrl.searchParams.keys()].some((key) =>
          /token|secret|password|credential|signature|api[_-]?key/i.test(key),
        )
      ) {
        throw new BadRequestException('知识引用链接不得包含凭据类查询参数');
      }
      this.assertNoRawSensitiveText(referenceUrl.toString(), '知识引用链接');
      const canonicalAuthorityRank = knowledgeAuthorityRank(dto.referenceType);
      if (dto.authorityRank !== canonicalAuthorityRank) {
        throw new BadRequestException(
          `[knowledge_authority_conflict] ${dto.referenceType} 的权威等级必须为 ${canonicalAuthorityRank}`,
        );
      }
      const versionedWorkOrderCount = await this.advanceKnowledgeCatalogVersions(manager);
      const repo = manager.getRepository(RepairKnowledgeReference);
      const reference = await repo.save(
        repo.create({
          referenceType: dto.referenceType,
          title: dto.title.trim(),
          url: referenceUrl.toString(),
          sourceAuthority: dto.sourceAuthority.trim(),
          authorityRank: canonicalAuthorityRank,
          tags: dto.tags.map((item) => item.trim()).filter(Boolean),
          applicability: dto.applicability,
          revision: dto.revision?.trim() || null,
          effectiveAt: dto.effectiveAt ? new Date(dto.effectiveAt) : null,
          verifiedAt: null,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          reviewStatus: 'review_pending',
          reviewReason: null,
          riskNotice: dto.riskNotice?.trim() || null,
          active: true,
          createdBy: currentUser.id,
          reviewedBy: null,
          version: 1,
        }),
      );
      const staleAiDraftCount = await this.markAllOpenAiDraftsStale(manager);
      await this.audit('repair_knowledge', reference.id, 'create_curated_reference', currentUser, {
        referenceType: reference.referenceType,
        authority: reference.sourceAuthority,
        authorityRank: reference.authorityRank,
        reviewStatus: reference.reviewStatus,
        versionedWorkOrderCount,
        staleAiDraftCount,
      }, manager);
      return reference;
    });
  }

  async updateKnowledgeReview(
    id: number,
    dto: UpdateRepairKnowledgeReviewDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(RepairKnowledgeReference);
      const observed = await repo.findOne({ where: { id } });
      if (!observed) throw new NotFoundException('知识引用不存在');
      assertExpectedVersion(observed.version, dto.expectedVersion, '知识引用');
      if (['withdrawn', 'superseded'].includes(observed.reviewStatus)) {
        throw new BadRequestException(`知识引用 ${observed.reviewStatus} 后不可直接恢复`);
      }
      const versionedWorkOrderCount = await this.advanceKnowledgeCatalogVersions(manager);
      const reference = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!reference) throw new NotFoundException('知识引用不存在');
      assertExpectedVersion(reference.version, dto.expectedVersion, '知识引用');
      if (['withdrawn', 'superseded'].includes(reference.reviewStatus)) {
        throw new BadRequestException(`知识引用 ${reference.reviewStatus} 后不可直接恢复`);
      }
      reference.reviewStatus = dto.reviewStatus;
      reference.reviewReason = dto.reviewReason.trim();
      reference.reviewedBy = currentUser.id;
      reference.verifiedAt = dto.reviewStatus === 'verified' ? new Date() : reference.verifiedAt;
      reference.active = !['withdrawn', 'superseded'].includes(dto.reviewStatus);
      reference.version += 1;
      const saved = await repo.save(reference);
      const invalidatedCaseReferenceIds =
        dto.reviewStatus === 'verified' && saved.referenceType !== 'case'
          ? await this.invalidateCasesForHigherAuthority(saved, currentUser, manager)
          : [];
      const staleAiDraftCount = await this.markAllOpenAiDraftsStale(manager);
      await this.audit('repair_knowledge', saved.id, `review_${dto.reviewStatus}`, currentUser, {
        referenceType: saved.referenceType,
        authorityRank: saved.authorityRank,
        version: saved.version,
        versionedWorkOrderCount,
        invalidatedCaseReferenceIds,
        staleAiDraftCount,
      }, manager);
      return saved;
    });
  }

  async queryKnowledge(query: QueryRepairKnowledgeDto) {
    const items = await this.dataSource.getRepository(RepairKnowledgeReference).find({
      where: {
        active: true,
        reviewStatus: 'verified',
        ...(query.referenceType ? { referenceType: query.referenceType } : {}),
      },
      order: { authorityRank: 'DESC', verifiedAt: 'DESC', id: 'DESC' },
      take: 200,
    });
    const terms = (query.query ?? '')
      .toLowerCase()
      .split(/[\s,，;；/]+/)
      .filter(Boolean);
    const now = Date.now();
    const currentItems = items.filter(
      (item) =>
        (!item.effectiveAt || item.effectiveAt.getTime() <= now) &&
        (!item.validUntil || item.validUntil.getTime() >= now),
    );
    return currentItems
      .map((item) => {
        const haystack = `${item.title} ${item.sourceAuthority} ${item.tags.join(' ')} ${this.stableStringify(item.applicability)}`.toLowerCase();
        const matchedTerms = terms.filter((term) => haystack.includes(term));
        return {
          id: item.id,
          referenceType: item.referenceType,
          title: item.title,
          url: item.url,
          sourceAuthority: item.sourceAuthority,
          authorityRank: knowledgeAuthorityRank(item.referenceType),
          tags: item.tags,
          applicability: item.applicability,
          revision: item.revision,
          effectiveAt: item.effectiveAt,
          verifiedAt: item.verifiedAt,
          validUntil: item.validUntil,
          reviewStatus: item.reviewStatus,
          riskNotice: item.riskNotice,
          similarityScore: terms.length ? Number((matchedTerms.length / terms.length).toFixed(4)) : 0,
          matchingReason: matchedTerms.length
            ? `匹配关键词：${matchedTerms.join('、')}`
            : '未提供检索词，按权威等级和核验时间排序',
        };
      })
      .filter((item) => !terms.length || item.similarityScore > 0)
      .sort(
        (left, right) =>
          right.authorityRank - left.authorityRank ||
          right.similarityScore - left.similarityScore ||
          right.id - left.id,
      );
  }

  async createAiDraft(workOrderId: number, dto: CreateRepairAiDraftDto, currentUser: CurrentUser) {
    const result = await this.createAiDraftOperation(workOrderId, dto, currentUser);
    return this.toSafeAiDraftProjection(result.artifact);
  }

  private async createAiDraftOperation(
    workOrderId: number,
    dto: CreateRepairAiDraftDto,
    currentUser: CurrentUser,
    assistantContext?: AssistantCallContext,
  ): Promise<AuditedArtifact<RepairAiDraft>> {
    const buildSafeInput = (
      profile: RepairWorkOrderProfile,
      vehicle: RepairVehicleProfile,
    ) => {
      const sensitiveTokens = [profile.customerDisplaySnapshot, vehicle.plateNumber];
      return {
        draftType: dto.draftType,
        expectedProfileVersion: dto.expectedProfileVersion,
        symptoms: dto.symptoms
          ? this.redactExternalText(dto.symptoms.trim(), sensitiveTokens)
          : null,
        customerQuestion: dto.customerQuestion
          ? this.redactExternalText(dto.customerQuestion.trim(), sensitiveTokens)
          : null,
        searchTerms: (dto.searchTerms ?? [])
          .map((item) => this.redactExternalText(item.trim(), sensitiveTokens))
          .filter(Boolean),
        context: this.redactSensitiveJson(dto.context ?? {}, sensitiveTokens),
      };
    };
    try {
      return await this.dataSource.transaction(async (manager) => {
        const profile = await this.loadProfileForUpdate(workOrderId, manager);
        await this.scopeService.assertAccess(currentUser, this.scopeFrom(profile), 'ai.draft', manager);
        const repo = manager.getRepository(RepairAiDraft);
        const vehicle = await manager.getRepository(RepairVehicleProfile).findOne({
          where: { id: profile.vehicleId },
          lock: { mode: 'pessimistic_read' },
        });
        if (!vehicle) throw new NotFoundException('车辆档案不存在');
        const safeInput = buildSafeInput(profile, vehicle);
        const requestFingerprint = this.fingerprint({ workOrderId, ...safeInput });
        const idempotent = await repo.findOne({
          where: { requestIdempotencyKey: dto.requestIdempotencyKey },
        });
        if (idempotent) {
          return this.replayAiDraft(
            idempotent,
            profile,
            requestFingerprint,
            currentUser,
            manager,
            assistantContext,
          );
        }
        assertExpectedVersion(profile.version, dto.expectedProfileVersion, '汽修工单');
        const documents = await manager
          .getRepository(RepairDocumentVersion)
          .find({ where: { workOrderId } });
        const knowledge = await this.loadVerifiedKnowledgeForAi(manager);
        const sensitiveTokens = [profile.customerDisplaySnapshot, vehicle.plateNumber];
        const safeDocuments = documents.map((document) => ({
          ...document,
          summary: this.redactExternalText(document.summary, sensitiveTokens),
          payload: this.redactSensitiveJson(document.payload, sensitiveTokens),
        }));
        const output = this.aiDraftService.build({
          draftType: dto.draftType,
          symptoms: safeInput.symptoms ?? undefined,
          customerQuestion: safeInput.customerQuestion ?? undefined,
          searchTerms: safeInput.searchTerms,
          context: safeInput.context,
          vehicle,
          documents: safeDocuments,
          knowledge,
        });
        const referenceIds = ((output.sourceReferences as Array<{ id?: number }> | undefined) ?? [])
          .map((item) => item.id)
          .filter((id): id is number => Number.isInteger(id));
        const knowledgeDependencySnapshot = knowledge
          .map((item) => ({
            id: item.id,
            version: item.version,
            reviewStatus: item.reviewStatus,
            active: item.active,
          }))
          .sort((left, right) => left.id - right.id);
        const draft = await repo.save(
          repo.create({
            workOrderId,
            draftType: dto.draftType,
            requestIdempotencyKey: dto.requestIdempotencyKey,
            requestFingerprint,
            inputSnapshot: {
              symptoms: safeInput.symptoms,
              customerQuestion: safeInput.customerQuestion,
              searchTerms: safeInput.searchTerms,
              context: safeInput.context,
              profileVersion: profile.version,
              knowledgeCatalogVersion: profile.knowledgeCatalogVersion,
              knowledgeDependencySnapshot,
              generatorContractVersion: 'repair_ai_draft_v1',
              policyVersion: 'repair_ai_policy_v1',
            },
            outputSnapshot: this.redactSensitiveJson(output, sensitiveTokens),
            knowledgeReferenceIds: referenceIds.length ? referenceIds : null,
            status: 'draft',
            requiresHumanReview: true,
            createdBy: currentUser.id,
          }),
        );
        const audit = await this.auditAssistantAware('repair_ai_draft', draft.id, `create_${draft.draftType}`, currentUser, {
          workOrderId,
          requiresHumanReview: true,
          executionBlocked: true,
          referenceCount: referenceIds.length,
          knowledgeCatalogVersion: profile.knowledgeCatalogVersion,
          knowledgeDependencyCount: knowledgeDependencySnapshot.length,
          generatorContractVersion: 'repair_ai_draft_v1',
          policyVersion: 'repair_ai_policy_v1',
          ...(assistantContext ? this.assistantAuditDetail(assistantContext, 'allowed', true) : {}),
        }, manager, assistantContext);
        return { artifact: draft, auditId: audit.id, created: true };
      });
    } catch (error) {
      if (!this.isDuplicateKeyError(error, 'uq_repair_ai_draft_idempotency')) {
        throw error;
      }
      return this.dataSource.transaction(async (manager) => {
        const profile = await this.loadProfileForUpdate(workOrderId, manager);
        await this.scopeService.assertAccess(currentUser, this.scopeFrom(profile), 'ai.draft', manager);
        const vehicle = await manager.getRepository(RepairVehicleProfile).findOne({
          where: { id: profile.vehicleId },
          lock: { mode: 'pessimistic_read' },
        });
        if (!vehicle) throw new NotFoundException('车辆档案不存在');
        const safeInput = buildSafeInput(profile, vehicle);
        const requestFingerprint = this.fingerprint({ workOrderId, ...safeInput });
        const idempotent = await manager.getRepository(RepairAiDraft).findOne({
          where: { requestIdempotencyKey: dto.requestIdempotencyKey },
        });
        if (!idempotent) throw error;
        return this.replayAiDraft(
          idempotent,
          profile,
          requestFingerprint,
          currentUser,
          manager,
          assistantContext,
        );
      });
    }
  }

  private async replayAiDraft(
    draft: RepairAiDraft,
    profile: RepairWorkOrderProfile,
    requestFingerprint: string,
    currentUser: CurrentUser,
    manager: EntityManager,
    assistantContext?: AssistantCallContext,
  ): Promise<AuditedArtifact<RepairAiDraft>> {
    if (
      draft.workOrderId !== profile.workOrderId ||
      draft.requestFingerprint !== requestFingerprint
    ) {
      throw new ConflictException('AI 草稿幂等键已绑定不同请求内容');
    }
    const inputProfileVersion = Number(draft.inputSnapshot.profileVersion);
    const inputKnowledgeCatalogVersion = Number(
      draft.inputSnapshot.knowledgeCatalogVersion,
    );
    if (
      draft.status === 'draft' &&
      (
        !Number.isInteger(inputProfileVersion) ||
        inputProfileVersion !== profile.version ||
        !Number.isInteger(inputKnowledgeCatalogVersion) ||
        inputKnowledgeCatalogVersion !== profile.knowledgeCatalogVersion
      )
    ) {
      draft.status = 'stale';
      await manager.getRepository(RepairAiDraft).save(draft);
    }
    const assistantReplayBlocked = !this.isAiDraftOutputReturnable(draft.status);
    const audit = await this.auditAssistantAware('repair_ai_draft', draft.id, 'idempotent_replay', currentUser, {
      workOrderId: profile.workOrderId,
      status: draft.status,
      requiresHumanReview: true,
      ...(assistantContext
        ? this.assistantAuditDetail(
            assistantContext,
            assistantReplayBlocked ? 'blocked' : 'allowed',
            false,
            assistantReplayBlocked ? 'no_effect' : assistantContext.requestedEffectClass,
          )
        : {}),
    }, manager, assistantContext);
    return { artifact: draft, auditId: audit.id, created: false };
  }

  async getAssistantSafeWorkOrder(workOrderId: number, currentUser: CurrentUser) {
    const context = this.newAssistantContext('repair.work_order_summary.query', 'read_only');
    return this.executeAssistantRead(workOrderId, currentUser, context, async () => {
      this.assertAssistantActor(currentUser);
      const workspace = await this.getWorkspace(workOrderId, currentUser);
      if (!workspace.profile) return { configured: false };
      return this.toAssistantSafeWorkspace(workspace);
    }, ['repair.progress.query', 'repair.ai_draft.create', 'repair.confirmation_request.create']);
  }

  async getAssistantProgress(workOrderId: number, currentUser: CurrentUser) {
    const context = this.newAssistantContext('repair.progress.query', 'read_only');
    return this.executeAssistantRead(workOrderId, currentUser, context, async () => {
      this.assertAssistantActor(currentUser);
      const workspace = await this.getWorkspace(workOrderId, currentUser);
      if (!workspace.profile) return { configured: false };
      return {
        configured: true,
        lifecycleStatus: workspace.profile.lifecycleStatus,
        profileVersion: workspace.profile.version,
        confirmationState:
          workspace.confirmationRequests[0]?.status ?? workspace.profile.customerConfirmationState,
        taskSummary: this.countByStatus(workspace.tasks),
        latestQualityResult: workspace.qualityInspections[0]?.result ?? null,
        financeReadiness: workspace.financeReadiness.ready ? 'ready' : 'not_ready',
        delivered: Boolean(workspace.delivery),
        warrantyCount: workspace.warranties.length,
      };
    }, ['repair.work_order_summary.query']);
  }

  async createAssistantAiDraft(
    workOrderId: number,
    dto: CreateRepairAiDraftDto,
    currentUser: CurrentUser,
  ) {
    const context = this.newAssistantContext('repair.ai_draft.create', 'draft_only');
    try {
      this.assertAssistantActor(currentUser);
      const result = await this.createAiDraftOperation(workOrderId, dto, currentUser, context);
      const draft = result.artifact;
      if (!this.isAiDraftOutputReturnable(draft.status)) {
        return this.assistantEnvelope(context, 'blocked', 'no_effect', result.auditId, {
          artifact: {
            type: `repair_${draft.draftType}_draft`,
            ref: `repair-ai-draft:${draft.id}`,
            state: draft.status,
            version: 1,
          },
          safeSummary: null,
          allowedNextCapabilities: [
            'repair.work_order_summary.query',
            'repair.ai_draft.create_with_new_idempotency_key',
          ],
          blockerCodes: [this.aiDraftReplayBlockerCode(draft.status)],
        });
      }
      return this.assistantEnvelope(context, 'allowed', 'draft_only', result.auditId, {
        artifact: {
          type: `repair_${draft.draftType}_draft`,
          ref: `repair-ai-draft:${draft.id}`,
          state: draft.status,
          version: 1,
        },
        safeSummary: {
          draftType: draft.draftType,
          outputState: 'available_for_authorized_internal_review',
          knowledgeReferenceCount: draft.knowledgeReferenceIds?.length ?? 0,
          requiresHumanReview: true,
          executionBlocked: true,
          idempotencyResult: result.created ? 'created' : 'replayed',
          createdAt: draft.createdAt,
        },
        allowedNextCapabilities: ['repair.ai_draft.review', 'repair.work_order_summary.query'],
        draftArtifactWriteCounter: result.created ? 1 : 0,
      });
    } catch (error) {
      return this.assistantBlockedEnvelope(workOrderId, currentUser, context, error);
    }
  }

  async createAssistantConfirmationRequest(
    workOrderId: number,
    dto: CreateRepairConfirmationRequestDto,
    currentUser: CurrentUser,
  ) {
    const context = this.newAssistantContext(
      'repair.confirmation_request.create',
      'confirmation_request_only',
    );
    try {
      this.assertAssistantActor(currentUser);
      const result = await this.createConfirmationRequestOperation(
        workOrderId,
        dto,
        currentUser,
        context,
      );
      const request = result.artifact;
      if (!result.created && request.status !== 'pending') {
        return this.assistantEnvelope(context, 'blocked', 'no_effect', result.auditId, {
          artifact: {
            type: 'repair_confirmation_request',
            ref: `repair-confirmation:${request.id}`,
            state: request.status,
            version: request.version,
          },
          safeSummary: {
            status: request.status,
            idempotencyResult: 'replayed',
            assistantConfirmed: false,
          },
          allowedNextCapabilities: ['repair.progress.query'],
          blockerCodes: [
            ['cancelled', 'expired'].includes(request.status)
              ? 'confirmation_request_stale'
              : 'confirmation_request_terminal',
          ],
        });
      }
      return this.assistantEnvelope(
        context,
        'human_confirmation_required',
        'confirmation_request_only',
        result.auditId,
        {
          artifact: {
            type: 'repair_customer_confirmation_request',
            ref: `repair-confirmation:${request.id}`,
            state: request.status,
            version: request.version,
          },
          safeSummary: {
            planVersion: request.planVersion,
            quoteVersion: request.quoteVersion,
            explanationVersion: request.explanationVersion,
            channel: request.channel,
            status: request.status,
            idempotencyResult: result.created ? 'created' : 'replayed',
            requestedAt: request.requestedAt,
            assistantConfirmed: false,
          },
          allowedNextCapabilities: ['repair.progress.query'],
          confirmationRequestWriteCounter: result.created ? 1 : 0,
        },
      );
    } catch (error) {
      return this.assistantBlockedEnvelope(workOrderId, currentUser, context, error);
    }
  }

  private async loadWorkspace(profile: RepairWorkOrderProfile, manager = this.dataSource.manager, prequoteOnly = false, intakeExecutionOnly = false) {
    const workOrderId = profile.workOrderId;
    const currentRead = intakeExecutionOnly ? { lock: { mode: 'pessimistic_read' as const } } : {};
    const [
      workOrder,
      vehicle,
      documents,
      confirmationRequests,
      tasks,
      laborItems,
      partLinks,
      qualityInspections,
      delivery,
      warranties,
      aiDrafts,
      financeCandidates,
    ] = await Promise.all([
      manager.getRepository(WorkOrder).findOne({ where: { id: workOrderId } }),
      manager.getRepository(RepairVehicleProfile).findOne({ where: { id: profile.vehicleId } }),
      manager.getRepository(RepairDocumentVersion).find({
        where: { workOrderId, documentType: In(['intake_inspection', 'diagnosis', 'repair_plan', 'quote', 'customer_explanation']) },
        order: { documentType: 'ASC', version: 'DESC' },
        ...currentRead,
      }),
      prequoteOnly && !intakeExecutionOnly ? Promise.resolve([] as RepairConfirmationRequest[]) : manager.getRepository(RepairConfirmationRequest).find({
        where: { workOrderId },
        order: { createdAt: 'DESC' },
        ...currentRead,
      }),
      prequoteOnly && !intakeExecutionOnly ? Promise.resolve([] as RepairTask[]) : manager.getRepository(RepairTask).find({
        where: { workOrderId },
        order: { id: 'ASC' },
        ...currentRead,
      }),
      prequoteOnly && !intakeExecutionOnly ? Promise.resolve([] as RepairLaborItem[]) : manager.getRepository(RepairLaborItem).find({
        where: { workOrderId },
        order: { id: 'ASC' },
        ...currentRead,
      }),
      prequoteOnly && !intakeExecutionOnly ? Promise.resolve([] as RepairPartLink[]) : manager.getRepository(RepairPartLink).find({
        where: { workOrderId },
        order: { id: 'ASC' },
        ...currentRead,
      }),
      prequoteOnly && !intakeExecutionOnly ? Promise.resolve([] as RepairQualityInspection[]) : manager.getRepository(RepairQualityInspection).find({
        where: { workOrderId },
        order: { createdAt: 'DESC' },
        ...currentRead,
      }),
      prequoteOnly ? Promise.resolve(null) : manager.getRepository(RepairDeliveryRecord).findOne({ where: { workOrderId } }),
      prequoteOnly ? Promise.resolve([] as RepairWarrantyRecord[]) : manager.getRepository(RepairWarrantyRecord).find({
        where: { workOrderId },
        order: { createdAt: 'DESC' },
      }),
      prequoteOnly ? Promise.resolve([] as RepairAiDraft[]) : manager.getRepository(RepairAiDraft).find({
        where: { workOrderId },
        order: { createdAt: 'DESC' },
        take: 30,
      }),
      prequoteOnly ? Promise.resolve([] as FinanceCollectionOrder[]) : manager.getRepository(FinanceCollectionOrder).find({
        where: {
          workOrderId,
          sourceType: 'work_order',
          businessType: 'maintenance',
        },
      }).then((items) => items.filter((item) => this.isCollectionOrderConfirmed(item))),
    ]);
    const activeQuote = documents.find(
      (document) =>
        document.documentType === 'quote' &&
        document.version === profile.activeQuoteVersion &&
        document.status === 'authorized',
    );
    const financeReadyAmount = addMoney(
      ...financeCandidates.map((item) => item.receiptAmount ?? item.bankReceivedAmount ?? '0.00'),
    );
    const requiredQuoteTotal = activeQuote
      ? normalizeMoney(activeQuote.payload.total as string | number)
      : null;
    return {
      prequoteOnly,
      intakeExecutionOnly,
      ...(prequoteOnly ? { financialEffect: false, wagesAvailable: false } : {}),
      workOrder: workOrder
        ? {
            id: workOrder.id,
            workOrderNo: workOrder.workOrderNo,
            title: workOrder.title,
            status: workOrder.status,
          }
        : null,
      profile: this.documentProfileView(profile),
      vehicle: vehicle
        ? {
            id: vehicle.id,
            plateNumber: vehicle.plateNumber,
            vinMasked: maskVin(vehicle.vin),
            brand: vehicle.brand,
            model: vehicle.model,
            modelYear: vehicle.modelYear,
            engineCode: vehicle.engineCode,
            salesMarket: vehicle.salesMarket,
            odometerKm: vehicle.odometerKm,
            version: vehicle.version,
          }
        : null,
      documents,
      confirmationRequests: confirmationRequests.map((request) => ({
        id: request.id,
        planVersion: request.planVersion,
        quoteVersion: request.quoteVersion,
        explanationVersion: request.explanationVersion,
        channel: request.channel,
        recipientMasked: request.recipientMasked,
        status: request.status,
        decisionEvidenceRef: request.decisionEvidenceRef,
        decisionNote: request.decisionNote,
        requestedAt: request.requestedAt,
        decidedAt: request.decidedAt,
        version: request.version,
      })),
      tasks,
      laborItems,
      partLinks,
      qualityInspections,
      delivery,
      warranties,
      aiDrafts: aiDrafts.map((draft) => this.toSafeAiDraftProjection(draft)),
      financeReadiness: {
        ready:
          requiredQuoteTotal !== null &&
          financeCandidates.length > 0 &&
          compareMoney(financeReadyAmount, requiredQuoteTotal) >= 0,
        evidenceCount: financeCandidates.length,
        readyAmount: financeReadyAmount,
        requiredQuoteTotal,
        source: prequoteOnly ? 'unquoted_no_financial_effect' : 'finance_collection_order',
        readOnly: true,
      },
      boundaries: {
        formalWorkOrderRoot: 'work_orders',
        inventorySource: 'work_order_materials/inventory_transactions',
        financeSource: 'payment_records/payout_records/finance_*',
        approvalSource: 'approval_requests',
        assistantMayExecute: false,
      },
    };
  }

  private toAssistantSafeWorkspace(workspace: Awaited<ReturnType<RepairShopService['loadWorkspace']>>) {
    return {
      contractVersion: 'repair_shop_assistant_safe_query_v1',
      subjectMode: 'staff_delegation',
      workOrderId: workspace.profile.workOrderId,
      lifecycleStatus: workspace.profile.lifecycleStatus,
      profileVersion: workspace.profile.version,
      scope: {
        companyRef: workspace.profile.companyRef,
        businessSectorRef: workspace.profile.businessSectorRef,
        storeRef: workspace.profile.storeRef,
        customerRefMasked: maskCustomerRef(workspace.profile.customerRef),
      },
      vehicle: workspace.vehicle
        ? {
            plateMasked: this.maskPlate(workspace.vehicle.plateNumber),
            vinMasked: workspace.vehicle.vinMasked,
            fullPlateAvailableInAuthorizedInternalWorkspace: true,
            vehicleSpecificationState:
              workspace.vehicle.brand || workspace.vehicle.model || workspace.vehicle.salesMarket
                ? 'available_for_authorized_internal_review'
                : 'not_recorded',
            modelYear: workspace.vehicle.modelYear,
            odometerKm: workspace.vehicle.odometerKm,
          }
        : null,
      financeReadiness: {
        status: workspace.financeReadiness.ready
          ? 'confirmed_collection_coverage'
          : 'not_ready',
        evidenceCount: workspace.financeReadiness.evidenceCount,
        source: workspace.financeReadiness.source,
        readOnly: true,
      },
      latestDocuments: this.latestDocumentSummaries(workspace.documents),
      confirmationState: workspace.profile.customerConfirmationState,
      tasks: workspace.tasks.map((task) => ({
        id: task.id,
        planItemRef: task.planItemRef,
        reworkOfInspectionRef: task.reworkOfInspectionId
          ? `repair-quality-inspection:${task.reworkOfInspectionId}`
          : null,
        status: task.status,
        technicianAssigned: Boolean(task.technicianEmployeeId),
      })),
      latestQualityResult: workspace.qualityInspections[0]?.result ?? null,
      delivered: Boolean(workspace.delivery),
      warrantyCount: workspace.warranties.length,
      capabilities: ['query', 'generate_draft', 'request_confirmation', 'query_progress'],
      blockedCapabilities: [
        'confirm_payment',
        'issue_inventory',
        'complete_repair_task',
        'pass_quality_inspection',
        'confirm_delivery',
        'change_customer_rights',
      ],
    };
  }

  private latestDocumentSummaries(documents: RepairDocumentVersion[]) {
    const latest = new Map<string, RepairDocumentVersion>();
    for (const item of documents) {
      if (!latest.has(item.documentType)) latest.set(item.documentType, item);
    }
    return [...latest.values()].map((item) => ({
      type: item.documentType,
      version: item.version,
      status: item.status,
      summaryAvailable: Boolean(item.summary),
    }));
  }

  private async loadProfile(workOrderId: number, manager: EntityManager) {
    await assertQuotedRepairRoot(workOrderId, manager);
    const profile = await manager.getRepository(RepairWorkOrderProfile).findOne({
      where: { workOrderId },
    });
    if (!profile) throw new NotFoundException('汽修工单档案不存在');
    if (prequoteAdmission(profile)) throw new BadRequestException('[repair_prequote_only] 报价前档案不可用于后续业务');
    return profile;
  }

  private async loadProfileForUpdate(workOrderId: number, manager: EntityManager) {
    await assertQuotedRepairRoot(workOrderId, manager);
    const profile = await manager.getRepository(RepairWorkOrderProfile).findOne({
      where: { workOrderId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!profile) throw new NotFoundException('汽修工单档案不存在');
    if (prequoteAdmission(profile)) throw new BadRequestException('[repair_prequote_only] 报价前档案不可用于后续业务');
    return profile;
  }

  private documentProfileView(profile: RepairWorkOrderProfile) {
    if (!prequoteAdmission(profile)) return profile;
    return { ...profile, scopeSnapshotVersion: Object.fromEntries(Object.entries(profile.scopeSnapshotVersion)
      .filter(([key]) => !['prequoteAdmission', 'intakeExecution'].includes(key))) };
  }

  /** Explicit human operational allowlist. Generic finance/procurement/AI loaders stay closed. */
  private async loadIntakeOperationalProfile(workOrderId: number, actor: CurrentUser,
    permission: 'repair.read' | 'repair.supervise' | 'confirmation.request' | 'confirmation.record' | 'qc.inspect',
    stage: 'confirmation' | 'execution', manager: EntityManager) {
    const hint = await manager.getRepository(RepairWorkOrderProfile).findOne({ where: { workOrderId } });
    if (!hint || !prequoteAdmission(hint)) return this.loadProfileForUpdate(workOrderId, manager);
    const { profile } = await this.prequote.boundProfile(workOrderId, actor, manager, permission);
    await assertIntakeExecutionStage(profile, manager, stage);
    return profile;
  }

  private get prequote() {
    return new RepairPrequoteService(this.dataSource, this.scopeService, this.operationLogsService);
  }

  firstVisitPreview(workOrderId: number, dto: QueryRepairFirstVisitDto, actor: CurrentUser) {
    return new RepairFirstVisitService(this.dataSource, this.scopeService, this.operationLogsService).preview(workOrderId, dto, actor);
  }

  reviewFirstVisit(workOrderId: number, dto: ReviewRepairFirstVisitDto, actor: CurrentUser) {
    return new RepairFirstVisitService(this.dataSource, this.scopeService, this.operationLogsService).review(workOrderId, dto, actor);
  }

  prequoteReadiness(workOrderId: number, dto: QueryRepairPrequoteReadinessDto, actor: CurrentUser) {
    return this.prequote.readiness(workOrderId, dto, actor);
  }

  admitPrequote(workOrderId: number, dto: AdmitRepairPrequoteDto, actor: CurrentUser) {
    return this.prequote.admit(workOrderId, dto, actor);
  }

  private async loadDocumentProfile(workOrderId: number, actor: CurrentUser, permission: import('./entities/repair-shop.entities').RepairPermission, manager: EntityManager) {
    const root = await manager.getRepository(WorkOrder).findOne({ where: { id: workOrderId } });
    const hint = await manager.getRepository(RepairWorkOrderProfile).findOne({ where: { workOrderId } });
    if (root && (isWorkOrderUnquoted(root) || (hint && prequoteAdmission(hint)))) {
      return (await this.prequote.documentProfile(workOrderId, actor, manager, permission)).profile;
    }
    return this.loadProfileForUpdate(workOrderId, manager);
  }

  private async assertExactConfirmationVersions(
    workOrderId: number,
    dto: CreateRepairConfirmationRequestDto,
    profile: RepairWorkOrderProfile,
    manager: EntityManager,
  ) {
    if (
      profile.activePlanVersion !== dto.planVersion ||
      profile.activeQuoteVersion !== dto.quoteVersion ||
      profile.activeExplanationVersion !== dto.explanationVersion
    ) {
      throw new BadRequestException('确认请求版本必须与当前方案、报价和客户解释完全一致');
    }
    const documents = await manager.getRepository(RepairDocumentVersion).find({
      where: { workOrderId },
    });
    const has = (type: RepairDocumentType, version: number) =>
      documents.some(
        (item) => item.documentType === type && item.version === version && item.status === 'approved',
      );
    if (
      !has('repair_plan', dto.planVersion) ||
      !has('quote', dto.quoteVersion) ||
      !has('customer_explanation', dto.explanationVersion)
    ) {
      throw new BadRequestException('确认请求引用的版本不存在或已失效');
    }
  }

  private async validateDocumentPayload(
    type: RepairDocumentType,
    payload: Record<string, unknown>,
    profile: RepairWorkOrderProfile,
    manager: EntityManager,
  ) {
    const required: Record<RepairDocumentType, string[]> = {
      intake_inspection: ['customerSymptoms', 'checklist'],
      diagnosis: ['inspectionVersion', 'findings', 'evidence'],
      repair_plan: ['diagnosisVersion', 'items', 'risks'],
      quote: ['planVersion', 'lineItems', 'laborTotal', 'partsTotal', 'otherTotal', 'total'],
      customer_explanation: [
        'planVersion',
        'quoteVersion',
        'quoteTotal',
        'includedLineRefs',
        'explanation',
        'exclusions',
      ],
    };
    const missing = required[type].filter((key) => payload[key] === undefined || payload[key] === null);
    if (missing.length) {
      throw new BadRequestException(`${type} 缺少字段: ${missing.join(', ')}`);
    }

    if (type === 'intake_inspection') {
      this.assertNonEmptyText(payload.customerSymptoms, '接车检查客户诉求');
      this.assertNonEmptyArray(payload.checklist, '接车检查 checklist');
      return;
    }

    if (type === 'diagnosis') {
      this.assertNonEmptyArray(payload.findings, '诊断 findings');
      this.assertNonEmptyArray(payload.evidence, '诊断 evidence');
      const inspection = await this.loadLatestApprovedDocument(
        profile.workOrderId,
        'intake_inspection',
        manager,
      );
      if (!inspection || Number(payload.inspectionVersion) !== inspection.version) {
        throw new BadRequestException('诊断必须绑定最新已审核接车检查版本');
      }
      return;
    }

    if (type === 'repair_plan') {
      this.assertNonEmptyArray(payload.items, '维修方案 items');
      if (!Array.isArray(payload.risks)) {
        throw new BadRequestException('维修方案 risks 必须是数组');
      }
      const diagnosis = await this.loadLatestApprovedDocument(
        profile.workOrderId,
        'diagnosis',
        manager,
      );
      if (!diagnosis || Number(payload.diagnosisVersion) !== diagnosis.version) {
        throw new BadRequestException('维修方案必须绑定最新已审核诊断版本');
      }
      this.readPlanItemRefs(payload);
      return;
    }

    if (type === 'quote') {
      if (Number(payload.planVersion) !== profile.activePlanVersion) {
        throw new BadRequestException('报价必须绑定当前维修方案版本');
      }
      const plan = await this.loadApprovedDocument(
        profile.workOrderId,
        'repair_plan',
        profile.activePlanVersion,
        manager,
      );
      if (!plan) throw new BadRequestException('当前维修方案不存在或未审核');
      this.assertQuoteArithmetic(payload);
      this.assertQuotePlanReferences(payload, plan.payload);
      return;
    }

    if (
      Number(payload.planVersion) !== profile.activePlanVersion ||
      Number(payload.quoteVersion) !== profile.activeQuoteVersion
    ) {
      throw new BadRequestException('客户解释必须绑定当前维修方案和报价版本');
    }
    this.assertNonEmptyText(payload.explanation, '客户解释');
    if (!Array.isArray(payload.exclusions)) {
      throw new BadRequestException('客户解释 exclusions 必须是数组');
    }
    const quote = await this.loadApprovedDocument(
      profile.workOrderId,
      'quote',
      profile.activeQuoteVersion,
      manager,
    );
    if (!quote) throw new BadRequestException('当前报价不存在或未审核');
    if (normalizeMoney(payload.quoteTotal as string | number) !== normalizeMoney(quote.payload.total as string | number)) {
      throw new BadRequestException('客户解释报价总额必须与当前报价版本一致');
    }
    const quoteLineRefs = this.readQuoteLineRefs(quote.payload);
    const includedLineRefs = this.readStringArray(payload.includedLineRefs, '客户解释 includedLineRefs');
    if (
      quoteLineRefs.length !== includedLineRefs.length ||
      quoteLineRefs.some((ref) => !includedLineRefs.includes(ref))
    ) {
      throw new BadRequestException('客户解释必须完整绑定当前报价的全部行项目');
    }
  }

  private async assertEmployee(employeeId: number | undefined, manager: EntityManager) {
    if (!employeeId) return;
    if (!(await manager.getRepository(Employee).findOne({ where: { id: employeeId, status: 1 } }))) {
      throw new NotFoundException('员工不存在或已禁用');
    }
  }

  private async assertTaskBelongs(workOrderId: number, taskId: number, manager: EntityManager, currentRead = false) {
    const task = await manager.getRepository(RepairTask).findOne({ where: { id: taskId, workOrderId },
      ...(currentRead ? { lock: { mode: 'pessimistic_read' as const } } : {}) });
    if (!task) {
      throw new NotFoundException('维修任务不属于该工单');
    }
    return task;
  }

  private async assertQuoteLineReference(
    workOrderId: number,
    profile: RepairWorkOrderProfile,
    quoteLineRef: string,
    expectedCategory: 'labor' | 'part',
    manager: EntityManager,
  ) {
    const quote = await this.loadApprovedDocument(
      workOrderId,
      'quote',
      profile.activeQuoteVersion,
      manager,
      Boolean(prequoteAdmission(profile)),
    );
    if (!quote || quote.status !== 'authorized') {
      throw new BadRequestException('施工工时和配件必须绑定客户已确认的报价版本');
    }
    const lineRef = quoteLineRef.trim();
    const lineItems = Array.isArray(quote.payload.lineItems) ? quote.payload.lineItems : [];
    const line = lineItems.find(
      (item) =>
        item &&
        typeof item === 'object' &&
        String((item as Record<string, unknown>).lineRef ?? '').trim() === lineRef,
    ) as Record<string, unknown> | undefined;
    if (!line || line.category !== expectedCategory) {
      throw new BadRequestException(`报价行 ${lineRef} 不存在或不是 ${expectedCategory} 类型`);
    }
    return line;
  }

  private async loadLatestApprovedDocument(
    workOrderId: number,
    documentType: RepairDocumentType,
    manager: EntityManager,
  ) {
    return manager.getRepository(RepairDocumentVersion).findOne({
      where: { workOrderId, documentType, status: In(['approved', 'authorized']) },
      order: { version: 'DESC' },
    });
  }

  private async loadApprovedDocument(
    workOrderId: number,
    documentType: RepairDocumentType,
    version: number | null,
    manager: EntityManager,
    currentRead = false,
  ) {
    if (!version) return null;
    return manager.getRepository(RepairDocumentVersion).findOne({
      where: {
        workOrderId,
        documentType,
        version,
        status: In(['approved', 'authorized']),
      },
      ...(currentRead ? { lock: { mode: 'pessimistic_read' as const } } : {}),
    });
  }

  private assertNonEmptyText(value: unknown, label: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${label} 不能为空`);
    }
  }

  private assertNonEmptyArray(value: unknown, label: string) {
    if (!Array.isArray(value) || value.length === 0) {
      throw new BadRequestException(`${label} 必须是非空数组`);
    }
  }

  private readStringArray(value: unknown, label: string) {
    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      value.some((item) => typeof item !== 'string' || !item.trim())
    ) {
      throw new BadRequestException(`${label} 必须是非空字符串数组`);
    }
    const refs = value.map((item) => String(item).trim());
    if (new Set(refs).size !== refs.length) {
      throw new BadRequestException(`${label} 不得包含重复引用`);
    }
    return refs;
  }

  private readPlanItemRefs(payload: Record<string, unknown>) {
    this.assertNonEmptyArray(payload.items, '维修方案 items');
    const refs = (payload.items as unknown[]).map((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new BadRequestException(`维修方案第 ${index + 1} 项必须是对象`);
      }
      const record = item as Record<string, unknown>;
      const ref = String(record.itemRef ?? '').trim();
      if (!ref) throw new BadRequestException(`维修方案第 ${index + 1} 项缺少 itemRef`);
      this.assertOpaqueEvidenceRef(ref, `维修方案第 ${index + 1} 项 itemRef`);
      if (typeof record.action !== 'string' || !record.action.trim()) {
        throw new BadRequestException(`维修方案第 ${index + 1} 项缺少明确 action`);
      }
      return ref;
    });
    if (new Set(refs).size !== refs.length) {
      throw new BadRequestException('维修方案 itemRef 不得重复');
    }
    return refs;
  }

  private async loadPendingReworkInspection(workOrderId: number, manager: EntityManager, currentRead = false) {
    const latest = await manager.getRepository(RepairQualityInspection).findOne({
      where: { workOrderId },
      order: { createdAt: 'DESC', id: 'DESC' },
      ...(currentRead ? { lock: { mode: 'pessimistic_read' as const } } : {}),
    });
    return latest?.result === 'failed' ? latest : null;
  }

  private async isExecutionReadyForQuality(
    profile: RepairWorkOrderProfile,
    manager: EntityManager,
  ) {
    const currentRead = Boolean(prequoteAdmission(profile));
    const [plan, quote] = await Promise.all([
      this.loadApprovedDocument(
        profile.workOrderId,
        'repair_plan',
        profile.activePlanVersion,
        manager,
        currentRead,
      ),
      this.loadApprovedDocument(
        profile.workOrderId,
        'quote',
        profile.activeQuoteVersion,
        manager,
        currentRead,
      ),
    ]);
    if (
      !plan ||
      !quote ||
      plan.status !== 'authorized' ||
      quote.status !== 'authorized'
    ) return false;
    const requiredPlanItemRefs = this.readQuotePlanItemRefs(quote.payload, plan.payload);
    if (!requiredPlanItemRefs.length) return false;
    const tasks = await manager.getRepository(RepairTask).find({
      where: {
        workOrderId: profile.workOrderId,
        planVersion: plan.version,
      },
      ...(currentRead ? { lock: { mode: 'pessimistic_read' as const } } : {}),
    });
    const openTasks = tasks.filter(
      (task) => !['completed', 'cancelled'].includes(task.status),
    );
    if (openTasks.length) return false;
    const completedInitialRefs = new Set(
      tasks
        .filter((task) => task.status === 'completed' && task.reworkOfInspectionId === null)
        .map((task) => task.planItemRef),
    );
    if (requiredPlanItemRefs.some((ref) => !completedInitialRefs.has(ref))) return false;

    const pendingRework = await this.loadPendingReworkInspection(profile.workOrderId, manager, currentRead);
    if (!pendingRework) return true;
    const requiredReworkRefs = pendingRework.reworkPlanItemRefs ?? [];
    if (!requiredReworkRefs.length) return false;
    const completedReworkRefs = new Set(
      tasks
        .filter(
          (task) =>
            task.status === 'completed' &&
            task.reworkOfInspectionId === pendingRework.id,
        )
        .map((task) => task.planItemRef),
    );
    return requiredReworkRefs.every((ref) => completedReworkRefs.has(ref));
  }

  private readQuoteLineRefs(payload: Record<string, unknown>) {
    this.assertNonEmptyArray(payload.lineItems, '报价 lineItems');
    const refs = (payload.lineItems as unknown[]).map((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new BadRequestException(`报价第 ${index + 1} 行必须是对象`);
      }
      const ref = String((item as Record<string, unknown>).lineRef ?? '').trim();
      if (!ref) throw new BadRequestException(`报价第 ${index + 1} 行缺少 lineRef`);
      this.assertOpaqueEvidenceRef(ref, `报价第 ${index + 1} 行 lineRef`);
      return ref;
    });
    if (new Set(refs).size !== refs.length) {
      throw new BadRequestException('报价 lineRef 不得重复');
    }
    return refs;
  }

  private readQuotePlanItemRefs(
    quotePayload: Record<string, unknown>,
    planPayload: Record<string, unknown>,
  ) {
    this.assertNonEmptyArray(quotePayload.lineItems, '报价 lineItems');
    const planItemRefs = this.readPlanItemRefs(planPayload);
    const planItemRefSet = new Set(planItemRefs);
    const executionRefs = (quotePayload.lineItems as unknown[])
      .map((item, index) => {
        if (!item || typeof item !== 'object') {
          throw new BadRequestException(`报价第 ${index + 1} 行必须是对象`);
        }
        return String((item as Record<string, unknown>).planItemRef ?? '').trim();
      })
      .filter(Boolean);
    if (executionRefs.some((ref) => !planItemRefSet.has(ref))) {
      throw new BadRequestException('报价执行范围引用了不存在的维修方案项目');
    }
    const quotedPlanItemRefs = new Set(executionRefs);
    const missingPlanItemRefs = planItemRefs.filter((ref) => !quotedPlanItemRefs.has(ref));
    if (missingPlanItemRefs.length) {
      throw new BadRequestException(
        `[plan_quote_mismatch] 报价未覆盖客户确认方案项目: ${missingPlanItemRefs.join(', ')}`,
      );
    }
    return planItemRefs;
  }

  private assertQuotePlanReferences(
    quotePayload: Record<string, unknown>,
    planPayload: Record<string, unknown>,
  ) {
    const planItemRefs = new Set(this.readPlanItemRefs(planPayload));
    for (const [index, item] of (quotePayload.lineItems as unknown[]).entries()) {
      const line = item as Record<string, unknown>;
      const planItemRef = String(line.planItemRef ?? '').trim();
      const approvedFeeBasisRef = String(line.approvedFeeBasisRef ?? '').trim();
      if (planItemRef && !planItemRefs.has(planItemRef)) {
        throw new BadRequestException(`报价第 ${index + 1} 行引用了不存在的方案项目`);
      }
      if (!planItemRef && !approvedFeeBasisRef) {
        throw new BadRequestException(`报价第 ${index + 1} 行缺少方案项目或已批准费用依据`);
      }
    }
    this.readQuotePlanItemRefs(quotePayload, planPayload);
  }

  private invalidateActiveDecisionPackageForDraft(
    profile: RepairWorkOrderProfile,
    documentType: RepairDocumentType,
  ) {
    if (documentType === 'intake_inspection') {
      profile.lifecycleStatus = 'intake_draft';
      profile.activePlanVersion = null;
      profile.activeQuoteVersion = null;
      profile.activeExplanationVersion = null;
      return;
    }
    if (documentType === 'diagnosis') {
      profile.lifecycleStatus = 'intake_checked';
      profile.activePlanVersion = null;
      profile.activeQuoteVersion = null;
      profile.activeExplanationVersion = null;
      return;
    }
    if (documentType === 'repair_plan') {
      profile.lifecycleStatus = 'diagnosed';
      profile.activePlanVersion = null;
      profile.activeQuoteVersion = null;
      profile.activeExplanationVersion = null;
      return;
    }
    if (documentType === 'quote') {
      profile.lifecycleStatus = 'diagnosed';
      profile.activeQuoteVersion = null;
      profile.activeExplanationVersion = null;
      return;
    }
    profile.lifecycleStatus = 'quote_pending_customer';
    profile.activeExplanationVersion = null;
  }

  private async supersedePriorDocumentVersions(
    workOrderId: number,
    documentType: RepairDocumentType,
    approvedDocumentId: number,
    manager: EntityManager,
  ) {
    await manager.getRepository(RepairDocumentVersion).update(
      {
        workOrderId,
        documentType,
        id: Not(approvedDocumentId),
        status: In(['draft', 'review_pending', 'approved']),
      },
      { status: 'superseded' },
    );
  }

  private async supersedeDownstreamDocuments(
    workOrderId: number,
    documentType: RepairDocumentType,
    manager: EntityManager,
  ) {
    const downstream: Record<RepairDocumentType, RepairDocumentType[]> = {
      intake_inspection: ['diagnosis', 'repair_plan', 'quote', 'customer_explanation'],
      diagnosis: ['repair_plan', 'quote', 'customer_explanation'],
      repair_plan: ['quote', 'customer_explanation'],
      quote: ['customer_explanation'],
      customer_explanation: [],
    };
    const types = downstream[documentType];
    if (!types.length) return;
    await manager.getRepository(RepairDocumentVersion).update(
      {
        workOrderId,
        documentType: In(types),
        status: In(['draft', 'review_pending', 'approved']),
      },
      { status: 'superseded' },
    );
  }

  private async invalidateReferencedCases(
    workOrderId: number,
    reason: string,
    currentUser: CurrentUser,
    manager: EntityManager,
  ) {
    const formalDocuments = await manager.getRepository(RepairDocumentVersion).find({
      where: {
        workOrderId,
        documentType: In(['diagnosis', 'repair_plan']),
        status: In(['approved', 'authorized']),
      },
    });
    const referenceIds = [
      ...new Set(
        formalDocuments.flatMap((document) =>
          (document.sourceReferences ?? [])
            .map((reference) => Number(reference.id ?? reference.referenceId))
            .filter((id) => Number.isInteger(id) && id > 0),
        ),
      ),
    ];
    if (!referenceIds.length) return [];
    const repo = manager.getRepository(RepairKnowledgeReference);
    const cases = await repo.find({
      where: { id: In(referenceIds), referenceType: 'case', reviewStatus: 'verified', active: true },
    });
    for (const item of cases) {
      item.reviewStatus = 'review_required';
      item.reviewReason = reason;
      item.reviewedBy = currentUser.id;
      item.version += 1;
    }
    if (cases.length) await repo.save(cases);
    return cases.map((item) => item.id);
  }

  private async invalidateCasesForHigherAuthority(
    authority: RepairKnowledgeReference,
    currentUser: CurrentUser,
    manager: EntityManager,
  ) {
    if (!['regulation', 'manufacturer_manual', 'service_bulletin'].includes(authority.referenceType)) {
      return [];
    }
    const repo = manager.getRepository(RepairKnowledgeReference);
    const cases = (
      await repo.find({
        where: { referenceType: 'case', reviewStatus: 'verified', active: true },
      })
    ).filter((item) =>
      this.applicabilityMightOverlap(authority.applicability, item.applicability),
    );
    for (const item of cases) {
      item.reviewStatus = 'review_required';
      item.reviewReason = `${authority.referenceType} #${authority.id} 已核验，适用范围内案例必须复核`;
      item.reviewedBy = currentUser.id;
      item.version += 1;
    }
    if (cases.length) await repo.save(cases);
    return cases.map((item) => item.id);
  }

  private applicabilityMightOverlap(
    left: Record<string, unknown>,
    right: Record<string, unknown>,
  ) {
    const values = (source: Record<string, unknown>, keys: string[]) => {
      const value = keys.map((key) => source[key]).find((candidate) => candidate !== undefined);
      return (Array.isArray(value) ? value : value === undefined || value === null ? [] : [value])
        .map((item) => String(item).trim().toLowerCase())
        .filter(Boolean);
    };
    for (const keys of [
      ['brand', 'brands'],
      ['model', 'models'],
      ['engineCode', 'engineCodes'],
      ['salesMarket', 'salesMarkets', 'market', 'markets'],
    ]) {
      const leftValues = values(left, keys);
      const rightValues = values(right, keys);
      if (
        leftValues.length &&
        rightValues.length &&
        !leftValues.some((value) => rightValues.includes(value))
      ) {
        return false;
      }
    }

    const range = (source: Record<string, unknown>, fromKeys: string[], toKeys: string[]) => {
      const read = (keys: string[], fallback: number) => {
        const value = keys.map((key) => source[key]).find((candidate) => candidate !== undefined);
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : fallback;
      };
      return [read(fromKeys, Number.NEGATIVE_INFINITY), read(toKeys, Number.POSITIVE_INFINITY)];
    };
    const [leftYearFrom, leftYearTo] = range(
      left,
      ['modelYearFrom', 'yearFrom'],
      ['modelYearTo', 'yearTo'],
    );
    const [rightYearFrom, rightYearTo] = range(
      right,
      ['modelYearFrom', 'yearFrom'],
      ['modelYearTo', 'yearTo'],
    );
    if (leftYearFrom > rightYearTo || rightYearFrom > leftYearTo) return false;

    const leftVinPrefixes = values(left, ['vinPrefix', 'vinPrefixes']);
    const rightVinPrefixes = values(right, ['vinPrefix', 'vinPrefixes']);
    if (
      leftVinPrefixes.length &&
      rightVinPrefixes.length &&
      !leftVinPrefixes.some((leftPrefix) =>
        rightVinPrefixes.some(
          (rightPrefix) =>
            leftPrefix.startsWith(rightPrefix) || rightPrefix.startsWith(leftPrefix),
        ),
      )
    ) {
      return false;
    }
    return true;
  }

  private assertDocumentVersioningOpen(status: RepairWorkOrderProfile['lifecycleStatus']) {
    if (!['intake_draft', 'intake_checked', 'diagnosed', 'quote_pending_customer'].includes(status)) {
      throw new BadRequestException(
        `[change_order_required] 当前状态 ${status} 已锁定客户确认基线；增项需独立变更单流程`,
      );
    }
  }

  private assertExecutionPhase(status: RepairWorkOrderProfile['lifecycleStatus']) {
    if (!['authorized', 'repair_scheduled', 'repairing', 'rework_required'].includes(status)) {
      throw new BadRequestException(
        `[repair_execution_not_allowed] 当前状态 ${status} 不能关联施工工时或配件`,
      );
    }
  }

  private assertQuoteArithmetic(payload: Record<string, unknown>) {
    const normalized = {
      laborTotal: normalizeMoney(payload.laborTotal as string | number),
      partsTotal: normalizeMoney(payload.partsTotal as string | number),
      otherTotal: normalizeMoney(payload.otherTotal as string | number),
      total: normalizeMoney(payload.total as string | number),
    };
    const calculated = addMoney(
      normalized.laborTotal,
      normalized.partsTotal,
      normalized.otherTotal,
    );
    if (calculated !== normalized.total) {
      throw new BadRequestException(`报价合计不一致：分项 ${calculated}，总额 ${normalized.total}`);
    }
    if (!Array.isArray(payload.lineItems)) {
      throw new BadRequestException('报价 lineItems 必须是数组');
    }
    this.readQuoteLineRefs(payload);
    const categoryAmounts: Record<'labor' | 'part' | 'other', Array<string | number>> = {
      labor: [],
      part: [],
      other: [],
    };
    const lineAmounts = payload.lineItems.map((line, index) => {
      if (!line || typeof line !== 'object' || !('amount' in line)) {
        throw new BadRequestException(`报价第 ${index + 1} 行缺少 amount`);
      }
      const record = line as Record<string, unknown>;
      if (!['labor', 'part', 'other'].includes(String(record.category))) {
        throw new BadRequestException(`报价第 ${index + 1} 行 category 必须为 labor/part/other`);
      }
      if (!record.planItemRef && !record.approvedFeeBasisRef) {
        throw new BadRequestException(`报价第 ${index + 1} 行必须引用方案项目或已批准费用依据`);
      }
      const amount = normalizeMoney(record.amount as string | number);
      categoryAmounts[record.category as 'labor' | 'part' | 'other'].push(amount);
      return amount;
    });
    const lineTotal = addMoney(...lineAmounts);
    if (lineTotal !== normalized.total) {
      throw new BadRequestException(`报价明细合计 ${lineTotal} 与总额 ${normalized.total} 不一致`);
    }
    const categoryTotals = {
      labor: addMoney(...categoryAmounts.labor),
      part: addMoney(...categoryAmounts.part),
      other: addMoney(...categoryAmounts.other),
    };
    if (
      categoryTotals.labor !== normalized.laborTotal ||
      categoryTotals.part !== normalized.partsTotal ||
      categoryTotals.other !== normalized.otherTotal
    ) {
      throw new BadRequestException('报价行分类合计与工时、配件或其他费用分项不一致');
    }
  }

  private assertMaskedRecipient(channel: string, value: string) {
    const recipient = value.trim();
    this.assertNoRawSensitiveText(recipient, '客户确认接收方');
    if (['phone', 'wechat', 'sms'].includes(channel) && !/[＊*xX]/.test(recipient)) {
      throw new BadRequestException('电话、微信或短信接收方必须使用明确脱敏值');
    }
  }

  private assertNoRawSensitiveText(value: string, label: string) {
    if (this.hasRawSensitiveText(value)) {
      throw new BadRequestException(`${label} 不得包含完整手机号或 VIN`);
    }
  }

  private assertOpaqueEvidenceRef(value: string, label: string) {
    const normalized = value.trim();
    this.assertNoRawSensitiveText(normalized, label);
    if (
      !/^[A-Za-z0-9][A-Za-z0-9._:/-]{2,254}$/.test(normalized) ||
      normalized.includes('://') ||
      normalized.includes('..') ||
      normalized.includes('//')
    ) {
      throw new BadRequestException(`${label} 必须是无查询参数、无凭据的内部不透明引用`);
    }
  }

  private assertNoSensitiveJson(value: unknown, label: string) {
    if (this.hasRawSensitiveText(this.stableStringify(value))) {
      throw new BadRequestException(`${label} 不得包含完整手机号或 VIN`);
    }
  }

  private hasRawSensitiveText(value: string) {
    return (
      /(?<!\d)1\d{10}(?!\d)/.test(value) ||
      /\b[A-HJ-NPR-Z0-9]{17}\b/i.test(value) ||
      /(?<!\d)\d{12,19}(?!\d)/.test(value) ||
      /\b(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{10,}\b/i.test(value) ||
      /\bBearer\s+[A-Za-z0-9._~+/-]{10,}={0,2}\b/i.test(value) ||
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/i.test(value)
    );
  }

  private redactSensitiveJson(
    value: unknown,
    sensitiveTokens: Array<string | null | undefined> = [],
  ): Record<string, unknown> {
    const redact = (item: unknown): unknown => {
      if (typeof item === 'string') return this.redactExternalText(item, sensitiveTokens);
      if (Array.isArray(item)) return item.map(redact);
      if (item && typeof item === 'object') {
        return Object.fromEntries(
          Object.entries(item as Record<string, unknown>).map(([key, child]) => [
            key,
            this.isSensitiveContextKey(key) ? '[REDACTED]' : redact(child),
          ]),
        );
      }
      return item;
    };
    return redact(value) as Record<string, unknown>;
  }

  private fingerprint(value: unknown) {
    return createHash('sha256').update(this.stableStringify(value)).digest('hex');
  }

  private isDuplicateKeyError(error: unknown, constraintName: string) {
    const candidate = error as {
      code?: string;
      errno?: number;
      message?: string;
      driverError?: { code?: string; errno?: number; message?: string; sqlMessage?: string };
    };
    const driverError = (candidate?.driverError ?? candidate) as {
      code?: string;
      errno?: number;
      message?: string;
      sqlMessage?: string;
    };
    const message = [driverError.message, driverError.sqlMessage, candidate?.message]
      .filter(Boolean)
      .join(' ');
    return (
      (driverError.code === 'ER_DUP_ENTRY' || driverError.errno === 1062) &&
      message.includes(constraintName)
    );
  }

  private toSafeAiDraftProjection(draft: RepairAiDraft) {
    const outputSuppressed = !this.isAiDraftOutputReturnable(draft.status);
    return {
      id: draft.id,
      draftType: draft.draftType,
      outputSnapshot: outputSuppressed ? null : draft.outputSnapshot,
      outputSuppressed,
      knowledgeReferenceIds: draft.knowledgeReferenceIds,
      status: draft.status,
      requiresHumanReview: draft.requiresHumanReview,
      createdAt: draft.createdAt,
    };
  }

  private isAiDraftOutputReturnable(status: RepairAiDraft['status']) {
    return status === 'draft';
  }

  private aiDraftReplayBlockerCode(status: RepairAiDraft['status']) {
    if (status === 'stale') return 'stale_draft';
    if (status === 'superseded') return 'superseded_draft';
    return 'draft_not_active';
  }

  private assertDeliveryTimeline(
    deliveredAt: Date,
    latestPassedQualityAt: Date | null | undefined,
    confirmedAt: Date | null | undefined,
  ) {
    if (Number.isNaN(deliveredAt.getTime())) {
      throw new BadRequestException('交车时间格式无效');
    }
    if (deliveredAt.getTime() > Date.now() + 5 * 60 * 1000) {
      throw new BadRequestException('交车时间不能晚于当前时间');
    }
    if (
      !latestPassedQualityAt ||
      !confirmedAt ||
      deliveredAt < latestPassedQualityAt ||
      deliveredAt < confirmedAt
    ) {
      throw new BadRequestException('交车时间不得早于当前客户确认和最近一次通过质检');
    }
  }

  private async markOpenAiDraftsStale(workOrderId: number, manager: EntityManager) {
    const result = await manager.getRepository(RepairAiDraft).update(
      { workOrderId, status: 'draft' },
      { status: 'stale' },
    );
    return result.affected ?? 0;
  }

  private async markVehicleAiDraftsStale(vehicleId: number, manager: EntityManager) {
    const profiles = await manager.getRepository(RepairWorkOrderProfile).find({
      where: { vehicleId },
    });
    if (!profiles.length) return 0;
    const result = await manager.getRepository(RepairAiDraft).update(
      { workOrderId: In(profiles.map((profile) => profile.workOrderId)), status: 'draft' },
      { status: 'stale' },
    );
    return result.affected ?? 0;
  }

  private async markAllOpenAiDraftsStale(manager: EntityManager) {
    const result = await manager.getRepository(RepairAiDraft).update(
      { status: 'draft' },
      { status: 'stale' },
    );
    return result.affected ?? 0;
  }

  private async advanceKnowledgeCatalogVersions(manager: EntityManager) {
    // Keep one lock order: work-order profile first, then knowledge rows. AI creation
    // uses the same order, so a knowledge change cannot finish between snapshot and insert.
    const result = await manager
      .createQueryBuilder()
      .update(RepairWorkOrderProfile)
      .set({ knowledgeCatalogVersion: () => 'knowledge_catalog_version + 1' })
      .execute();
    return result.affected ?? 0;
  }

  private async loadVerifiedKnowledgeForAi(manager: EntityManager) {
    return manager
      .getRepository(RepairKnowledgeReference)
      .createQueryBuilder('knowledge')
      .setLock('pessimistic_read')
      .where('knowledge.active = :active', { active: true })
      .andWhere('knowledge.review_status = :reviewStatus', { reviewStatus: 'verified' })
      .orderBy('knowledge.authority_rank', 'DESC')
      .addOrderBy('knowledge.id', 'ASC')
      .take(200)
      .getMany();
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${this.stableStringify(item)}`);
    return `{${entries.join(',')}}`;
  }

  private newAssistantContext(
    capability: string,
    requestedEffectClass: AssistantCallContext['requestedEffectClass'],
  ): AssistantCallContext {
    const requestId = `req_${randomUUID()}`;
    return {
      requestId,
      correlationId: requestId,
      capability,
      requestedEffectClass,
    };
  }

  private assertAssistantActor(currentUser: CurrentUser) {
    if (currentUser.identitySource !== 'trusted_proxy') {
      throw new ForbiddenException(
        '[formal_actor_required] 助手能力必须由受信任代理绑定正式员工身份',
      );
    }
    if (
      !currentUser.roleCodes.includes('admin') &&
      !currentUser.roleCodes.includes('operator')
    ) {
      throw new ForbiddenException('[permission_denied] 当前正式员工角色不能调用助手能力');
    }
  }

  private async executeAssistantRead<T>(
    workOrderId: number,
    currentUser: CurrentUser,
    context: AssistantCallContext,
    read: () => Promise<T>,
    allowedNextCapabilities: string[],
  ) {
    let safeSummary: T;
    try {
      safeSummary = await read();
    } catch (error) {
      return this.assistantBlockedEnvelope(workOrderId, currentUser, context, error);
    }

    let auditId: number;
    try {
      const audit = await this.audit(
        'repair_assistant_gateway',
        workOrderId,
        'assistant_allowed',
        currentUser,
        {
          ...this.assistantAuditDetail(context, 'allowed', false),
          safeSummaryFingerprint: this.fingerprint(safeSummary),
        },
      );
      auditId = audit.id;
    } catch {
      throw new ServiceUnavailableException(
        '[audit_persistence_failed] 助手查询审计未能保存，安全结果不予返回',
      );
    }

    return this.assistantEnvelope(context, 'allowed', 'read_only', auditId, {
      safeSummary,
      allowedNextCapabilities,
    });
  }

  private assistantEnvelope(
    context: AssistantCallContext,
    decision: 'allowed' | 'human_confirmation_required' | 'blocked',
    effectClass: AssistantEffectClass,
    auditId: number,
    options: {
      artifact?: Record<string, unknown> | null;
      safeSummary: unknown;
      allowedNextCapabilities: string[];
      blockerCodes?: string[];
      draftArtifactWriteCounter?: number;
      confirmationRequestWriteCounter?: number;
    },
  ) {
    return {
      contractVersion: 'repair_assistant_v1',
      requestId: context.requestId,
      correlationId: context.correlationId,
      capability: context.capability,
      decision,
      effectClass,
      artifact: options.artifact ?? null,
      safeSummary: options.safeSummary,
      allowedNextCapabilities: options.allowedNextCapabilities,
      blockerCodes: options.blockerCodes ?? [],
      auditRef: `operation-log:${auditId}`,
      effects: {
        safeQueryDatabaseWriteCounter: 0,
        draftArtifactWriteCounter: options.draftArtifactWriteCounter ?? 0,
        confirmationRequestWriteCounter: options.confirmationRequestWriteCounter ?? 0,
        protectedBusinessWriteCounter: 0,
        auditAppendCounter: 1,
      },
      redaction: {
        level: 'external_redacted',
        fullPhoneIncluded: false,
        fullVinIncluded: false,
        rawPaymentPayloadIncluded: false,
      },
    };
  }

  private async assistantBlockedEnvelope(
    workOrderId: number,
    currentUser: CurrentUser,
    context: AssistantCallContext,
    error: unknown,
  ) {
    if (
      error instanceof ServiceUnavailableException &&
      this.httpExceptionMessage(error).includes('audit_persistence_failed')
    ) {
      throw error;
    }
    const blockerCode = this.assistantBlockerCode(error);
    let auditId: number;
    try {
      const audit = await this.audit(
        'repair_assistant_gateway',
        workOrderId,
        'assistant_blocked',
        currentUser,
        {
          ...this.assistantAuditDetail(context, 'blocked', false, 'no_effect'),
          blockerCodes: [blockerCode],
        },
      );
      auditId = audit.id;
    } catch {
      throw new ServiceUnavailableException(
        '[audit_persistence_failed] 助手阻断结果审计未能保存，结果不予返回',
      );
    }

    return this.assistantEnvelope(context, 'blocked', 'no_effect', auditId, {
      safeSummary: null,
      allowedNextCapabilities: [],
      blockerCodes: [blockerCode],
    });
  }

  private assistantAuditDetail(
    context: AssistantCallContext,
    decision: 'allowed' | 'human_confirmation_required' | 'blocked',
    artifactWritten: boolean,
    effectClass: AssistantEffectClass = context.requestedEffectClass,
  ) {
    return {
      requestId: context.requestId,
      correlationId: context.correlationId,
      capability: context.capability,
      subjectMode: 'staff_delegation',
      decision,
      effectClass,
      redactionLevel: 'external_redacted',
      effects: {
        safeQueryDatabaseWriteCounter: 0,
        draftArtifactWriteCounter:
          artifactWritten && effectClass === 'draft_only' ? 1 : 0,
        confirmationRequestWriteCounter:
          artifactWritten && effectClass === 'confirmation_request_only' ? 1 : 0,
        protectedBusinessWriteCounter: 0,
        auditAppendCounter: 1,
      },
    };
  }

  private assistantBlockerCode(error: unknown) {
    const message = error instanceof HttpException ? this.httpExceptionMessage(error) : '';
    if (message.includes('formal_actor_required')) return 'formal_actor_required';
    if (message.includes('permission_denied')) return 'permission_denied';
    if (error instanceof ForbiddenException || error instanceof NotFoundException) {
      return 'not_found_or_out_of_scope';
    }
    if (error instanceof ConflictException) {
      return message.includes('幂等') ? 'idempotency_conflict' : 'version_conflict';
    }
    if (error instanceof BadRequestException) {
      if (message.includes('version_conflict')) return 'version_conflict';
      if (message.includes('plan_quote_mismatch')) return 'plan_quote_mismatch';
      if (message.includes('customer_explanation_stale')) return 'customer_explanation_stale';
      return 'precondition_failed';
    }
    return 'safe_response_unavailable';
  }

  private httpExceptionMessage(error: HttpException) {
    const response = error.getResponse();
    if (typeof response === 'string') return response;
    if (response && typeof response === 'object' && 'message' in response) {
      const message = (response as { message?: string | string[] }).message;
      return Array.isArray(message) ? message.join(' ') : message ?? '';
    }
    return error.message;
  }

  private async auditAssistantAware(
    module: string,
    targetId: number,
    action: string,
    currentUser: CurrentUser,
    detailJson: Record<string, unknown>,
    manager: EntityManager,
    assistantContext?: AssistantCallContext,
  ) {
    try {
      return await this.audit(module, targetId, action, currentUser, detailJson, manager);
    } catch (error) {
      if (!assistantContext) throw error;
      throw new ServiceUnavailableException(
        '[audit_persistence_failed] 助手制品审计未能保存，制品已回滚',
      );
    }
  }

  private async audit(
    module: string,
    targetId: number,
    action: string,
    currentUser: CurrentUser,
    detailJson: Record<string, unknown>,
    manager?: EntityManager,
  ) {
    return this.operationLogsService.create(
      {
        module,
        targetId,
        action,
        operatorId: currentUser.id,
        detail: `${module}:${action}`,
        detailJson,
      },
      manager,
    );
  }

  private scopeFrom(value: {
    companyRef: string;
    businessSectorRef: string;
    storeRef: string;
    customerRef: string;
  }): RepairResourceScope {
    return {
      companyRef: value.companyRef.trim(),
      businessSectorRef: value.businessSectorRef.trim(),
      storeRef: value.storeRef.trim(),
      customerRef: value.customerRef.trim(),
    };
  }

  private async assertLegacyWorkOrderScopeMapping(
    workOrder: WorkOrder,
    vehicleCustomerLink: RepairVehicleCustomerLink,
    scope: RepairResourceScope,
    evidenceRef: string,
    manager: EntityManager,
  ) {
    this.assertOpaqueEvidenceRef(evidenceRef, '历史工单作用域审核凭证');
    const customer = await manager.getRepository(CustomerMasterRecord).findOne({
      where: { customerRef: scope.customerRef, status: 'active' },
    });
    if (!customer?.legacyIdentificationBindingId) {
      throw new BadRequestException(
        '[scope_resolution_pending] 共享客户主档缺少已审核的来源识别绑定',
      );
    }
    const binding = await manager.getRepository(CustomerIdentificationBinding).findOne({
      where: { id: customer.legacyIdentificationBindingId },
    });
    if (
      !binding ||
      binding.bindingStatus !== 'manually_bound' ||
      !binding.boundBy ||
      !binding.boundAt ||
      !binding.matchedCustomerId?.trim()
    ) {
      throw new BadRequestException(
        '[scope_resolution_pending] 客户来源识别绑定未完成正式人工审核',
      );
    }
    const workOrderMobile = this.normalizeMobileForScopeMapping(workOrder.customerMobile);
    const bindingMobiles = [binding.matchedCustomerMobile, binding.sourceCustomerMobile]
      .map((value) => this.normalizeMobileForScopeMapping(value))
      .filter(Boolean);
    if (!workOrderMobile || !bindingMobiles.includes(workOrderMobile)) {
      throw new BadRequestException(
        '[scope_resolution_pending] 历史工单与共享客户主档之间没有可证明的客户映射',
      );
    }
    if (
      vehicleCustomerLink.customerRef !== customer.customerRef ||
      vehicleCustomerLink.status !== 'active' ||
      vehicleCustomerLink.confirmationStatus !== 'confirmed'
    ) {
      throw new BadRequestException(
        '[scope_resolution_pending] 车辆档案不属于已验证的共享客户主档',
      );
    }
    return binding.id;
  }

  private normalizeMobileForScopeMapping(value: string | null | undefined) {
    const digits = value?.replace(/\D/g, '') ?? '';
    if (/^861\d{10}$/.test(digits)) return digits.slice(2);
    return digits;
  }

  private assertVehicleOrganizationScope(
    vehicle: RepairVehicleProfile,
    scope: RepairResourceScope,
  ) {
    if (
      vehicle.companyRef !== scope.companyRef ||
      vehicle.businessSectorRef !== scope.businessSectorRef
    ) {
      throw new BadRequestException('车辆档案与公司或业务板块范围不一致');
    }
  }

  private async loadConfirmedVehicleCustomerLink(
    vehicleId: number,
    scope: RepairResourceScope,
    manager: EntityManager,
  ) {
    const link = await manager.getRepository(RepairVehicleCustomerLink).findOne({
      where: {
        vehicleId,
        companyRef: scope.companyRef,
        businessSectorRef: scope.businessSectorRef,
        customerRef: scope.customerRef,
        confirmationStatus: 'confirmed',
        status: 'active',
      },
      order: { validFrom: 'DESC', id: 'DESC' },
    });
    if (!link || link.validUntil) {
      throw new BadRequestException(
        '[scope_resolution_pending] 车辆与共享客户主档缺少当前有效的已确认关系',
      );
    }
    return link;
  }

  private async assertVehicleManageAccess(
    vehicle: RepairVehicleProfile,
    currentUser: CurrentUser,
    manager: EntityManager,
  ) {
    const links = await manager.getRepository(RepairVehicleCustomerLink).find({
      where: {
        vehicleId: vehicle.id,
        confirmationStatus: 'confirmed',
        status: 'active',
      },
      order: { validFrom: 'DESC' },
    });
    for (const link of links.filter((item) => !item.validUntil)) {
      try {
        return await this.scopeService.assertAccess(
          currentUser,
          this.scopeFrom(link),
          'vehicle.manage',
          manager,
        );
      } catch (error) {
        if (!(error instanceof ForbiddenException)) throw error;
      }
    }
    throw new ForbiddenException('[business_scope_denied] 无权管理该车辆的任何当前客户关系');
  }

  private redactSensitiveText(value: string) {
    return value
      .replace(/(?<!\d)1\d{10}(?!\d)/g, '[手机号已脱敏]')
      .replace(/\b[A-HJ-NPR-Z0-9]{17}\b/gi, '[VIN已脱敏]')
      .replace(/(?<!\d)\d{12,19}(?!\d)/g, '[账号已脱敏]')
      .replace(/\b(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{10,}\b/gi, '[密钥已脱敏]')
      .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{10,}={0,2}\b/gi, '[令牌已脱敏]')
      .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi, '[私钥已脱敏]');
  }

  private redactExternalText(
    value: string,
    sensitiveTokens: Array<string | null | undefined> = [],
  ) {
    let redacted = this.redactSensitiveText(value);
    for (const token of sensitiveTokens) {
      const normalized = token?.trim();
      if (!normalized) continue;
      redacted = redacted.split(normalized).join('[身份标识已脱敏]');
    }
    return redacted
      .replace(
        /[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼][A-Z][A-Z0-9]{5,6}/gi,
        '[车牌已脱敏]',
      )
      .replace(
        /[\u4e00-\u9fa5A-Za-z0-9-]{2,40}(?:省|自治区|市|区|县|镇|乡|街道|路|街|巷|小区|号楼|栋|单元|室)[\u4e00-\u9fa5A-Za-z0-9-]{0,30}/g,
        '[地址已脱敏]',
      );
  }

  private isSensitiveContextKey(key: string) {
    const normalized = key
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .toLowerCase();
    return /(?:^|_)(phone|mobile|address|location|name|customer|recipient|plate|license_plate|vin|bank|account|card|sms|token|secret|password|credential|private_key|certificate|payment|receipt|raw_payload)(?:_|$)/.test(
      normalized,
    );
  }

  private normalizeVin(value: string | undefined) {
    const normalized = value?.trim().toUpperCase() ?? '';
    if (!normalized) return null;
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(normalized)) {
      throw new BadRequestException('VIN 必须是 17 位且不能包含 I、O、Q');
    }
    return normalized;
  }

  private normalizePlate(value: string) {
    return value.trim().replace(/\s+/g, '').toUpperCase();
  }

  private maskPlate(value: string) {
    const normalized = value.trim();
    return normalized.length <= 3
      ? `${normalized.slice(0, 1)}**`
      : `${normalized.slice(0, 2)}***${normalized.slice(-1)}`;
  }

  private isCollectionOrderConfirmed(collectionOrder: FinanceCollectionOrder) {
    return isCollectionOrderStrictlyConfirmed(collectionOrder);
  }

  private countByStatus(items: Array<{ status: string }>) {
    return items.reduce<Record<string, number>>((result, item) => {
      result[item.status] = (result[item.status] ?? 0) + 1;
      return result;
    }, {});
  }
}
