import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, EntityManager, Like } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { maskPhoneNumber } from '../../common/utils/contact-permission.util';
import { BIZ_SEQUENCE_CONFIG } from '../../shared/constants/biz-sequence.constant';
import { OperationLogAction } from '../../shared/enums/operation-log-action.enum';
import { WorkOrderStatus } from '../../shared/enums/work-order-status.enum';
import { BusinessFoundationService } from '../business-foundation/business-foundation.service';
import { BusinessStore } from '../business-foundation/entities/business-foundation.entities';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { SequenceService } from '../sequence/sequence.service';
import { User } from '../users/entities/user.entity';
import { RepairWorkOrderProfile, RepairDocumentVersion, OWNER_INTAKE_PROPOSAL_TYPE } from '../repair-shop/entities/repair-shop.entities';
import { nativeReviewWhere } from '../repair-shop/repair-first-visit.policy';
import { CreateWorkOrderIntakeDto } from './dto/create-work-order-intake.dto';
import { UpdateWorkOrderIntakeDetailsDto } from './dto/update-work-order-intake-details.dto';
import { WorkOrder } from './entities/work-order.entity';
import { CustomerIdentificationBinding } from '../performance/entities/customer-identification-binding.entity';
import { SaveIntakeAssociationDto } from './dto/save-intake-association.dto';
import { SaveIntakeProposalDto } from './dto/save-intake-proposal.dto';
import { INTAKE_PROPOSAL_CONTRACT, normalizeIntakeProposal, proposalAmounts, proposalRequestHash,
  proposalSnapshot, proposalSummary } from './work-order-intake-proposal.policy';
import { INTAKE_ASSOCIATION_CONTRACT, INTAKE_ASSOCIATION_SOURCE, INTAKE_ASSOCIATION_TABLE, intakeAssociationHash,
  intakeAssociationSnapshot, intakeAssociationSourceHash, normalizeIntakeAssociation } from './work-order-intake-association.policy';
import { decodeIntakeMetadata, encodeIntakeMetadata, INTAKE_PREFIX, normalizeIntakeDetails, safeIntakeText } from './work-order-intake.policy';

@Injectable()
export class WorkOrderIntakeService {
  constructor(private readonly dataSource: DataSource, private readonly scope: BusinessFoundationService,
    private readonly sequence: SequenceService, private readonly logs: OperationLogsService) {}

  private async actor(currentUser: CurrentUser, manager: EntityManager): Promise<CurrentUser> {
    if (currentUser.identitySource !== 'trusted_proxy' || !manager.queryRunner?.isTransactionActive) {
      throw new ForbiddenException('[intake_identity_required] 需要正式登录身份');
    }
    const user = await manager.getRepository(User).findOne({
      where: { id: currentUser.id, username: currentUser.username, status: 1 },
      relations: { userRoles: { role: true } }, lock: { mode: 'pessimistic_read' },
    });
    const roles = (user?.userRoles ?? []).map((r) => r.role?.code).filter(Boolean);
    if (!user || !roles.some((r) => ['owner', 'admin', 'operator'].includes(r))) {
      throw new ForbiddenException('[intake_actor_revoked] 当前用户已失效或无接车权限');
    }
    return { ...currentUser, roleCodes: roles };
  }

  async stores(currentUser: CurrentUser) {
    return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      const actor = await this.actor(currentUser, manager);
      const candidates = await manager.getRepository(BusinessStore).find({
        where: { status: 'active' }, order: { id: 'ASC' }, take: 100,
      });
      const stores: Array<{ storeRef: string; name: string }> = [];
      for (const store of candidates) {
        try {
          const access = await this.scope.assertStoreIntakeAccess(actor, store.storeRef, manager);
          stores.push({ storeRef: access.storeRef, name: access.storeName });
        } catch (error) {
          if (!(error instanceof ForbiddenException)) throw error;
        }
      }
      return { stores, registrationOnly: true };
    });
  }

  async create(dto: CreateWorkOrderIntakeDto, currentUser: CurrentUser) {
    const title = safeIntakeText(dto.title);
    const customerName = safeIntakeText(dto.customerName);
    const model = safeIntakeText(dto.vehicleModel);
    const plate = dto.plateNumber.trim().toUpperCase();
    const key = dto.requestId.toLowerCase();
    for (let attempt = 0; ; attempt++) {
    try { return await this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      const actor = await this.actor(currentUser, manager);
      const access = await this.scope.assertStoreIntakeAccess(actor, dto.storeRef, manager);
      // Existing sequences mutex provides cross-process serialization without a new table.
      await manager.query(`INSERT INTO sequences (biz_type, biz_date, current_value, created_at, updated_at)
        VALUES (?, ?, 0, NOW(), NOW()) ON DUPLICATE KEY UPDATE current_value = current_value`,
      ['work_order_intake_create_mutex', '1970-01-01']);
      const repo = manager.getRepository(WorkOrder);
      const existing = await repo.findOne({
        where: { createdBy: actor.id, remark: Like(`${INTAKE_PREFIX}%"k":"${key}"%`) },
        lock: { mode: 'pessimistic_write' },
      });
      if (existing) {
        const prior = decodeIntakeMetadata(existing.remark);
        if (!prior || existing.status !== WorkOrderStatus.DRAFT || prior.s !== access.storeRef
          || prior.c !== access.companyRef || prior.p !== plate || prior.m !== model
          || existing.title !== title || existing.customerName !== customerName
          || existing.customerMobile !== dto.customerMobile) {
          throw new ConflictException('[intake_idempotency_conflict] 该请求已登记不同资料，请先核对原工单');
        }
        return { ...this.view(existing), replayed: true };
      }
      const remark = encodeIntakeMetadata({ v: 1, k: key, s: access.storeRef, c: access.companyRef,
        sv: access.storeVersion, sn: access.storeName, p: plate, m: model });
      const workOrderNo = await this.sequence.generateBizNo(BIZ_SEQUENCE_CONFIG.WORK_ORDER.bizType,
        BIZ_SEQUENCE_CONFIG.WORK_ORDER.prefix, manager);
      const saved = await repo.save(repo.create({ workOrderNo, title, customerName,
        customerMobile: dto.customerMobile,
        // Legacy non-null columns have a storage placeholder ONLY. DRAFT is never a quoted zero.
        // Every intake read returns null and every downstream financial writer rejects DRAFT.
        amountDue: '0.00', amountReceived: '0.00', materialCostTotal: '0.00',
        status: WorkOrderStatus.DRAFT, responsibleUserId: actor.id, createdBy: actor.id, remark }));
      await this.logs.create({ module: 'work_order', targetId: saved.id,
        action: OperationLogAction.CREATE_WORK_ORDER, operatorId: actor.id,
        detail: `创建待报价接车草稿 ${saved.workOrderNo}`,
        detailJson: { kind: 'unquoted_intake_v1', requestId: key, storeRef: access.storeRef,
          storeVersion: access.storeVersion, source: 'owner_intake', status: 'draft',
          financialEffect: false, personalDataIncluded: false } }, manager);
      return { ...this.view(saved), replayed: false };
    }); } catch (error) {
      // QueryFailedError includes SQL parameters (phone). Never let it reach the global logger.
      if (error instanceof HttpException) throw error;
      // InnoDB deadlock 1213 definitively rolls back the victim transaction. Start a
      // fresh transaction and recheck current authority; never retry an ambiguous
      // connection/commit failure, timeout, audit error, or arbitrary application error.
      const driver = (error as { driverError?: { errno?: unknown; code?: unknown } })?.driverError;
      if (driver?.errno === 1213 && driver.code === 'ER_LOCK_DEADLOCK' && attempt < 4) {
        await new Promise((done) => setTimeout(done, 25 * (attempt + 1)));
        continue;
      }
      throw new ServiceUnavailableException('[intake_request_unconfirmed] 暂未确认登记结果，请使用同一请求重试');
    }
    }
  }

  async findByRequest(requestId: string, currentUser: CurrentUser) {
    return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      const actor = await this.actor(currentUser, manager);
      const order = await manager.getRepository(WorkOrder).findOne({ where: {
        createdBy: actor.id, remark: Like(`${INTAKE_PREFIX}%"k":"${requestId.toLowerCase()}"%`),
      } });
      return this.authorizeRead(order, actor, manager);
    });
  }

  async updateDetails(id: number, dto: UpdateWorkOrderIntakeDetailsDto, currentUser: CurrentUser) {
    const values = normalizeIntakeDetails(dto);
    const key = typeof dto.requestId === 'string' ? dto.requestId.toLowerCase() : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(key)
      || !Number.isInteger(dto.expectedRevision) || dto.expectedRevision < 0 || dto.expectedRevision > 2147483646) {
      throw new BadRequestException('[intake_details_invalid] 请求号或资料版本无效');
    }
    try {
      return await this.dataSource.transaction('REPEATABLE READ', async (manager) => {
        const actor = await this.actor(currentUser, manager);
        const repo = manager.getRepository(WorkOrder);
        // Read the owner's scope hint, lock current authority first, then lock the root.
        const hint = await repo.findOne({ where: { id, createdBy: actor.id } });
        const hinted = decodeIntakeMetadata(hint?.remark);
        if (!hint || hint.status !== WorkOrderStatus.DRAFT || !hinted) throw new NotFoundException('接车草稿不存在或不可访问');
        const access = await this.scope.assertStoreIntakeAccess(actor, hinted.s, manager);
        const order = await repo.findOne({ where: { id, createdBy: actor.id }, lock: { mode: 'pessimistic_write' } });
        const meta = decodeIntakeMetadata(order?.remark);
        if (!order || order.status !== WorkOrderStatus.DRAFT || !meta) throw new NotFoundException('接车草稿不存在或不可访问');
        if (meta.s !== hinted.s || meta.c !== hinted.c || access.companyRef !== meta.c) {
          throw new ForbiddenException('[intake_store_changed] 门店归属已变化，请重新核验');
        }
        const prior = meta.d;
        // Retry identity is (root, expected revision, UUID, exact normalized snapshot).
        // Older requests after a later edit fail closed rather than overwrite that edit.
        if (prior?.q === key && prior.r === dto.expectedRevision + 1) {
          if (prior.v !== values.v || prior.o !== values.o || prior.t !== values.t) {
            throw new ConflictException('[intake_details_conflict] 同一请求包含不同资料，请重新读取');
          }
          return { ...this.view(order), replayed: true };
        }
        if ((prior?.r ?? 0) !== dto.expectedRevision) {
          throw new ConflictException('[intake_details_stale] 资料已更新，请读取最新版本后核对');
        }
        // Same root-first order as admission. Once admitted, edits cannot silently
        // change the verified snapshot; exact prior-save replay above remains read-only.
        const admitted = await manager.getRepository(RepairWorkOrderProfile).findOne({
          where: { workOrderId: id }, lock: { mode: 'pessimistic_read' },
        });
        if (admitted || await this.hasNativeReview(id, manager)) throw new ConflictException('[intake_details_frozen] 已独立核实或接入报价前流程，接车资料已冻结；请核对原档案');
        const revision = dto.expectedRevision + 1;
        order.remark = encodeIntakeMetadata({ ...meta, d: { r: revision, q: key, ...values } });
        await repo.save(order);
        await this.logs.create({ module: 'work_order', targetId: order.id,
          action: OperationLogAction.UPDATE_WORK_ORDER, operatorId: actor.id,
          detail: `补充待核实接车资料 ${order.workOrderNo}`,
          detailJson: { kind: 'unquoted_intake_details_v1', requestId: key,
            fromRevision: dto.expectedRevision, toRevision: revision,
            fieldsPresent: { vin: values.v !== null, odometerKm: values.o !== null, requestedService: values.t !== null },
            status: 'draft', verificationStatus: 'pending', financialEffect: false, personalDataIncluded: false } }, manager);
        return { ...this.view(order), replayed: false };
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // No SQL, VIN, contact, or submitted text may escape through the global logger.
      // Ambiguous failures are resolved by GET or retry of this same revision/request.
      throw new ServiceUnavailableException('[intake_details_unconfirmed] 暂未确认保存结果，请重新读取或重试同一提交');
    }
  }

  /** External mobile handoff: current authority, same root, typed presence only.
   * No names, contacts, VIN, plate, service text or caller-supplied return URL.
   * The sole write is the mandatory query audit, committed before returning.
   */
  async captureSummary(id: number, currentUser: CurrentUser) {
    if (!Number.isSafeInteger(id) || id < 1 || id > 999999999) throw new NotFoundException('接车草稿不存在或不可访问');
    try {
      return await this.dataSource.transaction('REPEATABLE READ', async (manager) => {
        const { actor, order, meta } = await this.associationContext(id, currentUser, manager, false);
        const binding = await manager.getRepository(CustomerIdentificationBinding).findOne({
          where: { sourceSystem: INTAKE_ASSOCIATION_SOURCE, sourceTable: INTAKE_ASSOCIATION_TABLE, sourceId: String(id) },
          lock: { mode: 'pessimistic_read' },
        });
        const relation = this.associationView(order, binding).draft;
        const profile = await manager.getRepository(RepairWorkOrderProfile).findOne({
          where: { workOrderId: id }, lock: { mode: 'pessimistic_read' },
        });
        const requestId = `req_${randomUUID()}`;
        const projection = {
          workOrderId: id, detailsRevision: meta.d?.r ?? 0,
          fieldsPresent: { vin: Boolean(meta.d?.v), odometerKm: meta.d?.o != null, requestedService: Boolean(meta.d?.t) },
          association: { state: relation ? relation.sourceCurrent ? 'pending_current' : 'pending_stale' : 'absent',
            revision: relation?.revision ?? 0, intakeRevision: relation?.intakeRevision ?? 0 },
          intakeEditsFrozen: Boolean(profile) || await this.hasNativeReview(id, manager), verificationStatus: 'pending',
          financialEffect: false, wagesAvailable: false,
        };
        const audit = await this.logs.create({ module: 'work_order', targetId: id,
          action: 'view_owner_intake_capture_summary', operatorId: actor.id,
          detail: '读取原单待核实采集状态',
          detailJson: { kind: 'owner_intake_capture_summary_v1', requestId, ...projection,
            source: 'authenticated_capture_query', personalDataIncluded: false, businessWriteCounter: 0 } }, manager);
        if (!Number.isSafeInteger(audit?.id) || audit.id < 1 || audit.id > 999999999999999) {
          throw new Error('capture audit unavailable');
        }
        return { contractVersion: 'owner_intake_capture_summary_v1', requestId,
          auditRef: `operation-log:${audit.id}`, ...projection };
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('[intake_capture_unavailable] 暂不能读取采集状态');
    }
  }

  /** Reuse the existing pending-identification inbox, never manufacture a legacy match. */
  async saveAssociation(id: number, dto: SaveIntakeAssociationDto, currentUser: CurrentUser) {
    const input = normalizeIntakeAssociation(dto);
    try {
      return await this.dataSource.transaction('REPEATABLE READ', async (manager) => {
        const { actor, order, meta } = await this.associationContext(id, currentUser, manager, true);
        if (!meta.d?.v || meta.d.r !== dto.expectedIntakeRevision) {
          throw new ConflictException('[intake_association_source_stale] 请先保存实际 VIN 并重新读取原单资料版本');
        }
        const mobile = (order.customerMobile ?? '').replace(/\D/g, '').replace(/^86(?=1\d{10}$)/, '');
        if (!/^1[3-9]\d{9}$/.test(mobile)) throw new ConflictException('[intake_association_contact_missing] 原单联系资料需要核对');
        const repo = manager.getRepository(CustomerIdentificationBinding);
        const where = { sourceSystem: INTAKE_ASSOCIATION_SOURCE, sourceTable: INTAKE_ASSOCIATION_TABLE, sourceId: String(id) };
        const binding = await repo.findOne({ where, lock: { mode: 'pessimistic_write' } });
        const prior = binding ? intakeAssociationSnapshot(binding) : null;
        const sourceHash = intakeAssociationSourceHash(order);
        const requestHash = intakeAssociationHash([id, actor.id, dto.expectedIntakeRevision, dto.expectedDraftRevision,
          sourceHash, input.customerName, mobile, meta.p, input.relationshipType, input.requestId]);
        if (prior && prior.actorId !== actor.id) throw new ForbiddenException('[intake_association_owner_changed] 原资料提交身份不匹配');
        if (prior?.requestId === input.requestId && prior.revision === dto.expectedDraftRevision + 1) {
          if (prior.requestHash !== requestHash || binding!.sourceCustomerName !== input.customerName
            || binding!.sourceCustomerMobile !== mobile || binding!.sourceCarPlate !== meta.p) {
            throw new ConflictException('[intake_association_replay_conflict] 同一请求的资料已变化，请回读核对');
          }
          return { ...this.associationView(order, binding), replayed: true };
        }
        if ((prior?.revision ?? 0) !== dto.expectedDraftRevision) {
          throw new ConflictException('[intake_association_stale] 已有更新的关联资料，请先回读');
        }
        const attached = await manager.getRepository(RepairWorkOrderProfile).findOne({
          where: { workOrderId: id }, lock: { mode: 'pessimistic_read' },
        });
        if (attached || await this.hasNativeReview(id, manager)) throw new ConflictException('[intake_association_frozen] 已独立核实或接入报价前档案，不能另行覆盖来源');
        const revision = dto.expectedDraftRevision + 1;
        const saved = await repo.save(repo.create({ ...(binding ?? {}), ...where,
          sourceCustomerName: input.customerName, sourceCustomerMobile: mobile, sourceCarPlate: meta.p,
          matchedCustomerId: null, matchedCustomerName: null, matchedCustomerMobile: null,
          bindingStatus: 'manual_pending', bindingConfidence: null, boundBy: null, boundAt: null,
          bindingRemark: '原单客户与车辆关系声明：已采集，待独立核实；不是历史客户匹配',
          performanceReadyFlag: false, performanceBlockReason: 'native_intake_unverified',
          performanceDecisionReason: null, taskExecutionCount: null, taskOnTimeCount: null, taskConfirmedCount: null,
          taskRewardEligibleFlag: null, aiTaskScore: null, aiTaskRemark: null,
          normalizedPayload: { contract: INTAKE_ASSOCIATION_CONTRACT, actorId: actor.id, revision,
            intakeRevision: meta.d.r, requestId: input.requestId, requestHash, sourceHash, relationshipType: input.relationshipType },
        }));
        await this.logs.create({ module: 'work_order', targetId: id, action: OperationLogAction.UPDATE_WORK_ORDER,
          operatorId: actor.id, detail: `保存原单客户车辆待核实资料 ${order.workOrderNo}`,
          detailJson: { kind: INTAKE_ASSOCIATION_CONTRACT, draftId: saved.id, requestId: input.requestId,
            fromRevision: dto.expectedDraftRevision, toRevision: revision, intakeRevision: meta.d.r,
            state: 'manual_pending', source: 'owner_statement', financialEffect: false,
            personalDataIncluded: false, independentReviewPerformed: false } }, manager);
        return { ...this.associationView(order, saved), replayed: false };
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Driver errors can contain source contact. Never expose SQL or retry an uncertain commit.
      throw new ServiceUnavailableException('[intake_association_unconfirmed] 尚未确认保存结果，请回读或重试同一提交');
    }
  }

  async findAssociation(id: number, currentUser: CurrentUser) {
    try {
      return await this.dataSource.transaction('REPEATABLE READ', async (manager) => {
        const { order } = await this.associationContext(id, currentUser, manager, false);
        const binding = await manager.getRepository(CustomerIdentificationBinding).findOne({
          where: { sourceSystem: INTAKE_ASSOCIATION_SOURCE, sourceTable: INTAKE_ASSOCIATION_TABLE, sourceId: String(id) },
          lock: { mode: 'pessimistic_read' },
        });
        return this.associationView(order, binding);
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('[intake_association_read_unavailable] 暂不能读取关联资料，请稍后重试');
    }
  }

  private async associationContext(id: number, currentUser: CurrentUser, manager: EntityManager, write: boolean) {
    const actor = await this.actor(currentUser, manager);
    const repo = manager.getRepository(WorkOrder);
    const hint = await repo.findOne({ where: { id, createdBy: actor.id } });
    const hinted = decodeIntakeMetadata(hint?.remark);
    if (!hint || hint.status !== WorkOrderStatus.DRAFT || !hinted) throw new NotFoundException('接车草稿不存在或不可访问');
    const access = await this.scope.assertStoreIntakeAccess(actor, hinted.s, manager);
    const order = await repo.findOne({ where: { id, createdBy: actor.id }, lock: { mode: write ? 'pessimistic_write' : 'pessimistic_read' } });
    const meta = decodeIntakeMetadata(order?.remark);
    if (!order || order.status !== WorkOrderStatus.DRAFT || !meta) throw new NotFoundException('接车草稿不存在或不可访问');
    if (meta.s !== hinted.s || meta.c !== hinted.c || access.companyRef !== meta.c) {
      throw new ForbiddenException('[intake_store_changed] 门店归属已变化，请重新核验');
    }
    return { actor, order, meta };
  }

  private associationView(order: WorkOrder, binding: CustomerIdentificationBinding | null) {
    const snapshot = binding ? intakeAssociationSnapshot(binding) : null;
    if (snapshot && snapshot.actorId !== order.createdBy) throw new ForbiddenException('[intake_association_owner_changed] 原资料提交身份不匹配');
    return { workOrderId: order.id, captureOnly: true, state: 'manual_pending', source: 'owner_statement',
      customerRef: null, vehicleId: null, independentReviewPerformed: false, financialEffect: false, wagesAvailable: false,
      draft: binding && snapshot ? { id: binding.id, revision: snapshot.revision, intakeRevision: snapshot.intakeRevision,
        customerName: binding.sourceCustomerName, customerMobile: maskPhoneNumber(binding.sourceCustomerMobile),
        relationshipType: snapshot.relationshipType, sourceCurrent: snapshot.sourceHash === intakeAssociationSourceHash(order) } : null };
  }

  private async proposalContext(id: number, user: CurrentUser, manager: EntityManager, write: boolean) {
    if (!Number.isInteger(id) || id < 1 || id > 2147483647) throw new NotFoundException('接车草稿不存在或不可访问');
    const context = await this.associationContext(id, user, manager, write);
    const binding = await manager.getRepository(CustomerIdentificationBinding).findOne({
      where: { sourceSystem: INTAKE_ASSOCIATION_SOURCE, sourceTable: INTAKE_ASSOCIATION_TABLE, sourceId: String(id) },
      lock: { mode: 'pessimistic_read' },
    });
    const association = binding ? intakeAssociationSnapshot(binding) : null;
    if (association && association.actorId !== context.actor.id) throw new ForbiddenException('[intake_proposal_owner] 关系声明身份不匹配');
    const rootHash = intakeAssociationSourceHash(context.order);
    const frozen = Boolean(await manager.getRepository(RepairWorkOrderProfile).findOne({
      where: { workOrderId: id }, lock: { mode: 'pessimistic_read' },
    })) || await this.hasNativeReview(id, manager);
    return { ...context, association, sourceHash: intakeAssociationHash([rootHash, association?.requestHash ?? null]),
      sourceReady: Boolean(context.meta.d?.v && context.meta.d?.o != null && context.meta.d?.t
        && association?.sourceHash === rootHash), frozen };
  }

  private proposalView(context: Awaited<ReturnType<WorkOrderIntakeService['proposalContext']>>, document: RepairDocumentVersion | null) {
    const snapshot = document ? proposalSnapshot(document) : null;
    if (document && (document.createdBy !== context.actor.id || document.workOrderId !== context.order.id || document.status !== 'draft')) {
      throw new ConflictException('[intake_proposal_integrity] 当前草稿状态不匹配');
    }
    const data = snapshot?.input;
    const totals = data ? proposalAmounts(data) : null;
    return { contract: INTAKE_PROPOSAL_CONTRACT, workOrderId: context.order.id, captureOnly: true,
      verificationStatus: 'pending', financialEffect: false, wagesAvailable: false,
      source: { intakeRevision: context.meta.d?.r ?? 0, associationRevision: context.association?.revision ?? 0,
        ready: context.sourceReady }, editable: context.sourceReady && !context.frozen,
      frozen: context.frozen, revision: document?.version ?? 0,
      draft: data && document ? { revision: document.version, requestId: data.requestId,
        intakeRevision: data.expectedIntakeRevision, associationRevision: data.expectedAssociationRevision,
        sourceCurrent: snapshot!.sourceHash === context.sourceHash, plan: data.plan, notes: data.notes, rows: data.rows,
        quoteTotal: totals!.quoteTotal, lineAmounts: totals!.amounts,
        supplierAuthority: 'unverified', actualCost: null, paymentStatus: 'unknown',
        allocationStatus: 'unavailable' } : null };
  }

  async findProposal(id: number, user: CurrentUser) {
    try {
      return await this.dataSource.transaction('REPEATABLE READ', async manager => {
        const context = await this.proposalContext(id, user, manager, false);
        const document = await manager.getRepository(RepairDocumentVersion).findOne({
          where: { workOrderId: id, documentType: OWNER_INTAKE_PROPOSAL_TYPE }, order: { version: 'DESC' },
          lock: { mode: 'pessimistic_read' },
        });
        const result = this.proposalView(context, document);
        const audit = await this.logs.create({ module: 'work_order', targetId: id, action: 'owner_intake_proposal_read',
          operatorId: context.actor.id, detail: '回读本人原单待核实方案材料草稿',
          detailJson: { kind: INTAKE_PROPOSAL_CONTRACT, revision: result.revision, financialEffect: false, personalDataIncluded: false } }, manager);
        if (!Number.isSafeInteger(audit?.id) || audit.id <= 0) throw new Error('audit unavailable');
        return result;
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('[intake_proposal_read_unavailable] 暂不能回读方案草稿，请稍后重试');
    }
  }

  async saveProposal(id: number, dto: SaveIntakeProposalDto, user: CurrentUser) {
    const input = normalizeIntakeProposal(dto);
    try {
      return await this.dataSource.transaction('REPEATABLE READ', async manager => {
        // Current RBAC -> store -> original root WRITE lock -> source -> proposal.
        // Same-root saves serialize against details, association and admission.
        const context = await this.proposalContext(id, user, manager, true);
        const repo = manager.getRepository(RepairDocumentVersion);
        const where = { workOrderId: id, documentType: OWNER_INTAKE_PROPOSAL_TYPE };
        const latest = await repo.findOne({ where, order: { version: 'DESC' }, lock: { mode: 'pessimistic_write' } });
        this.proposalView(context, latest); // Corrupt or promoted rows cannot be overwritten.
        const prior = await repo.findOne({ where: { ...where, summary: proposalSummary(input.requestId) }, lock: { mode: 'pessimistic_read' } });
        const hash = proposalRequestHash(id, context.actor.id, context.sourceHash, input);
        if (prior) {
          const snapshot = proposalSnapshot(prior);
          if (prior.createdBy !== context.actor.id || snapshot.requestHash !== hash) {
            throw new ConflictException('[intake_proposal_replay_conflict] 同一提交的内容或来源已变化，请回读核对');
          }
          return { ...this.proposalView(context, latest), replayed: true, appliedRevision: prior.version, appliedRequestId: input.requestId };
        }
        if (context.frozen) throw new ConflictException('[intake_proposal_frozen] 原单已独立核实或接入，草稿不能继续覆盖');
        if (!context.sourceReady || context.meta.d?.r !== input.expectedIntakeRevision
          || context.association?.revision !== input.expectedAssociationRevision) {
          throw new ConflictException('[intake_proposal_source_stale] 接车或关系资料未齐全或已变化，请先回读');
        }
        if ((latest?.version ?? 0) !== input.expectedDraftRevision) {
          throw new ConflictException('[intake_proposal_stale] 已有较新的方案草稿，请先回读；不会自动覆盖');
        }
        if (latest) { latest.status = 'superseded'; await repo.save(latest); }
        const saved = await repo.save(repo.create({ ...where, version: input.expectedDraftRevision + 1, status: 'draft',
          summary: proposalSummary(input.requestId), payload: { ...input }, generatedBy: 'human', createdBy: context.actor.id,
          sourceReferences: [{ contract: INTAKE_PROPOSAL_CONTRACT, sourceHash: context.sourceHash, requestHash: hash }],
          reviewedBy: null, reviewedAt: null, reviewNote: null }));
        const audit = await this.logs.create({ module: 'work_order', targetId: id, action: OperationLogAction.UPDATE_WORK_ORDER,
          operatorId: context.actor.id, detail: '保存本人原单待核实方案材料草稿',
          detailJson: { kind: INTAKE_PROPOSAL_CONTRACT, requestId: input.requestId, documentId: saved.id,
            fromRevision: input.expectedDraftRevision, toRevision: saved.version,
            independentReviewPerformed: false, financialEffect: false, personalDataIncluded: false } }, manager);
        if (!Number.isSafeInteger(audit?.id) || audit.id <= 0) throw new Error('audit unavailable');
        return { ...this.proposalView(context, saved), replayed: false, appliedRevision: saved.version, appliedRequestId: input.requestId };
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Do not automatically retry an uncertain commit or expose SQL/payload.
      throw new ServiceUnavailableException('[intake_proposal_unconfirmed] 保存结果尚未确认，请回读或重试同一提交');
    }
  }

  async findOne(id: number, currentUser: CurrentUser) {
    return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      const actor = await this.actor(currentUser, manager);
      const order = await manager.getRepository(WorkOrder).findOne({ where: { id, createdBy: actor.id } });
      return this.authorizeRead(order, actor, manager);
    });
  }

  private async authorizeRead(order: WorkOrder | null, actor: CurrentUser, manager: EntityManager) {
      const metadata = decodeIntakeMetadata(order?.remark);
      if (!order || order.status !== WorkOrderStatus.DRAFT || !metadata) {
        throw new NotFoundException('接车草稿不存在或不可访问');
      }
      const access = await this.scope.assertStoreIntakeAccess(actor, metadata.s, manager);
      if (access.companyRef !== metadata.c) throw new ForbiddenException('[intake_store_changed] 门店归属已变化');
      const attached = await manager.getRepository(RepairWorkOrderProfile).findOne({ where: { workOrderId: order.id } });
      return { ...this.view(order), intakeEditsFrozen: Boolean(attached) || await this.hasNativeReview(order.id, manager) };
  }

  private async hasNativeReview(id: number, manager: EntityManager) {
    // Any record (even corrupt/revoked) freezes overwrite; it is NOT approval.
    return Boolean(await manager.getRepository(CustomerIdentificationBinding).findOne({
      where: nativeReviewWhere(id), lock: { mode: 'pessimistic_read' },
    }));
  }

  private view(order: WorkOrder) {
    const meta = decodeIntakeMetadata(order.remark);
    if (!meta) throw new ConflictException('[intake_metadata_invalid] 草稿资料需要核对');
    return { id: order.id, workOrderNo: order.workOrderNo, title: order.title,
      customerName: order.customerName, customerMobile: maskPhoneNumber(order.customerMobile),
      status: 'draft', pricingStatus: 'unquoted', amountDue: null, amountReceived: null,
      materialCostTotal: null, financialEffect: false, storeName: meta.sn,
      plateNumber: meta.p, vehicleModel: meta.m, createdAt: order.createdAt,
      registrationOnly: true,
      details: { revision: meta.d?.r ?? 0, vin: meta.d?.v ?? null, odometerKm: meta.d?.o ?? null,
        requestedService: meta.d?.t ?? null, verificationStatus: 'pending' },
      missing: [...(meta.d?.v ? [] : ['VIN']), ...(meta.d?.o != null ? [] : ['里程']),
        ...(meta.d?.t ? [] : ['具体保养需求']), '正式客户与车辆关联', '资料独立核实', '报价及客户确认'],
      repairAuthorityResolved: false, wagesAvailable: false };
  }
}
