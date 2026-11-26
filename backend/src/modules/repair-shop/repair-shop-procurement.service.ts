import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { DataSource, EntityManager, In, IsNull, Not, QueryFailedError, Repository } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { ApprovalType } from '../../shared/enums/approval-type.enum';
import {
  addMoney,
  addQuantity,
  compareMoney,
  compareQuantity,
  multiplyMoney,
  normalizeMoney,
  normalizeQuantity,
} from '../../common/utils/decimal.util';
import { ApprovalPaymentIntent } from '../approval-requests/entities/approval-payment-intent.entity';
import { ApprovalRequest } from '../approval-requests/entities/approval-request.entity';
import { createPendingApprovalRequestWithResult } from '../approval-requests/approval-request-pending.factory';
import { BusinessCompanyRef } from '../business-foundation/entities/business-foundation.entities';
import { FinanceCollectionOrder } from '../finance-reconciliation/entities/finance-collection-order.entity';
import { InventoryTransaction } from '../inventory-transactions/entities/inventory-transaction.entity';
import { MaterialStock } from '../material-stocks/entities/material-stock.entity';
import { Material } from '../materials/entities/material.entity';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { WorkOrderMaterial } from '../work-order-materials/entities/work-order-material.entity';
import { SequenceService } from '../sequence/sequence.service';
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
import {
  RepairGoodsReceipt,
  RepairPartFitmentEvidence,
  RepairProcurementAllocation,
  RepairProcurementDecision,
  RepairProcurementDemand,
  RepairPurchaseOrder,
  RepairSupplierInquiry,
  RepairSupplierQuote,
  RepairSupplierShipment,
  RepairSupplierWarrantyClaim,
  RepairVehicleIdentityEvidence,
} from './entities/repair-shop-procurement.entities';
import {
  RepairConfirmationRequest,
  RepairDocumentVersion,
  RepairPartLink,
  RepairPermission,
  RepairTask,
  RepairVehicleCustomerLink,
  RepairVehicleProfile,
  RepairWarrantyRecord,
  RepairWorkOrderProfile,
} from './entities/repair-shop.entities';
import {
  assertVinFormat,
  addQuantityWithinLimit,
  assertRepairProcurementDemandStillMutable,
  assertRepairProcurementDocumentBinding,
  assertSafeRepairEvidenceRef,
  assertSafeRepairEvidenceSnapshot,
  buildRepairProcurementLeaderApprovalBinding,
  buildPriceReasonablenessSnapshot,
  evaluateFormalStockInventoryTransaction,
  evaluateRepairProcurementPaymentIntentReadiness,
  evaluateVinChecksum,
  isQuantityCovered,
  projectPaymentState,
} from './repair-shop-procurement.policy';
import { maskVin } from './repair-shop-workflow.policy';
import { RepairResourceScope, RepairShopScopeService } from './repair-shop-scope.service';
import { assertQuotedRepairRoot, prequoteAdmission } from './repair-prequote.policy';
import { buildRepairMaterialSourceReadback, repairCollectionReadback, repairPurchasePaymentReadback } from './repair-material-source-readback';

@Injectable()
export class RepairShopProcurementService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly operationLogsService: OperationLogsService,
    private readonly scopeService: RepairShopScopeService,
    private readonly sequenceService: SequenceService,
  ) {}

  async getWorkspace(workOrderId: number, currentUser: CurrentUser) {
    return this.dataSource.transaction(async (manager) => {
      const profile = await this.loadProfile(workOrderId, manager);
      const scope = this.scopeOf(profile);
      await this.scopeService.assertAccess(currentUser, scope, 'repair.read', manager);
      const canManageVehicle = await this.hasScopedAccess(currentUser, scope, 'vehicle.manage', manager);
      const canManageProcurement = await this.hasScopedAccess(currentUser, scope, 'quote.manage', manager);
      const canViewFullVin = canManageVehicle || canManageProcurement;
      const vehicle = await manager.getRepository(RepairVehicleProfile).findOne({
        where: { id: profile.vehicleId },
      });
      if (!vehicle) throw new NotFoundException('车辆档案不存在');
      const companyBinding = await manager.getRepository(BusinessCompanyRef).findOne({
        where: { companyRef: profile.companyRef, status: 'active' },
      });

      const [identityEvidence, fitmentEvidence, demands, inquiries, quotes, decisions, orders,
        shipments, receipts, allocations, warrantyClaims] = await Promise.all([
        manager.getRepository(RepairVehicleIdentityEvidence).find({
          where: { vehicleId: profile.vehicleId }, order: { createdAt: 'DESC' },
        }),
        manager.getRepository(RepairPartFitmentEvidence).find({
          where: { workOrderId }, order: { createdAt: 'DESC' },
        }),
        manager.getRepository(RepairProcurementDemand).find({
          where: { workOrderId }, order: { createdAt: 'DESC' },
        }),
        manager.getRepository(RepairSupplierInquiry).find({
          where: { workOrderId }, order: { createdAt: 'DESC' },
        }),
        manager.getRepository(RepairSupplierQuote).find({
          where: { workOrderId }, order: { createdAt: 'DESC' },
        }),
        manager.getRepository(RepairProcurementDecision).find({
          where: { workOrderId }, order: { createdAt: 'DESC' },
        }),
        manager.getRepository(RepairPurchaseOrder).find({
          where: { workOrderId }, order: { createdAt: 'DESC' },
        }),
        manager.getRepository(RepairSupplierShipment).find({
          where: { workOrderId }, order: { createdAt: 'DESC' },
        }),
        manager.getRepository(RepairGoodsReceipt).find({
          where: { workOrderId }, order: { createdAt: 'DESC' },
        }),
        manager.getRepository(RepairProcurementAllocation).find({
          where: { workOrderId }, order: { createdAt: 'DESC' },
        }),
        manager.getRepository(RepairSupplierWarrantyClaim).find({
          where: { workOrderId }, order: { createdAt: 'DESC' },
        }),
      ]);
      const intentIds = orders
        .map((order) => order.paymentIntentId)
        .filter((id): id is number => Number.isInteger(id));
      const intents = intentIds.length
        ? await manager.getRepository(ApprovalPaymentIntent).find({ where: { id: In(intentIds) } })
        : [];
      const intentById = new Map(intents.map((intent) => [intent.id, intent]));
      const [collectionOrders, activeQuote] = await Promise.all([
        manager.getRepository(FinanceCollectionOrder).find({
          where: { workOrderId, sourceType: 'work_order', businessType: 'maintenance' },
        }),
        profile.activeQuoteVersion
          ? manager.getRepository(RepairDocumentVersion).findOne({
              where: {
                workOrderId,
                documentType: 'quote',
                version: profile.activeQuoteVersion,
                status: 'authorized',
              },
            })
          : Promise.resolve(null),
      ]);
      const collectionReadback = repairCollectionReadback(workOrderId, collectionOrders, activeQuote?.payload.total);
      const workOrderMaterials = canManageProcurement
        ? await manager.getRepository(WorkOrderMaterial).find({
            where: { workOrderId, deletedAt: IsNull() }, relations: { material: true }, order: { id: 'ASC' },
          }) : [];
      const projectedOrders = canManageProcurement ? orders.map((order) => {
        const intent = order.paymentIntentId ? intentById.get(order.paymentIntentId) : undefined;
        const scopeConsistent = order.companyRef === profile.companyRef && order.businessSectorRef === profile.businessSectorRef &&
          order.storeRef === profile.storeRef && order.customerRef === profile.customerRef;
        const bindingConsistent = scopeConsistent && Boolean(intent &&
          this.paymentIntentMatchesOrder(intent, order, companyBinding?.companyRegistryId ?? null));
        const paymentReadback = repairPurchasePaymentReadback(order, intent, bindingConsistent);
        return {
          ...order,
          paymentState: paymentReadback.state,
          paymentReadback,
          paymentEvidenceBoundary: intent && bindingConsistent ? {
            intentStatus: intent.intentStatus, reconciliationStatus: intent.reconciliationStatus,
            confirmedLinkStatus: intent.confirmedLinkStatus, evidenceRef: intent.redactedEvidenceRef, bindingConsistent,
          } : null,
        };
      }) : [];
      const scopedSourceOrders = projectedOrders.filter((order) => order.companyRef === profile.companyRef &&
        order.businessSectorRef === profile.businessSectorRef && order.storeRef === profile.storeRef && order.customerRef === profile.customerRef);

      return {
        workOrderId,
        lifecycleStatus: profile.lifecycleStatus,
        vehicle: {
          id: vehicle.id,
          plateNumber: vehicle.plateNumber,
          vin: canViewFullVin ? vehicle.vin : maskVin(vehicle.vin),
          vinMasked: maskVin(vehicle.vin),
          vinAccess: canViewFullVin ? 'full' : 'masked',
          brand: vehicle.brand,
          model: vehicle.model,
          modelYear: vehicle.modelYear,
          engineCode: vehicle.engineCode,
          salesMarket: vehicle.salesMarket,
        },
        identityEvidence: canViewFullVin ? identityEvidence : [],
        fitmentEvidence: canManageProcurement ? fitmentEvidence : [],
        demands: canManageProcurement ? demands : demands.map((item) => ({
          id: item.id,
          partName: item.partName,
          quantity: item.quantity,
          unit: item.unit,
          fulfillmentMode: item.fulfillmentMode,
          status: item.status,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
        inquiries: canManageProcurement ? inquiries : [],
        quotes: canManageProcurement ? quotes : [],
        decisions: canManageProcurement ? decisions : [],
        materialSourceReadback: canManageProcurement ? buildRepairMaterialSourceReadback({
          workOrderId, materials: workOrderMaterials, demands, orders: scopedSourceOrders, receipts, allocations,
        }) : [],
        purchaseOrders: canManageProcurement ? scopedSourceOrders : orders.map((order) => ({
          id: order.id,
          orderNo: order.orderNo,
          status: order.status,
          paymentState: 'restricted',
          expectedArrivalAt: order.expectedArrivalAt,
          updatedAt: order.updatedAt,
        })),
        shipments: canManageProcurement ? shipments : shipments.map((item) => ({
          id: item.id,
          purchaseOrderId: item.purchaseOrderId,
          status: item.status,
          shippedAt: item.shippedAt,
          expectedAt: item.expectedAt,
          deliveredAt: item.deliveredAt,
        })),
        receipts: canManageProcurement ? receipts : receipts.map((item) => ({
          id: item.id,
          purchaseOrderId: item.purchaseOrderId,
          shipmentId: item.shipmentId,
          receiptMode: item.receiptMode,
          status: item.status,
          receivedAt: item.receivedAt,
        })),
        allocations: canManageProcurement ? allocations : allocations.map((item) => ({
          id: item.id,
          demandId: item.demandId,
          quantity: item.quantity,
          status: item.status,
          installedAt: item.installedAt,
        })),
        warrantyClaims: canManageProcurement ? warrantyClaims : warrantyClaims.map((item) => ({
          id: item.id,
          status: item.status,
          createdAt: item.createdAt,
        })),
        customerCollectionReadiness: {
          ready: collectionReadback.ready,
          confirmedAmount: canManageProcurement ? collectionReadback.confirmedAmount : null,
          requiredQuoteTotal: canManageProcurement ? collectionReadback.requiredQuoteTotal : null,
          evidenceCount: canManageProcurement ? collectionReadback.evidenceCount : null,
          evidenceRefs: canManageProcurement ? collectionReadback.evidenceRefs : [],
          issues: canManageProcurement ? collectionReadback.issues : [],
          distributionAllowed: false,
          source: 'finance_collection_order',
          bankEvidenceAuthority: 'finance_reconciliation',
          readOnly: true,
        },
        fieldAccess: {
          baseRepairRead: true,
          vehicleIdentityFull: canViewFullVin,
          procurementManage: canManageProcurement,
          procurementFinancialFull: canManageProcurement,
          restrictedFieldsFailClosed: true,
        },
        authorityBoundary: {
          authoritativeModules: {
            material: 'materials',
            supplier: 'suppliers',
            inventory: 'material_stocks/inventory_transactions/work_order_materials',
            approval: 'approval_requests',
            paymentAndBankEvidence: 'approval_payment_intent/finance_reconciliation',
          },
          procurementMay: [
            'capture_vin_evidence',
            'record_fitment_evidence',
            'draft_inquiry',
            'record_quote',
            'compare_price',
            'bind_existing_authority_records',
          ],
          procurementMayNot: [
            'create_parallel_material_or_supplier_master',
            'mutate_inventory',
            'approve_payment',
            'confirm_bank_evidence',
            'contact_supplier_automatically',
          ],
        },
      };
    });
  }

  async createVehicleIdentityEvidence(
    vehicleId: number,
    dto: CreateRepairVehicleIdentityEvidenceDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const { vehicle, scope } = await this.loadVehicleScope(vehicleId, currentUser, manager);
      const vin = assertVinFormat(dto.vinCandidate);
      const fingerprint = this.fingerprint({ vehicleId, ...dto, vinCandidate: vin });
      const repo = manager.getRepository(RepairVehicleIdentityEvidence);
      const replay = await this.assertIdempotentReplay(
        repo,
        dto.requestIdempotencyKey,
        fingerprint,
      );
      if (replay) return replay;
      this.assertOpaqueRef(dto.evidenceRef, 'VIN 证据');
      this.assertSafeEvidenceSnapshot(dto.decodeSnapshot, 'VIN 解码快照');
      const evidenceSave = await this.saveIdempotent(repo, repo.create({
        vehicleId,
        companyRef: vehicle.companyRef,
        businessSectorRef: scope.businessSectorRef,
        storeRef: scope.storeRef,
        customerRef: scope.customerRef,
        evidenceType: dto.evidenceType,
        providerCode: dto.providerCode.trim(),
        providerVersion: dto.providerVersion?.trim() || null,
        evidenceRef: dto.evidenceRef.trim(),
        imageSha256: dto.imageSha256?.toLowerCase() || null,
        vinCandidate: vin,
        checksumStatus: evaluateVinChecksum(vin),
        confidence: dto.confidence.toFixed(2),
        decodeSnapshot: dto.decodeSnapshot ?? null,
        requestIdempotencyKey: dto.requestIdempotencyKey,
        requestFingerprint: fingerprint,
        reviewStatus: 'review_pending',
        reviewNote: null,
        createdBy: currentUser.id,
        reviewedBy: null,
        reviewedAt: null,
        version: 1,
      }), dto.requestIdempotencyKey, fingerprint);
      if (!evidenceSave.created) return evidenceSave.entity;
      const evidence = evidenceSave.entity;
      await this.audit(manager, currentUser, evidence.id, 'vin_evidence_created', {
        vehicleId,
        evidenceType: evidence.evidenceType,
        checksumStatus: evidence.checksumStatus,
        effect: 'review_pending_only',
      });
      return evidence;
    });
  }

  async reviewVehicleIdentityEvidence(
    vehicleId: number,
    evidenceId: number,
    dto: ReviewRepairEvidenceDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const { vehicle } = await this.loadVehicleScope(vehicleId, currentUser, manager, true);
      const repo = manager.getRepository(RepairVehicleIdentityEvidence);
      const evidence = await repo.findOne({
        where: { id: evidenceId, vehicleId }, lock: { mode: 'pessimistic_write' },
      });
      if (!evidence) throw new NotFoundException('VIN 证据不存在');
      this.assertVersion(evidence.version, dto.expectedVersion);
      if (evidence.reviewStatus !== 'review_pending') throw new ConflictException('VIN 证据已审核');
      evidence.reviewStatus = dto.decision;
      evidence.reviewNote = dto.reviewNote.trim();
      evidence.reviewedBy = currentUser.id;
      evidence.reviewedAt = new Date();
      evidence.version += 1;
      const vehicleVinChanged = dto.decision === 'confirmed' && vehicle.vin !== evidence.vinCandidate;
      if (dto.decision === 'confirmed') {
        if (vehicleVinChanged) {
          const activeDemand = await manager.getRepository(RepairProcurementDemand).findOne({
            where: { vehicleId, status: Not('cancelled') },
          });
          if (activeDemand) {
            throw new ConflictException('车辆已有未关闭报料，必须先处理采购链后才能变更 VIN');
          }
        }
        const duplicate = await manager.getRepository(RepairVehicleProfile).findOne({
          where: { companyRef: vehicle.companyRef, vin: evidence.vinCandidate },
        });
        if (duplicate && duplicate.id !== vehicle.id) {
          throw new ConflictException('该公司下 VIN 已绑定其他车辆');
        }
        vehicle.vin = evidence.vinCandidate;
        vehicle.updatedBy = currentUser.id;
        vehicle.version += 1;
        await manager.getRepository(RepairVehicleProfile).save(vehicle);
        if (vehicleVinChanged) {
          await manager.getRepository(RepairPartFitmentEvidence).createQueryBuilder()
            .update(RepairPartFitmentEvidence)
            .set({ fitmentStatus: 'stale' })
            .where('vehicle_id = :vehicleId AND fitment_status IN (:...statuses)', {
              vehicleId,
              statuses: ['candidate', 'confirmed'],
            })
            .execute();
        }
        await repo.createQueryBuilder()
          .update(RepairVehicleIdentityEvidence)
          .set({ reviewStatus: 'superseded' })
          .where('vehicle_id = :vehicleId AND id <> :id AND review_status = :status', {
            vehicleId, id: evidence.id, status: 'confirmed',
          })
          .execute();
      }
      await repo.save(evidence);
      await this.audit(manager, currentUser, evidence.id, 'vin_evidence_reviewed', {
        vehicleId,
        decision: dto.decision,
        vehicleVinChanged,
      });
      return evidence;
    });
  }

  async createFitmentEvidence(
    workOrderId: number,
    dto: CreateRepairPartFitmentEvidenceDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const profile = await this.loadProfile(workOrderId, manager);
      await this.scopeService.assertAccess(currentUser, this.scopeOf(profile), 'quote.manage', manager);
      const fingerprint = this.fingerprint({ workOrderId, ...dto });
      const repo = manager.getRepository(RepairPartFitmentEvidence);
      const replay = await this.assertIdempotentReplay(repo, dto.requestIdempotencyKey, fingerprint);
      if (replay) return replay;
      const vehicle = await manager.getRepository(RepairVehicleProfile).findOne({
        where: { id: profile.vehicleId },
      });
      if (!vehicle?.vin) throw new BadRequestException('必须先确认 17 位 VIN 才能建立配件适配证据');
      const confirmedIdentity = await manager.getRepository(RepairVehicleIdentityEvidence).findOne({
        where: { vehicleId: vehicle.id, vinCandidate: vehicle.vin, reviewStatus: 'confirmed' },
        order: { reviewedAt: 'DESC' },
      });
      if (!confirmedIdentity) {
        throw new BadRequestException('必须先完成人工确认的 VIN 身份证据才能建立配件适配证据');
      }
      this.assertOpaqueRef(dto.sourceRef, '适配来源');
      if (dto.diagramRef) this.assertOpaqueRef(dto.diagramRef, '配件图纸');
      this.assertSafeEvidenceSnapshot(dto.applicabilitySnapshot, '适配证据快照');
      const evidenceSave = await this.saveIdempotent(repo, repo.create({
        workOrderId,
        vehicleId: profile.vehicleId,
        companyRef: profile.companyRef,
        businessSectorRef: profile.businessSectorRef,
        storeRef: profile.storeRef,
        customerRef: profile.customerRef,
        sourceType: dto.sourceType,
        providerCode: dto.providerCode.trim(),
        providerVersion: dto.providerVersion?.trim() || null,
        sourceRef: dto.sourceRef.trim(),
        oeNumber: dto.oeNumber.trim().toUpperCase(),
        partName: dto.partName.trim(),
        diagramRef: dto.diagramRef?.trim() || null,
        applicabilitySnapshot: {
          ...dto.applicabilitySnapshot,
          vinSnapshot: vehicle.vin,
          engineCodeSnapshot: vehicle.engineCode,
          salesMarketSnapshot: vehicle.salesMarket,
          evidenceClass: dto.sourceType === 'ai_candidate' ? 'ai_candidate_requires_human_review' : 'source_claim',
        },
        confidence: dto.confidence.toFixed(2),
        requestIdempotencyKey: dto.requestIdempotencyKey,
        requestFingerprint: fingerprint,
        fitmentStatus: 'candidate',
        reviewNote: null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        createdBy: currentUser.id,
        reviewedBy: null,
        reviewedAt: null,
        version: 1,
      }), dto.requestIdempotencyKey, fingerprint);
      if (!evidenceSave.created) return evidenceSave.entity;
      const evidence = evidenceSave.entity;
      await this.audit(manager, currentUser, evidence.id, 'fitment_evidence_created', {
        workOrderId,
        sourceType: evidence.sourceType,
        effect: 'candidate_only',
      });
      return evidence;
    });
  }

  async reviewFitmentEvidence(
    workOrderId: number,
    evidenceId: number,
    dto: ReviewRepairEvidenceDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const profile = await this.loadProfile(workOrderId, manager);
      await this.scopeService.assertAccess(currentUser, this.scopeOf(profile), 'quote.manage', manager);
      const repo = manager.getRepository(RepairPartFitmentEvidence);
      const evidence = await repo.findOne({
        where: { id: evidenceId, workOrderId }, lock: { mode: 'pessimistic_write' },
      });
      if (!evidence) throw new NotFoundException('配件适配证据不存在');
      this.assertVersion(evidence.version, dto.expectedVersion);
      if (evidence.fitmentStatus !== 'candidate') throw new ConflictException('适配证据已审核或失效');
      if (dto.decision === 'confirmed') {
        const vehicle = await manager.getRepository(RepairVehicleProfile).findOne({
          where: { id: evidence.vehicleId },
        });
        const snapshotVin = String(evidence.applicabilitySnapshot.vinSnapshot ?? '');
        const confirmedIdentity = vehicle?.vin
          ? await manager.getRepository(RepairVehicleIdentityEvidence).findOne({
              where: { vehicleId: vehicle.id, vinCandidate: vehicle.vin, reviewStatus: 'confirmed' },
              order: { reviewedAt: 'DESC' },
            })
          : null;
        if (!vehicle?.vin || snapshotVin !== vehicle.vin || !confirmedIdentity) {
          throw new BadRequestException('适配证据绑定的 VIN 已不是当前人工确认 VIN');
        }
        if (evidence.validUntil && evidence.validUntil <= new Date()) {
          throw new BadRequestException('配件适配证据已过期');
        }
      }
      evidence.fitmentStatus = dto.decision;
      evidence.reviewNote = dto.reviewNote.trim();
      evidence.reviewedBy = currentUser.id;
      evidence.reviewedAt = new Date();
      evidence.version += 1;
      await repo.save(evidence);
      await this.audit(manager, currentUser, evidence.id, 'fitment_evidence_reviewed', {
        workOrderId, decision: dto.decision, humanDecisionRequired: true,
      });
      return evidence;
    });
  }

  async createDemand(
    workOrderId: number,
    dto: CreateRepairProcurementDemandDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const profile = await this.loadProfile(workOrderId, manager);
      await this.scopeService.assertAccess(currentUser, this.scopeOf(profile), 'quote.manage', manager);
      const fingerprint = this.fingerprint({ workOrderId, ...dto });
      const repo = manager.getRepository(RepairProcurementDemand);
      const replay = await this.assertIdempotentReplay(repo, dto.requestIdempotencyKey, fingerprint);
      if (replay) return replay;
      await this.assertPlanAndQuoteItem(profile, dto, manager);
      const fitment = await manager.getRepository(RepairPartFitmentEvidence).findOne({
        where: { id: dto.fitmentEvidenceId, workOrderId, fitmentStatus: 'confirmed' },
      });
      if (!fitment || fitment.oeNumber !== dto.oeNumber.trim().toUpperCase()) {
        throw new BadRequestException('报料必须绑定同工单已确认且 OE 号一致的适配证据');
      }
      if (fitment.validUntil && fitment.validUntil <= new Date()) {
        throw new BadRequestException('配件适配证据已过期');
      }
      if (dto.materialId) {
        const material = await manager.getRepository(Material).findOne({ where: { id: dto.materialId } });
        if (!material) throw new NotFoundException('总部材料主数据不存在');
      }
      const demandSave = await this.saveIdempotent(repo, repo.create({
        workOrderId,
        vehicleId: profile.vehicleId,
        companyRef: profile.companyRef,
        businessSectorRef: profile.businessSectorRef,
        storeRef: profile.storeRef,
        customerRef: profile.customerRef,
        planVersion: dto.planVersion,
        quoteVersion: dto.quoteVersion,
        planItemRef: dto.planItemRef.trim(),
        quoteLineRef: dto.quoteLineRef.trim(),
        fitmentEvidenceId: dto.fitmentEvidenceId,
        materialId: dto.materialId ?? null,
        oeNumber: dto.oeNumber.trim().toUpperCase(),
        partName: dto.partName.trim(),
        specification: dto.specification?.trim() || null,
        quantity: this.positiveDecimal(dto.quantity, '报料数量'),
        unit: dto.unit.trim(),
        fulfillmentMode: dto.fulfillmentMode,
        specialFlag: dto.specialFlag?.trim() || null,
        inventorySnapshot: null,
        requestIdempotencyKey: dto.requestIdempotencyKey,
        requestFingerprint: fingerprint,
        status: 'draft',
        createdBy: currentUser.id,
        updatedBy: null,
        version: 1,
      }), dto.requestIdempotencyKey, fingerprint);
      if (!demandSave.created) return demandSave.entity;
      const demand = demandSave.entity;
      await this.audit(manager, currentUser, demand.id, 'procurement_demand_created', {
        workOrderId,
        planItemRef: demand.planItemRef,
        quoteLineRef: demand.quoteLineRef,
        inventoryEffect: 'none',
      });
      return demand;
    });
  }

  async checkInventory(
    workOrderId: number,
    demandId: number,
    dto: CheckRepairDemandInventoryDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const { profile, demand } = await this.loadDemandForUpdate(workOrderId, demandId, manager);
      await this.scopeService.assertAccess(currentUser, this.scopeOf(profile), 'quote.manage', manager);
      this.assertVersion(demand.version, dto.expectedVersion);
      assertRepairProcurementDemandStillMutable(demand.status, '刷新库存快照');
      const stocks = demand.materialId
        ? await manager.getRepository(MaterialStock).find({ where: { materialId: demand.materialId } })
        : [];
      const totalAvailable = stocks.reduce((sum, item) => sum + Number(item.currentQuantity), 0);
      demand.inventorySnapshot = {
        checkedAt: new Date().toISOString(),
        materialId: demand.materialId,
        warehouses: stocks.map((item) => ({
          warehouseId: item.warehouseId,
          currentQuantity: item.currentQuantity,
          observedAt: item.updatedAt,
        })),
        totalAvailable: totalAvailable.toFixed(2),
        demandQuantity: demand.quantity,
        result: totalAvailable >= Number(demand.quantity) ? 'stock_candidate' : 'procurement_required',
        authority: 'readonly_material_stocks_snapshot',
      };
      if (demand.status === 'draft') demand.status = 'inventory_checked';
      demand.updatedBy = currentUser.id;
      demand.version += 1;
      await manager.getRepository(RepairProcurementDemand).save(demand);
      await this.audit(manager, currentUser, demand.id, 'inventory_snapshot_checked', {
        workOrderId, materialId: demand.materialId, inventoryEffect: 'none',
      });
      return demand;
    });
  }

  async createInquiries(
    workOrderId: number,
    demandId: number,
    dto: CreateRepairSupplierInquiriesDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const { profile, demand } = await this.loadDemandForUpdate(workOrderId, demandId, manager);
      await this.scopeService.assertAccess(currentUser, this.scopeOf(profile), 'quote.manage', manager);
      const supplierIds = [...new Set(dto.supplierIds)];
      if (supplierIds.length < 2) throw new BadRequestException('询价至少需要两个不同供应商');
      const repo = manager.getRepository(RepairSupplierInquiry);
      const requestSpecs = supplierIds.map((supplierId) => ({
        supplierId,
        childKey: this.childIdempotencyKey(dto.requestIdempotencyKey, supplierId),
        fingerprint: this.fingerprint({
          workOrderId,
          demandId,
          supplierIds: [...supplierIds].sort((left, right) => left - right),
          supplierId,
          note: dto.inquiryNote?.trim() || null,
        }),
      }));
      const replayBySupplier = new Map<number, RepairSupplierInquiry>();
      for (const spec of requestSpecs) {
        const replay = await this.assertIdempotentReplay(repo, spec.childKey, spec.fingerprint);
        if (replay) replayBySupplier.set(spec.supplierId, replay);
      }
      if (replayBySupplier.size === requestSpecs.length) {
        return requestSpecs.map((spec) => replayBySupplier.get(spec.supplierId)!);
      }
      if (!['draft', 'inventory_checked', 'inquiry_open'].includes(demand.status)) {
        throw new ConflictException('当前报料状态不能创建询价');
      }
      const suppliers = await manager.getRepository(Supplier).find({ where: { id: In(supplierIds) } });
      if (suppliers.length !== supplierIds.length || suppliers.some((item) => item.status !== 'active')) {
        throw new BadRequestException('询价供应商必须全部来自现有启用供应商主数据');
      }
      const created: RepairSupplierInquiry[] = [];
      let newlyCreatedCount = 0;
      for (const supplier of suppliers) {
        const spec = requestSpecs.find((item) => item.supplierId === supplier.id)!;
        const { childKey, fingerprint } = spec;
        const replay = replayBySupplier.get(supplier.id);
        if (replay) {
          created.push(replay);
          continue;
        }
        const inquirySave = await this.saveIdempotent(repo, repo.create({
          demandId,
          workOrderId,
          supplierId: supplier.id,
          supplierNameSnapshot: supplier.name,
          supplierScoreSnapshot: supplier.score,
          inquiryNo: this.businessNo('RINQ'),
          requestSnapshot: {
            vinRef: `repair-vehicle:${demand.vehicleId}`,
            oeNumber: demand.oeNumber,
            partName: demand.partName,
            specification: demand.specification,
            quantity: demand.quantity,
            unit: demand.unit,
            fitmentEvidenceRef: `repair-fitment-evidence:${demand.fitmentEvidenceId}`,
            inquiryNote: dto.inquiryNote?.trim() || null,
            dispatchState: 'draft_not_sent',
          },
          requestIdempotencyKey: childKey,
          requestFingerprint: fingerprint,
          status: 'draft',
          requestedAt: null,
          createdBy: currentUser.id,
        }), childKey, fingerprint);
        created.push(inquirySave.entity);
        if (inquirySave.created) newlyCreatedCount += 1;
      }
      if (newlyCreatedCount === 0) return created;
      demand.status = 'inquiry_open';
      demand.updatedBy = currentUser.id;
      demand.version += 1;
      await manager.getRepository(RepairProcurementDemand).save(demand);
      await this.audit(manager, currentUser, demand.id, 'supplier_inquiry_drafts_created', {
        workOrderId,
        supplierCount: created.length,
        externalContactEffect: 'none_draft_only',
      });
      return created;
    });
  }

  async recordQuote(
    workOrderId: number,
    inquiryId: number,
    dto: RecordRepairSupplierQuoteDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const profile = await this.loadProfile(workOrderId, manager);
      await this.scopeService.assertAccess(currentUser, this.scopeOf(profile), 'quote.manage', manager);
      const fingerprint = this.fingerprint({ workOrderId, inquiryId, ...dto });
      const quoteRepo = manager.getRepository(RepairSupplierQuote);
      const replay = await this.assertIdempotentReplay(
        quoteRepo,
        dto.requestIdempotencyKey,
        fingerprint,
      );
      if (replay) return replay;
      const inquiryRepo = manager.getRepository(RepairSupplierInquiry);
      const inquiry = await inquiryRepo.findOne({
        where: { id: inquiryId, workOrderId }, lock: { mode: 'pessimistic_write' },
      });
      if (!inquiry) throw new NotFoundException('询价记录不存在');
      if (['cancelled', 'expired'].includes(inquiry.status)) throw new ConflictException('询价已关闭');
      const demand = await manager.getRepository(RepairProcurementDemand).findOne({
        where: { id: inquiry.demandId, workOrderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!demand) throw new NotFoundException('报料需求不存在');
      assertRepairProcurementDemandStillMutable(demand.status, '登记新报价');
      if (compareQuantity(dto.quantity, demand.quantity) !== 0) {
        throw new BadRequestException('供应商报价数量必须与当前报料数量一致');
      }
      const fitment = await manager.getRepository(RepairPartFitmentEvidence).findOne({
        where: { id: dto.fitmentEvidenceId, workOrderId, fitmentStatus: 'confirmed' },
      });
      if (!fitment || fitment.oeNumber !== demand.oeNumber) {
        throw new BadRequestException('供应商报价必须绑定同一 OE 号的已确认适配证据');
      }
      if (new Date(dto.validUntil) <= new Date()) {
        throw new BadRequestException('不能登记已经失效的供应商报价');
      }
      this.assertOpaqueRef(dto.sourceRef, '报价来源');
      this.assertSafeEvidenceSnapshot(dto.responseSnapshot, '供应商报价快照');
      const latest = await quoteRepo.find({
        where: { inquiryId }, order: { quoteVersion: 'DESC' }, take: 1,
      });
      const quoteSave = await this.saveIdempotent(quoteRepo, quoteRepo.create({
        inquiryId,
        demandId: inquiry.demandId,
        workOrderId,
        supplierId: inquiry.supplierId,
        quoteVersion: (latest[0]?.quoteVersion ?? 0) + 1,
        unitPrice: this.nonNegativeDecimal(dto.unitPrice, '单价'),
        quantity: this.positiveDecimal(dto.quantity, '报价数量'),
        freightAmount: this.nonNegativeDecimal(dto.freightAmount ?? '0', '运费'),
        taxIncluded: dto.taxIncluded,
        leadTimeDays: dto.leadTimeDays,
        returnable: dto.returnable,
        warrantyMonths: dto.warrantyMonths ?? null,
        paymentTerms: dto.paymentTerms.trim(),
        validUntil: new Date(dto.validUntil),
        sourceRef: dto.sourceRef.trim(),
        responseSnapshot: dto.responseSnapshot ?? null,
        fitmentEvidenceId: dto.fitmentEvidenceId,
        requestIdempotencyKey: dto.requestIdempotencyKey,
        requestFingerprint: fingerprint,
        status: 'candidate',
        createdBy: currentUser.id,
      }), dto.requestIdempotencyKey, fingerprint);
      if (!quoteSave.created) return quoteSave.entity;
      const quote = quoteSave.entity;
      if (latest[0]) {
        latest[0].status = 'superseded';
        await quoteRepo.save(latest[0]);
      }
      inquiry.status = 'responded';
      await inquiryRepo.save(inquiry);
      demand.status = 'decision_pending';
      demand.updatedBy = currentUser.id;
      demand.version += 1;
      await manager.getRepository(RepairProcurementDemand).save(demand);
      await this.audit(manager, currentUser, quote.id, 'supplier_quote_recorded', {
        workOrderId, inquiryId, demandId: demand.id, supplierId: inquiry.supplierId,
      });
      return quote;
    });
  }

  async createDecision(
    workOrderId: number,
    demandId: number,
    dto: CreateRepairProcurementDecisionDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const { profile, demand } = await this.loadDemandForUpdate(workOrderId, demandId, manager);
      await this.scopeService.assertAccess(currentUser, this.scopeOf(profile), 'quote.manage', manager);
      const repo = manager.getRepository(RepairProcurementDecision);
      const fingerprint = this.fingerprint({ workOrderId, demandId, ...dto });
      const replay = await this.assertIdempotentReplay(
        repo,
        dto.requestIdempotencyKey,
        fingerprint,
      );
      if (replay) return replay;
      assertRepairProcurementDemandStillMutable(demand.status, '生成采购决策');
      const quoteRepo = manager.getRepository(RepairSupplierQuote);
      const quotes = await quoteRepo.find({ where: { demandId, status: In(['candidate', 'shortlisted']) } });
      const selected = quotes.find((item) => item.id === dto.selectedQuoteId);
      if (!selected) throw new BadRequestException('选中报价不是当前报料的有效报价');
      if (selected.validUntil <= new Date()) throw new BadRequestException('选中报价已过期');
      const inquiries = await manager.getRepository(RepairSupplierInquiry).find({ where: { demandId } });
      const inquiryBySupplier = new Map(inquiries.map((item) => [item.supplierId, item]));
      const material = demand.materialId
        ? await manager.getRepository(Material).findOne({ where: { id: demand.materialId } })
        : null;
      for (const candidate of dto.externalPriceCandidates ?? []) {
        this.assertOpaqueRef(candidate.sourceRef, '外部价格来源');
        if (candidate.currency !== 'CNY') {
          throw new BadRequestException('外部参考价必须先由正式汇率证据换算为 CNY');
        }
        if (new Date(candidate.collectedAt).getTime() > Date.now() + 5 * 60 * 1000) {
          throw new BadRequestException('外部参考价采集时间不能晚于当前时间');
        }
      }
      const historical = demand.materialId
        ? await manager.getRepository(WorkOrderMaterial).createQueryBuilder('work_order_material')
            .innerJoin(
              RepairWorkOrderProfile,
              'repair_profile',
              'repair_profile.work_order_id = work_order_material.work_order_id',
            )
            .where('work_order_material.material_id = :materialId', { materialId: demand.materialId })
            .andWhere('work_order_material.deleted_at IS NULL')
            .andWhere('repair_profile.company_ref = :companyRef', { companyRef: profile.companyRef })
            .andWhere('repair_profile.business_sector_ref = :businessSectorRef', {
              businessSectorRef: profile.businessSectorRef,
            })
            .andWhere('repair_profile.store_ref = :storeRef', { storeRef: profile.storeRef })
            .orderBy('work_order_material.createdAt', 'DESC')
            .take(50)
            .getMany()
        : [];
      const analysis = buildPriceReasonablenessSnapshot({
        selectedQuoteId: selected.id,
        quotes: quotes.map((quote) => ({
          quoteId: quote.id,
          supplierId: quote.supplierId,
          unitPrice: Number(quote.unitPrice),
          freightAmount: Number(quote.freightAmount),
          quantity: Number(quote.quantity),
          taxIncluded: quote.taxIncluded,
          leadTimeDays: quote.leadTimeDays,
          returnable: quote.returnable,
          warrantyMonths: quote.warrantyMonths,
          supplierScore: Number(inquiryBySupplier.get(quote.supplierId)?.supplierScoreSnapshot ?? 0),
          sourceRef: quote.sourceRef,
        })),
        materialDefaultUnitPrice: material ? Number(material.defaultUnitPrice) : null,
        historicalUnitPrices: historical.map((item) => Number(item.unitPrice)),
        externalCandidates: dto.externalPriceCandidates ?? [],
      });
      if (analysis.riskFlags.length && !dto.overrideReason?.trim()) {
        throw new BadRequestException('存在价格或供应风险时必须填写人工复核理由');
      }
      await this.assertDecisionReferences(workOrderId, demand, selected, dto, manager);
      const prior = await repo.find({ where: { demandId }, order: { decisionVersion: 'DESC' }, take: 1 });
      if (prior[0] && !['rejected', 'superseded'].includes(prior[0].decisionStatus)) {
        prior[0].decisionStatus = 'superseded';
        prior[0].updatedBy = currentUser.id;
        prior[0].version += 1;
        await repo.save(prior[0]);
      }
      const decision = repo.create({
        demandId,
        workOrderId,
        decisionVersion: (prior[0]?.decisionVersion ?? 0) + 1,
        selectedQuoteId: selected.id,
        approvalMode: dto.approvalMode,
        customerConfirmationRequestId: dto.customerConfirmationRequestId ?? null,
        approvalRequestId: dto.approvalRequestId ?? null,
        aiAnalysisSnapshot: {
          ...analysis,
          generatedAt: new Date().toISOString(),
          externalSourcesAreReferenceOnly: true,
        },
        overrideReason: dto.overrideReason?.trim() || null,
        requestIdempotencyKey: dto.requestIdempotencyKey,
        requestFingerprint: fingerprint,
        decisionStatus: await this.resolveDecisionStatus(workOrderId, demand, selected, dto, manager),
        createdBy: currentUser.id,
        updatedBy: null,
        version: 1,
      });
      const decisionSave = await this.saveIdempotent(repo, decision, dto.requestIdempotencyKey, fingerprint);
      if (!decisionSave.created) return decisionSave.entity;
      selected.status = 'shortlisted';
      await quoteRepo.save(selected);
      demand.status = decision.decisionStatus === 'approved' ? 'approved' : 'decision_pending';
      demand.updatedBy = currentUser.id;
      demand.version += 1;
      await manager.getRepository(RepairProcurementDemand).save(demand);
      await this.audit(manager, currentUser, decision.id, 'procurement_decision_created', {
        workOrderId,
        demandId,
        decisionStatus: decision.decisionStatus,
        aiEffect: 'analysis_only_human_selection_required',
      });
      return decision;
    });
  }

  async requestLeaderApproval(
    workOrderId: number,
    demandId: number,
    dto: RequestRepairProcurementLeaderApprovalDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const { profile, demand } = await this.loadDemandForUpdate(workOrderId, demandId, manager);
      await this.scopeService.assertAccess(currentUser, this.scopeOf(profile), 'quote.manage', manager);
      const quote = await manager.getRepository(RepairSupplierQuote).findOne({
        where: { id: dto.selectedQuoteId, demandId, workOrderId },
      });
      if (!quote) {
        throw new BadRequestException('所选报价不属于当前工单和报料');
      }
      const selectedTotal = addMoney(multiplyMoney(quote.quantity, quote.unitPrice), quote.freightAmount);
      const binding = buildRepairProcurementLeaderApprovalBinding({
        workOrderId,
        demandId,
        selectedQuoteId: quote.id,
        supplierId: quote.supplierId,
        planVersion: demand.planVersion,
        authorizedQuoteVersion: demand.quoteVersion,
        supplierQuoteVersion: quote.quoteVersion,
        quantity: quote.quantity,
        unitPrice: quote.unitPrice,
        freightAmount: quote.freightAmount,
        totalAmount: selectedTotal,
      });
      const approvalRepo = manager.getRepository(ApprovalRequest);
      const replay = await approvalRepo.findOne({
        where: { requestIdempotencyKey: binding.requestIdempotencyKey },
        lock: { mode: 'pessimistic_write' },
      });
      if (replay) {
        if (
          replay.requestFingerprint !== binding.requestFingerprint ||
          !this.leaderApprovalMatchesSelection(replay, workOrderId, demand, quote)
        ) {
          throw new ConflictException('审批业务绑定已用于不同请求');
        }
        return replay;
      }
      assertRepairProcurementDemandStillMutable(demand.status, '发起领导审批');
      if (!['candidate', 'shortlisted'].includes(quote.status) || quote.validUntil <= new Date()) {
        throw new BadRequestException('只有当前有效报价可以发起精确领导审批');
      }
      const fitment = await manager.getRepository(RepairPartFitmentEvidence).findOne({
        where: { id: quote.fitmentEvidenceId, workOrderId, fitmentStatus: 'confirmed' },
      });
      if (!fitment || (fitment.validUntil !== null && fitment.validUntil <= new Date())) {
        throw new BadRequestException('报价对应的配件适配证据已失效');
      }
      const approvalResult = await createPendingApprovalRequestWithResult({
        manager,
        input: {
          relatedWorkOrderId: workOrderId,
          amount: selectedTotal,
          reason: `${dto.reason.trim()} | 汽修采购报料 #${demand.id} / 报价 #${quote.id} / 供应商 #${quote.supplierId}`
            .slice(0, 500),
          requestIdempotencyKey: binding.requestIdempotencyKey,
          requestFingerprint: binding.requestFingerprint,
        },
        currentUser,
        sequenceService: this.sequenceService,
        operationLogsService: this.operationLogsService,
      });
      if (approvalResult.created) {
        await this.audit(manager, currentUser, approvalResult.request.id, 'procurement_leader_approval_requested', {
          workOrderId,
          demandId,
          selectedQuoteId: quote.id,
          supplierId: quote.supplierId,
          amount: selectedTotal,
          approvalAuthority: 'approval_requests',
          approvalEffect: 'pending_request_only',
        });
      }
      return approvalResult.request;
    });
  }

  async refreshDecision(
    workOrderId: number,
    decisionId: number,
    dto: RefreshRepairProcurementDecisionDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const profile = await this.loadProfile(workOrderId, manager);
      await this.scopeService.assertAccess(currentUser, this.scopeOf(profile), 'quote.manage', manager);
      const repo = manager.getRepository(RepairProcurementDecision);
      const decision = await repo.findOne({
        where: { id: decisionId, workOrderId }, lock: { mode: 'pessimistic_write' },
      });
      if (!decision) throw new NotFoundException('采购决策不存在');
      this.assertVersion(decision.version, dto.expectedVersion);
      if (['superseded', 'rejected'].includes(decision.decisionStatus)) {
        throw new ConflictException('采购决策已终止');
      }
      const demand = await manager.getRepository(RepairProcurementDemand).findOne({
        where: { id: decision.demandId, workOrderId },
        lock: { mode: 'pessimistic_write' },
      });
      const quote = await manager.getRepository(RepairSupplierQuote).findOne({
        where: { id: decision.selectedQuoteId, demandId: decision.demandId },
      });
      if (!demand || !quote) throw new NotFoundException('采购决策依赖已不存在');
      assertRepairProcurementDemandStillMutable(demand.status, '刷新采购决策');
      const fitment = await manager.getRepository(RepairPartFitmentEvidence).findOne({
        where: { id: quote.fitmentEvidenceId, workOrderId, fitmentStatus: 'confirmed' },
      });
      if (
        quote.status !== 'shortlisted' ||
        quote.validUntil <= new Date() ||
        !fitment ||
        (fitment.validUntil !== null && fitment.validUntil <= new Date())
      ) {
        decision.decisionStatus = 'superseded';
        decision.updatedBy = currentUser.id;
        decision.version += 1;
        await repo.save(decision);
        demand.status = 'decision_pending';
        demand.updatedBy = currentUser.id;
        demand.version += 1;
        await manager.getRepository(RepairProcurementDemand).save(demand);
        await this.audit(manager, currentUser, decision.id, 'procurement_decision_superseded', {
          workOrderId,
          reason: 'quote_or_fitment_evidence_expired_or_superseded',
        });
        return decision;
      }
      decision.decisionStatus = await this.resolveDecisionStatus(workOrderId, demand, quote, {
        approvalMode: decision.approvalMode,
        customerConfirmationRequestId: decision.customerConfirmationRequestId ?? undefined,
        approvalRequestId: decision.approvalRequestId ?? undefined,
      }, manager);
      decision.updatedBy = currentUser.id;
      decision.version += 1;
      await repo.save(decision);
      demand.status = decision.decisionStatus === 'approved' ? 'approved' : 'decision_pending';
      demand.updatedBy = currentUser.id;
      demand.version += 1;
      await manager.getRepository(RepairProcurementDemand).save(demand);
      await this.audit(manager, currentUser, decision.id, 'procurement_decision_authority_refreshed', {
        workOrderId, decisionStatus: decision.decisionStatus,
      });
      return decision;
    });
  }

  async createPurchaseOrder(
    workOrderId: number,
    dto: CreateRepairPurchaseOrderDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const profile = await this.loadProfile(workOrderId, manager);
      await this.scopeService.assertAccess(currentUser, this.scopeOf(profile), 'quote.manage', manager);
      const decisionIds = [...new Set(dto.decisionIds)];
      const fingerprint = this.fingerprint({
        workOrderId,
        decisionIds,
        approvalRequestId: dto.approvalRequestId,
        expectedArrivalAt: dto.expectedArrivalAt ?? null,
      });
      const repo = manager.getRepository(RepairPurchaseOrder);
      const replay = await this.assertIdempotentReplay(repo, dto.requestIdempotencyKey, fingerprint);
      if (replay) return replay;
      const decisions = await manager.getRepository(RepairProcurementDecision).find({
        where: { id: In(decisionIds), workOrderId },
      });
      if (decisions.length !== decisionIds.length || decisions.some((item) => item.decisionStatus !== 'approved')) {
        throw new BadRequestException('采购单只能引用同工单已批准的有效采购决策');
      }
      const demandIds = decisions.map((item) => item.demandId);
      if (new Set(demandIds).size !== demandIds.length) {
        throw new BadRequestException('一张采购单不能重复引用同一报料需求');
      }
      const quotes = await manager.getRepository(RepairSupplierQuote).find({
        where: { id: In(decisions.map((item) => item.selectedQuoteId)) },
      });
      if (quotes.length !== decisions.length) throw new NotFoundException('采购报价依赖不完整');
      if (quotes.some((item) => item.status !== 'shortlisted' || item.validUntil <= new Date())) {
        throw new BadRequestException('采购单只能使用当前有效且已人工选中的供应商报价');
      }
      const fitments = await manager.getRepository(RepairPartFitmentEvidence).find({
        where: { id: In(quotes.map((item) => item.fitmentEvidenceId)), workOrderId, fitmentStatus: 'confirmed' },
      });
      if (
        fitments.length !== new Set(quotes.map((item) => item.fitmentEvidenceId)).size ||
        fitments.some((item) => item.validUntil && item.validUntil <= new Date())
      ) {
        throw new BadRequestException('采购报价的配件适配证据已失效');
      }
      const supplierIds = [...new Set(quotes.map((item) => item.supplierId))];
      if (supplierIds.length !== 1) throw new BadRequestException('一张采购单只能对应一个供应商');
      const supplier = await manager.getRepository(Supplier).findOne({ where: { id: supplierIds[0] } });
      if (!supplier || supplier.status !== 'active') throw new BadRequestException('供应商主数据未启用');
      const demands = await manager.getRepository(RepairProcurementDemand).createQueryBuilder('demand')
        .setLock('pessimistic_write')
        .where('demand.id IN (:...demandIds)', { demandIds })
        .andWhere('demand.work_order_id = :workOrderId', { workOrderId })
        .getMany();
      if (demands.length !== demandIds.length) throw new NotFoundException('报料需求依赖不完整');
      if (demands.some((item) => item.status !== 'approved')) {
        throw new ConflictException('报料需求已经进入其他采购单或当前不再可采购');
      }
      const quoteById = new Map(quotes.map((quote) => [quote.id, quote]));
      const demandById = new Map(demands.map((demand) => [demand.id, demand]));
      const lines = decisions.map((decision) => {
        const quote = quoteById.get(decision.selectedQuoteId)!;
        const demand = demandById.get(decision.demandId)!;
        return {
          decisionId: decision.id,
          demandId: demand.id,
          materialId: demand.materialId,
          oeNumber: demand.oeNumber,
          partName: demand.partName,
          quoteLineRef: demand.quoteLineRef,
          quantity: quote.quantity,
          unitPrice: quote.unitPrice,
          freightAmount: quote.freightAmount,
          lineTotal: addMoney(multiplyMoney(quote.quantity, quote.unitPrice), quote.freightAmount),
          fitmentEvidenceId: quote.fitmentEvidenceId,
        };
      });
      const totalAmount = addMoney(...lines.map((line) => line.lineTotal));
      const paymentApproval = await manager.getRepository(ApprovalRequest).findOne({
        where: { id: dto.approvalRequestId },
      });
      if (
        !paymentApproval ||
        paymentApproval.approvalType !== ApprovalType.PAYOUT ||
        paymentApproval.currentStatus !== 'approved' ||
        paymentApproval.relatedWorkOrderId !== workOrderId ||
        compareMoney(paymentApproval.amount, totalAmount) < 0
      ) {
        throw new BadRequestException('采购单必须绑定同工单且金额足够的总部已批准付款审批');
      }
      const approvalAlreadyUsed = await manager.getRepository(RepairPurchaseOrder).findOne({
        where: { paymentApprovalRequestId: dto.approvalRequestId },
      });
      if (approvalAlreadyUsed) {
        throw new ConflictException('该付款审批已经绑定其他汽修采购单');
      }
      const approvalRequestIds = [...new Set([
        dto.approvalRequestId,
        ...decisions.map((item) => item.approvalRequestId).filter((id): id is number => Boolean(id)),
      ])];
      const orderSave = await this.saveIdempotent(repo, repo.create({
        orderNo: this.businessNo('RPO'),
        workOrderId,
        vehicleId: profile.vehicleId,
        companyRef: profile.companyRef,
        businessSectorRef: profile.businessSectorRef,
        storeRef: profile.storeRef,
        customerRef: profile.customerRef,
        supplierId: supplier.id,
        supplierNameSnapshot: supplier.name,
        decisionIds,
        lineSnapshot: lines,
        approvalRequestIds,
        paymentApprovalRequestId: dto.approvalRequestId,
        paymentIntentId: null,
        paymentState: 'not_bound',
        totalAmount,
        expectedArrivalAt: dto.expectedArrivalAt ? new Date(dto.expectedArrivalAt) : null,
        issueEvidenceRef: null,
        requestIdempotencyKey: dto.requestIdempotencyKey,
        requestFingerprint: fingerprint,
        status: 'approval_complete',
        createdBy: currentUser.id,
        updatedBy: null,
        version: 1,
      }), dto.requestIdempotencyKey, fingerprint);
      if (!orderSave.created) return orderSave.entity;
      const order = orderSave.entity;
      for (const demand of demands) {
        demand.status = 'order_prepared';
        demand.updatedBy = currentUser.id;
        demand.version += 1;
      }
      await manager.getRepository(RepairProcurementDemand).save(demands);
      await this.audit(manager, currentUser, order.id, 'repair_purchase_order_created', {
        workOrderId,
        supplierId: order.supplierId,
        totalAmount: order.totalAmount,
        externalDispatchEffect: 'none',
        paymentEffect: 'none',
      });
      return order;
    });
  }

  async issuePurchaseOrder(
    workOrderId: number,
    orderId: number,
    dto: IssueRepairPurchaseOrderDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const { profile, order } = await this.loadOrderForUpdate(workOrderId, orderId, manager);
      await this.scopeService.assertAccess(currentUser, this.scopeOf(profile), 'quote.manage', manager);
      const companyRegistryId = await this.resolveCompanyRegistryId(profile.companyRef, manager);
      this.assertVersion(order.version, dto.expectedVersion);
      if (order.status !== 'approval_complete') throw new ConflictException('采购单当前不能下发');
      this.assertOpaqueRef(dto.issueEvidenceRef, '采购单下发证据');
      const approvals = await manager.getRepository(ApprovalRequest).find({
        where: { id: In(order.approvalRequestIds) },
      });
      const paymentApproval = approvals.find((item) => item.id === order.paymentApprovalRequestId);
      if (
        approvals.length !== new Set(order.approvalRequestIds).size ||
        approvals.some((item) => item.currentStatus !== 'approved') ||
        !paymentApproval ||
        paymentApproval.approvalType !== ApprovalType.PAYOUT ||
        paymentApproval.relatedWorkOrderId !== workOrderId ||
        compareMoney(paymentApproval.amount, order.totalAmount) < 0
      ) {
        throw new BadRequestException('采购单关联审批不再全部有效');
      }
      if (!order.paymentIntentId) {
        throw new BadRequestException('采购单下发前必须绑定与工单、供应商、审批和金额一致的总部付款意图');
      }
      const paymentIntent = await manager.getRepository(ApprovalPaymentIntent).findOne({
        where: { id: order.paymentIntentId },
      });
      const projectedPaymentState = paymentIntent && this.paymentIntentMatchesOrder(
        paymentIntent,
        order,
        companyRegistryId,
      )
        ? projectPaymentState(paymentIntent)
        : 'approval_pending';
      if (projectedPaymentState === 'approval_pending') {
        throw new BadRequestException('采购单下发前付款意图必须保持有效且至少进入正式付款计划');
      }
      const decisions = await manager.getRepository(RepairProcurementDecision).find({
        where: { id: In(order.decisionIds), workOrderId, decisionStatus: 'approved' },
      });
      const quotes = decisions.length
        ? await manager.getRepository(RepairSupplierQuote).find({
            where: { id: In(decisions.map((item) => item.selectedQuoteId)), workOrderId },
          })
        : [];
      const fitments = quotes.length
        ? await manager.getRepository(RepairPartFitmentEvidence).find({
            where: {
              id: In(quotes.map((item) => item.fitmentEvidenceId)),
              workOrderId,
              fitmentStatus: 'confirmed',
            },
          })
        : [];
      if (
        decisions.length !== order.decisionIds.length ||
        quotes.length !== decisions.length ||
        quotes.some((item) => item.status !== 'shortlisted' || item.validUntil <= new Date()) ||
        fitments.length !== new Set(quotes.map((item) => item.fitmentEvidenceId)).size ||
        fitments.some((item) => item.validUntil && item.validUntil <= new Date())
      ) {
        throw new BadRequestException('采购单的决策、报价或配件适配证据已失效');
      }
      const demandIds = order.lineSnapshot.map((line) => Number(line.demandId));
      const demands = await manager.getRepository(RepairProcurementDemand).createQueryBuilder('demand')
        .setLock('pessimistic_write')
        .where('demand.id IN (:...demandIds)', { demandIds })
        .andWhere('demand.work_order_id = :workOrderId', { workOrderId })
        .getMany();
      if (
        demands.length !== new Set(demandIds).size ||
        demands.some((item) => item.status !== 'order_prepared')
      ) {
        throw new BadRequestException('采购单报料依赖不完整或已被其他流程占用');
      }
      order.status = 'issued';
      order.paymentState = projectedPaymentState;
      order.issueEvidenceRef = dto.issueEvidenceRef.trim();
      order.updatedBy = currentUser.id;
      order.version += 1;
      await manager.getRepository(RepairPurchaseOrder).save(order);
      for (const demand of demands) {
        demand.status = 'ordered';
        demand.updatedBy = currentUser.id;
        demand.version += 1;
      }
      await manager.getRepository(RepairProcurementDemand).save(demands);
      await this.audit(manager, currentUser, order.id, 'repair_purchase_order_issued', {
        workOrderId,
        issueEvidenceRef: order.issueEvidenceRef,
        note: '仅登记人工下发证据，系统未自动联系供应商',
      });
      return order;
    });
  }

  async bindPaymentIntent(
    workOrderId: number,
    orderId: number,
    dto: BindRepairPaymentIntentDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const { profile, order } = await this.loadOrderForUpdate(workOrderId, orderId, manager);
      await this.scopeService.assertAccess(currentUser, this.scopeOf(profile), 'quote.manage', manager);
      const companyRegistryId = await this.resolveCompanyRegistryId(profile.companyRef, manager);
      this.assertVersion(order.version, dto.expectedVersion);
      if (order.status !== 'approval_complete') {
        throw new ConflictException('付款意图必须在采购单正式下发前完成绑定');
      }
      const intent = await manager.getRepository(ApprovalPaymentIntent).findOne({
        where: { id: dto.paymentIntentId },
      });
      if (!intent) throw new NotFoundException('总部付款意图不存在');
      const approval = await manager.getRepository(ApprovalRequest).findOne({
        where: { id: order.paymentApprovalRequestId },
      });
      if (
        !this.paymentIntentMatchesOrder(intent, order, companyRegistryId) ||
        !approval ||
        approval.approvalType !== ApprovalType.PAYOUT ||
        approval.currentStatus !== 'approved' ||
        approval.relatedWorkOrderId !== workOrderId
      ) {
        throw new BadRequestException('付款意图与采购单的工单、供应商、审批或金额不一致');
      }
      order.paymentIntentId = intent.id;
      order.paymentState = projectPaymentState(intent);
      order.updatedBy = currentUser.id;
      order.version += 1;
      await manager.getRepository(RepairPurchaseOrder).save(order);
      await this.audit(manager, currentUser, order.id, 'payment_intent_bound_readonly', {
        workOrderId,
        paymentIntentId: intent.id,
        paymentState: order.paymentState,
        financeMutationEffect: 'none',
      });
      return order;
    });
  }

  async refreshPaymentState(
    workOrderId: number,
    orderId: number,
    dto: RefreshRepairPaymentStateDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const { profile, order } = await this.loadOrderForUpdate(workOrderId, orderId, manager);
      await this.scopeService.assertAccess(currentUser, this.scopeOf(profile), 'quote.manage', manager);
      const companyRegistryId = await this.resolveCompanyRegistryId(profile.companyRef, manager);
      this.assertVersion(order.version, dto.expectedVersion);
      if (!order.paymentIntentId) throw new BadRequestException('采购单尚未绑定付款意图');
      const intent = await manager.getRepository(ApprovalPaymentIntent).findOne({
        where: { id: order.paymentIntentId },
      });
      if (!intent) throw new NotFoundException('付款意图已不存在');
      const approval = await manager.getRepository(ApprovalRequest).findOne({
        where: { id: order.paymentApprovalRequestId },
      });
      if (
        !this.paymentIntentMatchesOrder(intent, order, companyRegistryId) ||
        !approval ||
        approval.approvalType !== ApprovalType.PAYOUT ||
        approval.currentStatus !== 'approved' ||
        approval.relatedWorkOrderId !== workOrderId
      ) {
        order.paymentState = 'approval_pending';
        order.updatedBy = currentUser.id;
        order.version += 1;
        await manager.getRepository(RepairPurchaseOrder).save(order);
        await this.audit(manager, currentUser, order.id, 'payment_state_projection_blocked', {
          workOrderId,
          reason: 'payment_intent_or_approval_binding_mismatch',
          candidateAcceptedAsConfirmed: false,
        });
        return order;
      }
      order.paymentState = projectPaymentState(intent);
      order.updatedBy = currentUser.id;
      order.version += 1;
      await manager.getRepository(RepairPurchaseOrder).save(order);
      await this.audit(manager, currentUser, order.id, 'payment_state_projection_refreshed', {
        workOrderId,
        paymentState: order.paymentState,
        candidateAcceptedAsConfirmed: false,
      });
      return order;
    });
  }

  async recordShipment(
    workOrderId: number,
    orderId: number,
    dto: RecordRepairSupplierShipmentDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const { profile, order } = await this.loadOrderForUpdate(workOrderId, orderId, manager);
      await this.scopeService.assertAccess(currentUser, this.scopeOf(profile), 'quote.manage', manager);
      const fingerprint = this.fingerprint({ workOrderId, orderId, ...dto });
      const repo = manager.getRepository(RepairSupplierShipment);
      const replay = await this.assertIdempotentReplay(repo, dto.requestIdempotencyKey, fingerprint);
      if (replay) return replay;
      if (!['issued', 'partially_received'].includes(order.status)) {
        throw new ConflictException('采购单尚未下发或已全部收货');
      }
      this.assertOpaqueRef(dto.shipmentEvidenceRef, '发货证据');
      const shipmentSave = await this.saveIdempotent(repo, repo.create({
        purchaseOrderId: orderId,
        workOrderId,
        carrierName: dto.carrierName.trim(),
        trackingNo: dto.trackingNo.trim(),
        shipmentEvidenceRef: dto.shipmentEvidenceRef.trim(),
        requestIdempotencyKey: dto.requestIdempotencyKey,
        requestFingerprint: fingerprint,
        shippedAt: new Date(dto.shippedAt),
        expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : null,
        deliveredAt: null,
        status: 'shipped',
        createdBy: currentUser.id,
        version: 1,
      }), dto.requestIdempotencyKey, fingerprint);
      if (!shipmentSave.created) return shipmentSave.entity;
      const shipment = shipmentSave.entity;
      await this.audit(manager, currentUser, shipment.id, 'supplier_shipment_recorded', {
        workOrderId, purchaseOrderId: orderId,
      });
      return shipment;
    });
  }

  async recordReceipt(
    workOrderId: number,
    orderId: number,
    dto: RecordRepairGoodsReceiptDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const { profile, order } = await this.loadOrderForUpdate(workOrderId, orderId, manager);
      await this.scopeService.assertAccess(currentUser, this.scopeOf(profile), 'repair.execute', manager);
      const fingerprint = this.fingerprint({ workOrderId, orderId, ...dto });
      const repo = manager.getRepository(RepairGoodsReceipt);
      const replay = await this.assertIdempotentReplay(repo, dto.requestIdempotencyKey, fingerprint);
      if (replay) return replay;
      const shipment = await manager.getRepository(RepairSupplierShipment).findOne({
        where: { id: dto.shipmentId, purchaseOrderId: orderId, workOrderId },
      });
      if (!shipment) throw new BadRequestException('发货记录不属于当前采购单');
      if (dto.receiptMode === 'stock' && !dto.warehouseId) {
        throw new BadRequestException('入库收货必须指定现有仓库');
      }
      this.assertSafeEvidenceSnapshot(dto.inspectionSnapshot, '到货验收快照');
      if (dto.warehouseId) {
        const warehouse = await manager.getRepository(Warehouse).findOne({ where: { id: dto.warehouseId } });
        if (!warehouse || warehouse.status !== 'active') {
          throw new BadRequestException('收货仓库必须来自现有启用仓库主数据');
        }
      }
      const orderLines = new Map(order.lineSnapshot.map((line) => [Number(line.demandId), line]));
      if (new Set(dto.receivedLines.map((line) => line.demandId)).size !== dto.receivedLines.length) {
        throw new BadRequestException('同一报料在一张收货单中只能出现一次');
      }
      const priorReceipts = await repo.find({
        where: { purchaseOrderId: orderId, workOrderId, status: In(['accepted', 'partial']) },
      });
      const acceptedByDemand = new Map<number, string>();
      for (const prior of priorReceipts) {
        const priorLines = Array.isArray(prior.inspectionSnapshot.receivedLines)
          ? prior.inspectionSnapshot.receivedLines as Array<Record<string, unknown>>
          : [];
        for (const line of priorLines) {
          if (line.status !== 'accepted') continue;
          const demandId = Number(line.demandId);
          const quantity = normalizeQuantity(String(line.quantity));
          acceptedByDemand.set(demandId, addQuantity(acceptedByDemand.get(demandId) ?? '0.00', quantity));
        }
      }
      for (const line of dto.receivedLines) {
        const orderLine = orderLines.get(line.demandId);
        const quantity = this.positiveDecimal(line.quantity, '收货数量');
        if (!orderLine || compareQuantity(quantity, String(orderLine.quantity)) > 0) {
          throw new BadRequestException('收货行必须属于采购单且数量不能超过采购数量');
        }
        if (line.status === 'accepted') {
          const cumulative = addQuantityWithinLimit(
            acceptedByDemand.get(line.demandId) ?? '0.00',
            quantity,
            String(orderLine.quantity),
            '累计验收数量',
          );
          acceptedByDemand.set(line.demandId, cumulative);
        }
      }
      if (
        dto.status === 'accepted' &&
        ([...orderLines.keys()].some((id) => !dto.receivedLines.some((line) => line.demandId === id && line.status === 'accepted')) ||
          dto.receivedLines.some((line) => compareQuantity(line.quantity, String(orderLines.get(line.demandId)?.quantity)) !== 0))
      ) {
        throw new BadRequestException('整单验收通过必须完整覆盖全部采购行和数量');
      }
      if (dto.status === 'rejected' && dto.receivedLines.some((line) => line.status !== 'rejected')) {
        throw new BadRequestException('拒收单的全部收货行必须标记为拒收');
      }
      if (dto.status === 'partial' && !dto.receivedLines.some((line) => line.status === 'accepted')) {
        throw new BadRequestException('部分验收至少需要一条验收通过行');
      }
      const receiptSave = await this.saveIdempotent(repo, repo.create({
        receiptNo: this.businessNo('RGR'),
        purchaseOrderId: orderId,
        shipmentId: shipment.id,
        workOrderId,
        receiptMode: dto.receiptMode,
        warehouseId: dto.warehouseId ?? null,
        inspectionSnapshot: {
          ...dto.inspectionSnapshot,
          receivedLines: dto.receivedLines.map((line) => ({
            demandId: line.demandId,
            quantity: this.positiveDecimal(line.quantity, '收货数量'),
            status: line.status,
          })),
          inventoryEffect: 'none_requires_existing_inventory_transaction_binding',
        },
        receivedAt: new Date(dto.receivedAt),
        requestIdempotencyKey: dto.requestIdempotencyKey,
        requestFingerprint: fingerprint,
        status: dto.status,
        createdBy: currentUser.id,
      }), dto.requestIdempotencyKey, fingerprint);
      if (!receiptSave.created) return receiptSave.entity;
      const receipt = receiptSave.entity;
      if (dto.status !== 'rejected') {
        shipment.status = 'delivered';
        shipment.deliveredAt = receipt.receivedAt;
        shipment.version += 1;
        await manager.getRepository(RepairSupplierShipment).save(shipment);
        const fullyReceived = [...orderLines.entries()].every(([demandId, line]) =>
          isQuantityCovered(acceptedByDemand.get(demandId) ?? '0.00', String(line.quantity)),
        );
        order.status = fullyReceived ? 'received' : 'partially_received';
        order.updatedBy = currentUser.id;
        order.version += 1;
        await manager.getRepository(RepairPurchaseOrder).save(order);
      }
      await this.audit(manager, currentUser, receipt.id, 'goods_receipt_recorded', {
        workOrderId,
        purchaseOrderId: orderId,
        receiptMode: dto.receiptMode,
        inventoryMutationEffect: 'none',
      });
      return receipt;
    });
  }

  async bindAllocation(
    workOrderId: number,
    receiptId: number,
    dto: BindRepairProcurementAllocationDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const profile = await this.loadProfile(workOrderId, manager);
      await this.scopeService.assertAccess(currentUser, this.scopeOf(profile), 'repair.execute', manager);
      const fingerprint = this.fingerprint({ workOrderId, receiptId, ...dto });
      const repo = manager.getRepository(RepairProcurementAllocation);
      const replay = await this.assertIdempotentReplay(repo, dto.requestIdempotencyKey, fingerprint);
      if (replay) return replay;
      const receipt = await manager.getRepository(RepairGoodsReceipt).findOne({
        where: { id: receiptId, workOrderId }, lock: { mode: 'pessimistic_write' },
      });
      if (!receipt || receipt.status === 'rejected') throw new BadRequestException('收货记录不可用于配件关联');
      const demand = await manager.getRepository(RepairProcurementDemand).findOne({
        where: { id: dto.demandId, workOrderId }, lock: { mode: 'pessimistic_write' },
      });
      if (!demand) throw new NotFoundException('报料需求不存在');
      if (demand.status !== 'ordered') {
        throw new ConflictException('只有已下发且未完成的报料可以关联正式工单材料');
      }
      const order = await manager.getRepository(RepairPurchaseOrder).findOne({
        where: { id: receipt.purchaseOrderId, workOrderId },
      });
      if (!order || !order.lineSnapshot.some((line) => Number(line.demandId) === demand.id)) {
        throw new BadRequestException('报料需求不属于该收货采购单');
      }
      if (!dto.workOrderMaterialId) {
        throw new BadRequestException('材料关联必须绑定现有正式工单材料，采购模块不直接创建材料或改库存');
      }
      const materialId = dto.materialId ?? demand.materialId;
      if (!materialId) throw new BadRequestException('报料必须先绑定正式材料主档');
      const workOrderMaterial = await manager.getRepository(WorkOrderMaterial).findOne({
        where: { id: dto.workOrderMaterialId, workOrderId, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!workOrderMaterial || workOrderMaterial.materialId !== materialId) {
        throw new BadRequestException('工单材料与当前报料不一致');
      }
      let inventoryTransaction: InventoryTransaction | null = null;
      if (receipt.receiptMode === 'stock') {
        if (!dto.inventoryTransactionId || !receipt.warehouseId) {
          throw new BadRequestException('入库收货必须绑定仓库一致的正式入库流水');
        }
        inventoryTransaction = await manager.getRepository(InventoryTransaction).findOne({
          where: { id: dto.inventoryTransactionId }, lock: { mode: 'pessimistic_write' },
        });
        if (!inventoryTransaction) throw new BadRequestException('正式库存流水不存在');
        const transactionGate = evaluateFormalStockInventoryTransaction(inventoryTransaction, {
          warehouseId: receipt.warehouseId,
          materialId,
          workOrderId,
          workOrderMaterialId: workOrderMaterial.id,
        });
        if (!transactionGate.valid) {
          throw new BadRequestException(`库存流水不是当前收货的正式原始入库流水：${transactionGate.blockers.join(',')}`);
        }
      } else if (dto.inventoryTransactionId) {
        throw new BadRequestException('直达工单收货不得伪装为库存入库流水');
      }
      this.assertOpaqueRef(dto.linkEvidenceRef, '材料关联证据');
      const receivedLines = Array.isArray(receipt.inspectionSnapshot.receivedLines)
        ? receipt.inspectionSnapshot.receivedLines as Array<Record<string, unknown>>
        : [];
      const receivedLine = receivedLines.find((line) => Number(line.demandId) === demand.id && line.status === 'accepted');
      if (!receivedLine) throw new BadRequestException('该收货记录没有当前报料的验收通过行');
      const [receiptAllocations, demandAllocations, workOrderMaterialAllocations, inventoryAllocations] = await Promise.all([
        repo.find({ where: { receiptId, demandId: demand.id, status: In(['linked', 'installed']) } }),
        repo.find({ where: { workOrderId, demandId: demand.id, status: In(['linked', 'installed']) } }),
        repo.find({
          where: {
            workOrderId,
            workOrderMaterialId: workOrderMaterial.id,
            status: In(['linked', 'installed']),
          },
        }),
        inventoryTransaction
          ? repo.find({
              where: {
                inventoryTransactionId: inventoryTransaction.id,
                status: In(['linked', 'installed']),
              },
            })
          : Promise.resolve([]),
      ]);
      const requestedQuantity = this.positiveDecimal(dto.quantity, '关联数量');
      const receiptAllocatedQuantity = addQuantity(
        ...receiptAllocations.map((item) => item.quantity),
      );
      const demandAllocatedQuantity = addQuantity(
        ...demandAllocations.map((item) => item.quantity),
      );
      const workOrderMaterialAllocatedQuantity = addQuantity(
        ...workOrderMaterialAllocations.map((item) => item.quantity),
      );
      addQuantityWithinLimit(receiptAllocatedQuantity, requestedQuantity, String(receivedLine.quantity), '本次收货关联累计数量');
      addQuantityWithinLimit(demandAllocatedQuantity, requestedQuantity, demand.quantity, '报料关联累计数量');
      addQuantityWithinLimit(
        workOrderMaterialAllocatedQuantity,
        requestedQuantity,
        workOrderMaterial.quantity,
        '正式工单材料关联累计数量',
      );
      if (inventoryTransaction) {
        const inventoryAllocatedQuantity = addQuantity(
          ...inventoryAllocations.map((item) => item.quantity),
        );
        addQuantityWithinLimit(
          inventoryAllocatedQuantity,
          requestedQuantity,
          inventoryTransaction.quantity,
          '正式入库流水关联累计数量',
        );
      }
      const allocationSave = await this.saveIdempotent(repo, repo.create({
        receiptId,
        demandId: demand.id,
        workOrderId,
        materialId: materialId ?? null,
        workOrderMaterialId: workOrderMaterial.id,
        inventoryTransactionId: inventoryTransaction?.id ?? null,
        repairTaskId: null,
        quantity: requestedQuantity,
        linkEvidenceRef: dto.linkEvidenceRef.trim(),
        requestIdempotencyKey: dto.requestIdempotencyKey,
        requestFingerprint: fingerprint,
        status: 'linked',
        installedAt: null,
        createdBy: currentUser.id,
        updatedBy: null,
        version: 1,
      }), dto.requestIdempotencyKey, fingerprint);
      if (!allocationSave.created) return allocationSave.entity;
      const allocation = allocationSave.entity;
      await this.audit(manager, currentUser, allocation.id, 'procurement_allocation_bound', {
        workOrderId,
        receiptId,
        workOrderMaterialId: allocation.workOrderMaterialId,
        inventoryTransactionId: allocation.inventoryTransactionId,
        inventoryMutationEffect: 'none',
      });
      return allocation;
    });
  }

  async markInstalled(
    workOrderId: number,
    allocationId: number,
    dto: MarkRepairProcurementInstalledDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const profile = await this.loadProfile(workOrderId, manager);
      const repo = manager.getRepository(RepairProcurementAllocation);
      const allocationSnapshot = await repo.findOne({
        where: { id: allocationId, workOrderId },
      });
      if (!allocationSnapshot) throw new NotFoundException('材料关联不存在');
      const demand = await manager.getRepository(RepairProcurementDemand).findOne({
        where: { id: allocationSnapshot.demandId, workOrderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!demand) throw new NotFoundException('报料需求不存在');
      const allocation = await repo.findOne({
        where: { id: allocationId, workOrderId, demandId: demand.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!allocation) throw new NotFoundException('材料关联不存在');
      this.assertVersion(allocation.version, dto.expectedVersion);
      if (demand.status !== 'ordered') {
        throw new ConflictException('只有已下发且未完成的报料可以登记安装');
      }
      await this.scopeService.assertAssignedTechnicianOrSupervisor(
        currentUser,
        this.scopeOf(profile),
        (await manager.getRepository(RepairTask).findOne({ where: { id: dto.repairTaskId, workOrderId } }))
          ?.technicianEmployeeId ?? null,
        manager,
      );
      const task = await manager.getRepository(RepairTask).findOne({
        where: { id: dto.repairTaskId, workOrderId, status: 'completed' },
      });
      if (!task) throw new BadRequestException('只有已完成的同工单维修任务可以登记安装');
      if (!allocation.workOrderMaterialId) throw new BadRequestException('安装前必须绑定正式工单材料');
      const workOrderMaterial = await manager.getRepository(WorkOrderMaterial).findOne({
        where: { id: allocation.workOrderMaterialId, workOrderId, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!workOrderMaterial || workOrderMaterial.materialId !== allocation.materialId) {
        throw new BadRequestException('正式工单材料已停用或与安装关联不一致');
      }
      const activeMaterialAllocations = await repo.find({
        where: {
          workOrderId,
          workOrderMaterialId: workOrderMaterial.id,
          status: In(['linked', 'installed']),
        },
      });
      const activeMaterialQuantity = addQuantity(
        ...activeMaterialAllocations.map((item) => item.quantity),
      );
      if (compareQuantity(activeMaterialQuantity, workOrderMaterial.quantity) > 0) {
        throw new ConflictException('正式工单材料数量已减少，当前关联累计数量不能登记安装');
      }
      const partLink = await manager.getRepository(RepairPartLink).findOne({
        where: { workOrderId, taskId: task.id, workOrderMaterialId: allocation.workOrderMaterialId },
      });
      if (!partLink || partLink.quoteLineRef !== demand.quoteLineRef) {
        throw new BadRequestException('维修任务、正式工单材料和客户确认报价行未形成一致关联');
      }
      if (allocation.status !== 'linked') throw new ConflictException('材料关联当前不能登记安装');
      allocation.status = 'installed';
      allocation.repairTaskId = task.id;
      allocation.installedAt = new Date();
      allocation.updatedBy = currentUser.id;
      allocation.version += 1;
      await repo.save(allocation);
      const installedAllocations = await repo.find({
        where: { workOrderId, demandId: demand.id, status: 'installed' },
      });
      const installedQuantity = addQuantity(...installedAllocations.map((item) => item.quantity));
      const fullyInstalled = isQuantityCovered(installedQuantity, demand.quantity);
      demand.status = fullyInstalled ? 'fulfilled' : 'ordered';
      demand.updatedBy = currentUser.id;
      demand.version += 1;
      await manager.getRepository(RepairProcurementDemand).save(demand);
      await this.audit(manager, currentUser, allocation.id, 'procured_part_installed', {
        workOrderId,
        repairTaskId: task.id,
        workOrderMaterialId: allocation.workOrderMaterialId,
        installedQuantity,
        demandQuantity: demand.quantity,
        demandFulfilled: fullyInstalled,
        taskMutationEffect: 'none_existing_completed_task_only',
      });
      return allocation;
    });
  }

  async createWarrantyClaim(
    workOrderId: number,
    dto: CreateRepairSupplierWarrantyClaimDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const profile = await this.loadProfile(workOrderId, manager);
      await this.scopeService.assertAccess(currentUser, this.scopeOf(profile), 'warranty.manage', manager);
      const fingerprint = this.fingerprint({ workOrderId, ...dto });
      const repo = manager.getRepository(RepairSupplierWarrantyClaim);
      const replay = await this.assertIdempotentReplay(repo, dto.requestIdempotencyKey, fingerprint);
      if (replay) return replay;
      const allocation = await manager.getRepository(RepairProcurementAllocation).findOne({
        where: { id: dto.allocationId, receiptId: dto.receiptId, workOrderId, status: 'installed' },
      });
      const receipt = await manager.getRepository(RepairGoodsReceipt).findOne({
        where: { id: dto.receiptId, purchaseOrderId: dto.purchaseOrderId, workOrderId },
      });
      const order = await manager.getRepository(RepairPurchaseOrder).findOne({
        where: { id: dto.purchaseOrderId, workOrderId },
      });
      if (!allocation || !receipt || !order) throw new BadRequestException('供应商售后链路引用不一致');
      if (dto.repairWarrantyRecordId) {
        const warranty = await manager.getRepository(RepairWarrantyRecord).findOne({
          where: { id: dto.repairWarrantyRecordId, workOrderId },
        });
        if (!warranty) throw new BadRequestException('汽修保修记录不属于当前工单');
      }
      dto.evidenceRefs.forEach((ref) => this.assertOpaqueRef(ref, '售后证据'));
      this.assertSafeEvidenceSnapshot(dto.issueSnapshot, '供应商售后问题快照');
      const claimSave = await this.saveIdempotent(repo, repo.create({
        claimNo: this.businessNo('RWC'),
        purchaseOrderId: order.id,
        receiptId: receipt.id,
        allocationId: allocation.id,
        workOrderId,
        supplierId: order.supplierId,
        repairWarrantyRecordId: dto.repairWarrantyRecordId ?? null,
        issueSnapshot: dto.issueSnapshot,
        evidenceRefs: dto.evidenceRefs.map((item) => item.trim()),
        requestIdempotencyKey: dto.requestIdempotencyKey,
        requestFingerprint: fingerprint,
        status: 'draft',
        createdBy: currentUser.id,
      }), dto.requestIdempotencyKey, fingerprint);
      if (!claimSave.created) return claimSave.entity;
      const claim = claimSave.entity;
      await this.audit(manager, currentUser, claim.id, 'supplier_warranty_claim_drafted', {
        workOrderId,
        supplierId: order.supplierId,
        externalSubmissionEffect: 'none_draft_only',
      });
      return claim;
    });
  }

  private async loadProfile(workOrderId: number, manager: EntityManager) {
    await assertQuotedRepairRoot(workOrderId, manager);
    const profile = await manager.getRepository(RepairWorkOrderProfile).findOne({ where: { workOrderId } });
    if (!profile) throw new NotFoundException('汽修工单档案不存在');
    if (prequoteAdmission(profile)) throw new BadRequestException('[repair_prequote_only] 报价前档案不可用于采购');
    return profile;
  }

  private async loadVehicleScope(
    vehicleId: number,
    currentUser: CurrentUser,
    manager: EntityManager,
    lockVehicle = false,
  ) {
    const vehicle = await manager.getRepository(RepairVehicleProfile).findOne({
      where: { id: vehicleId },
      ...(lockVehicle ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!vehicle) throw new NotFoundException('车辆档案不存在');
    const links = await manager.getRepository(RepairVehicleCustomerLink).find({
      where: { vehicleId, confirmationStatus: 'confirmed', status: 'active' },
      order: { validFrom: 'DESC' },
    });
    for (const link of links) {
      const scope = this.scopeOf(link);
      try {
        await this.scopeService.assertAccess(currentUser, scope, 'vehicle.manage', manager);
        return { vehicle, scope };
      } catch (error) {
        if (!(error instanceof ForbiddenException)) throw error;
      }
    }
    throw new ForbiddenException('[business_scope_denied] 无权管理该车辆 VIN 证据');
  }

  private async loadDemandForUpdate(workOrderId: number, demandId: number, manager: EntityManager) {
    const profile = await this.loadProfile(workOrderId, manager);
    const demand = await manager.getRepository(RepairProcurementDemand).findOne({
      where: { id: demandId, workOrderId }, lock: { mode: 'pessimistic_write' },
    });
    if (!demand) throw new NotFoundException('报料需求不存在');
    return { profile, demand };
  }

  private async loadOrderForUpdate(workOrderId: number, orderId: number, manager: EntityManager) {
    const profile = await this.loadProfile(workOrderId, manager);
    const order = await manager.getRepository(RepairPurchaseOrder).findOne({
      where: { id: orderId, workOrderId }, lock: { mode: 'pessimistic_write' },
    });
    if (!order) throw new NotFoundException('采购单不存在');
    return { profile, order };
  }

  private async assertPlanAndQuoteItem(
    profile: RepairWorkOrderProfile,
    dto: Pick<
      CreateRepairProcurementDemandDto,
      | 'planVersion'
      | 'quoteVersion'
      | 'planItemRef'
      | 'quoteLineRef'
      | 'oeNumber'
      | 'partName'
      | 'quantity'
      | 'materialId'
    >,
    manager: EntityManager,
  ) {
    if (
      profile.activePlanVersion !== dto.planVersion ||
      profile.activeQuoteVersion !== dto.quoteVersion
    ) {
      throw new BadRequestException('报料必须引用当前生效方案和报价版本');
    }
    const documents = await manager.getRepository(RepairDocumentVersion).find({
      where: {
        workOrderId: profile.workOrderId,
        documentType: In(['repair_plan', 'quote']),
        status: 'authorized',
      },
    });
    const plan = documents.find((item) => item.documentType === 'repair_plan' && item.version === dto.planVersion);
    const quote = documents.find((item) => item.documentType === 'quote' && item.version === dto.quoteVersion);
    if (!plan || !quote) {
      throw new BadRequestException('报料必须精确绑定已批准方案项目和报价行');
    }
    assertRepairProcurementDocumentBinding(plan.payload, quote.payload, dto);
  }

  private async assertDecisionReferences(
    workOrderId: number,
    demand: RepairProcurementDemand,
    quote: RepairSupplierQuote,
    dto: Pick<CreateRepairProcurementDecisionDto, 'approvalMode' | 'customerConfirmationRequestId' | 'approvalRequestId'>,
    manager: EntityManager,
  ) {
    if (['customer', 'both'].includes(dto.approvalMode) && !dto.customerConfirmationRequestId) {
      throw new BadRequestException('客户授权模式必须绑定客户确认请求');
    }
    if (['leader', 'both'].includes(dto.approvalMode) && !dto.approvalRequestId) {
      throw new BadRequestException('领导授权模式必须绑定总部审批请求');
    }
    if (dto.customerConfirmationRequestId) {
      const confirmation = await manager.getRepository(RepairConfirmationRequest).findOne({
        where: { id: dto.customerConfirmationRequestId, workOrderId },
      });
      if (
        !confirmation ||
        confirmation.planVersion !== demand.planVersion ||
        confirmation.quoteVersion !== demand.quoteVersion
      ) {
        throw new BadRequestException('客户确认请求与报料方案/报价版本不一致');
      }
    }
    if (dto.approvalRequestId) {
      const approval = await manager.getRepository(ApprovalRequest).findOne({
        where: { id: dto.approvalRequestId },
      });
      if (!approval || !this.leaderApprovalMatchesSelection(approval, workOrderId, demand, quote)) {
        throw new BadRequestException('总部审批未精确绑定当前工单、报料、报价、供应商、版本和金额');
      }
      const approvalAlreadyUsed = await manager.getRepository(RepairProcurementDecision).findOne({
        where: { approvalRequestId: dto.approvalRequestId },
      });
      if (approvalAlreadyUsed) {
        throw new ConflictException('该总部审批已经绑定其他汽修采购决策');
      }
    }
  }

  private async resolveDecisionStatus(
    workOrderId: number,
    demand: RepairProcurementDemand,
    quote: RepairSupplierQuote,
    dto: Pick<CreateRepairProcurementDecisionDto, 'approvalMode' | 'customerConfirmationRequestId' | 'approvalRequestId'>,
    manager: EntityManager,
  ): Promise<RepairProcurementDecision['decisionStatus']> {
    let customer: RepairConfirmationRequest | null = null;
    let approval: ApprovalRequest | null = null;
    if (dto.customerConfirmationRequestId) {
      customer = await manager.getRepository(RepairConfirmationRequest).findOne({
        where: { id: dto.customerConfirmationRequestId, workOrderId },
      });
    }
    if (dto.approvalRequestId) {
      approval = await manager.getRepository(ApprovalRequest).findOne({ where: { id: dto.approvalRequestId } });
    }
    const leaderBindingMatches = approval
      ? this.leaderApprovalMatchesSelection(approval, workOrderId, demand, quote)
      : false;
    if (customer?.status === 'rejected' || (leaderBindingMatches && approval?.currentStatus === 'rejected')) {
      return 'rejected';
    }
    const customerOk = Boolean(
      customer?.status === 'confirmed' &&
      customer.planVersion === demand.planVersion &&
      customer.quoteVersion === demand.quoteVersion,
    );
    const leaderOk = Boolean(
      leaderBindingMatches &&
      approval?.currentStatus === 'approved' &&
      Number.isInteger(approval.finalApproverId) &&
      Number(approval.finalApproverId) > 0,
    );
    if (dto.approvalMode === 'customer') return customerOk ? 'approved' : 'customer_confirmation_pending';
    if (dto.approvalMode === 'leader') return leaderOk ? 'approved' : 'leader_approval_pending';
    return customerOk && leaderOk ? 'approved' : 'both_pending';
  }

  private leaderApprovalMatchesSelection(
    approval: ApprovalRequest,
    workOrderId: number,
    demand: RepairProcurementDemand,
    quote: RepairSupplierQuote,
  ) {
    const selectedTotal = addMoney(multiplyMoney(quote.quantity, quote.unitPrice), quote.freightAmount);
    const binding = buildRepairProcurementLeaderApprovalBinding({
      workOrderId,
      demandId: demand.id,
      selectedQuoteId: quote.id,
      supplierId: quote.supplierId,
      planVersion: demand.planVersion,
      authorizedQuoteVersion: demand.quoteVersion,
      supplierQuoteVersion: quote.quoteVersion,
      quantity: quote.quantity,
      unitPrice: quote.unitPrice,
      freightAmount: quote.freightAmount,
      totalAmount: selectedTotal,
    });
    return (
      approval.approvalType === ApprovalType.PAYOUT &&
      approval.relatedWorkOrderId === workOrderId &&
      compareMoney(approval.amount, selectedTotal) === 0 &&
      approval.requestIdempotencyKey === binding.requestIdempotencyKey &&
      approval.requestFingerprint === binding.requestFingerprint
    );
  }

  private scopeOf(resource: {
    companyRef: string;
    businessSectorRef: string;
    storeRef?: string;
    initialServiceStoreRef?: string;
    customerRef: string;
  }): RepairResourceScope {
    return {
      companyRef: resource.companyRef,
      businessSectorRef: resource.businessSectorRef,
      storeRef: resource.storeRef ?? resource.initialServiceStoreRef ?? '',
      customerRef: resource.customerRef,
    };
  }

  private async hasScopedAccess(
    currentUser: CurrentUser,
    scope: RepairResourceScope,
    permission: RepairPermission,
    manager: EntityManager,
  ) {
    try {
      await this.scopeService.assertAccess(currentUser, scope, permission, manager);
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) return false;
      throw error;
    }
  }

  private async assertIdempotentReplay<T extends { requestIdempotencyKey: string; requestFingerprint: string }>(
    repo: Repository<T>,
    key: string,
    fingerprint: string,
  ) {
    const existing = await repo.findOne({
      where: { requestIdempotencyKey: key } as never,
      lock: { mode: 'pessimistic_write' },
    });
    if (!existing) return null;
    if (existing.requestFingerprint !== fingerprint) {
      throw new ConflictException('幂等键已用于不同请求');
    }
    return existing;
  }

  private async saveIdempotent<T extends { requestIdempotencyKey: string; requestFingerprint: string }>(
    repo: Repository<T>,
    entity: T,
    key: string,
    fingerprint: string,
  ) {
    try {
      return { entity: await repo.save(entity), created: true };
    } catch (error) {
      if (!this.isIdempotencyDuplicate(error)) throw error;
      const existing = await repo.findOne({ where: { requestIdempotencyKey: key } as never });
      if (!existing) throw error;
      if (existing.requestFingerprint !== fingerprint) {
        throw new ConflictException('幂等键已用于不同请求');
      }
      return { entity: existing, created: false };
    }
  }

  private isIdempotencyDuplicate(error: unknown) {
    const candidate = error as QueryFailedError & {
      driverError?: { code?: string; errno?: number; message?: string };
    };
    const message = candidate?.driverError?.message ?? '';
    return (
      candidate?.driverError?.code === 'ER_DUP_ENTRY' &&
      /idempotency|request_idempotency_key/i.test(message)
    );
  }

  private assertVersion(actual: number, expected: number) {
    if (actual !== expected) throw new ConflictException(`版本冲突：当前 ${actual}，请求 ${expected}`);
  }

  private fingerprint(value: unknown) {
    return createHash('sha256').update(JSON.stringify(this.canonicalize(value))).digest('hex');
  }

  private canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.canonicalize(item));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, this.canonicalize(item)]),
    );
  }

  private childIdempotencyKey(base: string, childId: number) {
    const suffix = `:${childId}`;
    if (base.length + suffix.length <= 96) return `${base}${suffix}`;
    return `${base.slice(0, 47)}:${this.fingerprint({ base, childId }).slice(0, 48)}`;
  }

  private businessNo(prefix: string) {
    const time = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    return `${prefix}${time}${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  }

  private assertOpaqueRef(value: string, label: string) {
    assertSafeRepairEvidenceRef(value, label);
  }

  private assertSafeEvidenceSnapshot(value: unknown, label: string) {
    assertSafeRepairEvidenceSnapshot(value, label);
  }

  private paymentIntentMatchesOrder(
    intent: ApprovalPaymentIntent,
    order: RepairPurchaseOrder,
    companyRegistryId: number | null,
  ) {
    return evaluateRepairProcurementPaymentIntentReadiness(intent, {
      id: order.id,
      workOrderId: order.workOrderId,
      supplierId: order.supplierId,
      paymentApprovalRequestId: order.paymentApprovalRequestId,
      companyRegistryId,
      businessSectorRef: order.businessSectorRef,
      totalAmount: order.totalAmount,
    }).valid;
  }

  private async resolveCompanyRegistryId(companyRef: string, manager: EntityManager) {
    const binding = await manager.getRepository(BusinessCompanyRef).findOne({
      where: { companyRef, status: 'active' },
    });
    return binding?.companyRegistryId ?? null;
  }

  private positiveDecimal(value: string, label: string) {
    const normalized = normalizeQuantity(value);
    if (compareQuantity(normalized, '0.00') <= 0) throw new BadRequestException(`${label}必须大于 0`);
    return normalized;
  }

  private nonNegativeDecimal(value: string, label: string) {
    const normalized = normalizeMoney(value);
    if (compareMoney(normalized, '0.00') < 0) throw new BadRequestException(`${label}不能小于 0`);
    return normalized;
  }

  private audit(
    manager: EntityManager,
    currentUser: CurrentUser,
    targetId: number,
    action: string,
    detailJson: Record<string, unknown>,
  ) {
    return this.operationLogsService.create({
      module: 'repair_shop_procurement',
      targetId,
      action,
      operatorId: currentUser.id,
      detailJson,
    }, manager);
  }
}
