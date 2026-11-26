import { BadRequestException, ConflictException, ForbiddenException, HttpException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { WorkOrderStatus } from '../../shared/enums/work-order-status.enum';
import { BusinessScopeGrant, CustomerMasterRecord } from '../business-foundation/entities/business-foundation.entities';
import { CustomerIdentificationBinding } from '../performance/entities/customer-identification-binding.entity';
import { Employee } from '../performance/entities/employee.entity';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { User } from '../users/entities/user.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { decodeIntakeMetadata } from '../work-orders/work-order-intake.policy';
import { AdmitRepairPrequoteDto, QueryRepairPrequoteReadinessDto } from './dto/repair-prequote.dto';
import { RepairPermission, RepairVehicleCustomerLink, RepairVehicleProfile, RepairWorkOrderProfile } from './entities/repair-shop.entities';
import { RepairResourceScope, RepairShopScopeService } from './repair-shop-scope.service';
import { assertPrequoteLifecycle, prequoteAdmission, prequoteHash, PrequoteAdmissionV1 } from './repair-prequote.policy';
import { assertNativeIdentity, assertNativeSource, nativeFactsHash, nativeReviewWhere } from './repair-first-visit.policy';
import { INTAKE_ASSOCIATION_SOURCE, INTAKE_ASSOCIATION_TABLE } from '../work-orders/work-order-intake-association.policy';

/**
 * Transactional collaborator of the existing RepairShopService, not another
 * business root or authority store. Existing profile JSON owns the immutable
 * admission envelope; root UNIQUE(work_order_id) and root locks serialize writers.
 */
export class RepairPrequoteService {
  constructor(private readonly source: DataSource, private readonly scope: RepairShopScopeService,
    private readonly logs: OperationLogsService) {}

  async run<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.source.transaction('REPEATABLE READ', fn); }
      catch (error) {
        if (error instanceof HttpException) throw error;
        const driver = (error as any)?.driverError;
        // Only InnoDB's definitively rolled-back deadlock victim can retry.
        if (driver?.errno === 1213 && driver.code === 'ER_LOCK_DEADLOCK' && attempt < 4) continue;
        // Never leak SQL parameters, VIN, phone or intake text to the logger.
        throw new ServiceUnavailableException('[repair_prequote_unconfirmed] 操作结果尚未确认，请回读原工单；不要重复建单');
      }
    }
  }

  async readiness(id: number, input: QueryRepairPrequoteReadinessDto, actor: CurrentUser) {
    return this.run(async (manager) => {
      const data = await this.inputs(id, input, actor, manager, true);
      const profile = await manager.getRepository(RepairWorkOrderProfile).findOne({
        where: { workOrderId: id }, lock: { mode: 'pessimistic_read' },
      });
      if (profile) {
        this.assertBinding(profile, data);
        assertPrequoteLifecycle(profile);
      }
      return { workOrderId: id, state: profile ? 'admitted_prequote_only' : 'ready_for_prequote',
        expectedRevision: data.revision, expectedAuthorityHash: data.authorityHash,
        profileVersion: profile?.version ?? null, vehicleId: data.vehicle.id,
        scope: data.scope, onlyPrequoteDocuments: true, intakeEditsFrozen: Boolean(profile),
        financialEffect: false, wagesAvailable: false };
    });
  }

  async assertUnconfiguredRead(id: number, actor: CurrentUser, manager: EntityManager) {
    const current = (await this.currentActor(actor, manager)).actor;
    const root = await manager.getRepository(WorkOrder).findOne({ where: { id } });
    const meta = decodeIntakeMetadata(root?.remark);
    if (!root || !meta || root.status !== WorkOrderStatus.DRAFT) {
      throw new NotFoundException('[repair_prequote_root_unavailable] 接车工单不存在或无权访问');
    }
    if (root.createdBy === current.id || root.responsibleUserId === current.id) {
      const access = await this.scope.assertStoreIntakeAccess(current, meta.s, manager);
      if (access.companyRef !== meta.c) throw new ForbiddenException('[repair_prequote_scope_mismatch] 门店归属已变化');
    } else {
      // Independent reviewer can open this original's empty workspace only with
      // current organization-wide customer review rights; no owner draft edits.
      await this.scope.assertFirstVisitStoreRead(current, meta.c, meta.s, manager);
    }
    return { id: root.id, workOrderNo: root.workOrderNo, title: root.title, status: root.status };
  }

  async admit(id: number, dto: AdmitRepairPrequoteDto, actor: CurrentUser) {
    const requestId = dto.requestId?.toLowerCase();
    const proof = dto.scopeResolutionEvidenceRef?.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId ?? '')
      || !Number.isInteger(dto.expectedRevision) || dto.expectedRevision < 1
      || !/^[a-f0-9]{64}$/.test(dto.expectedAuthorityHash ?? '')
      || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{2,254}$/.test(proof ?? '')
      || /\/\/|\.\.|1\d{10}|[A-HJ-NPR-Z0-9]{17}|Bearer|PRIVATE.KEY/i.test(proof ?? '')) {
      throw new BadRequestException('[repair_prequote_request_invalid] 请使用当前核验版本、请求号和内部不透明证据引用');
    }
    return this.run(async (manager) => {
      // This always runs BEFORE replay lookup. A UUID is not an authorization.
      const data = await this.inputs(id, dto, actor, manager, true);
      const requestHash = prequoteHash({ workOrderId: id, actorId: data.actor.id, requestId,
        ...data.scope, vehicleId: data.vehicle.id, expectedRevision: dto.expectedRevision,
        expectedAuthorityHash: dto.expectedAuthorityHash, scopeResolutionEvidenceRef: proof });
      const repo = manager.getRepository(RepairWorkOrderProfile);
      const existing = await repo.findOne({ where: { workOrderId: id }, lock: { mode: 'pessimistic_write' } });
      if (existing) {
        const prior = this.assertBinding(existing, data);
        assertPrequoteLifecycle(existing);
        if (prior.actorId !== data.actor.id || prior.requestId !== requestId || prior.requestHash !== requestHash
          || prior.authorityHash !== data.authorityHash) {
          throw new ConflictException('[repair_prequote_replay_conflict] 原工单已有不同接入请求，请读取原档案');
        }
        // Current permission and data were rechecked; no audit/profile mutation on replay.
        return this.receipt(existing, true);
      }
      if (dto.expectedRevision !== data.revision || dto.expectedAuthorityHash !== data.authorityHash) {
        throw new ConflictException('[repair_prequote_stale] 资料、归属或授权已变化，请重新核验');
      }
      const admission: PrequoteAdmissionV1 = { contract: 'repair_prequote_admission_v1',
        actorId: data.actor.id, requestId, requestHash, authorityHash: data.authorityHash,
        dataHash: data.dataHash, intakeRevision: data.revision, vehicleCustomerLinkId: data.link.id };
      const profile = await repo.save(repo.create({ workOrderId: id, ...data.scope,
        companyDisplaySnapshot: data.resolved.companyDisplaySnapshot,
        businessSectorDisplaySnapshot: data.resolved.businessSectorDisplaySnapshot,
        storeDisplaySnapshot: data.resolved.storeDisplaySnapshot,
        customerDisplaySnapshot: data.resolved.customerDisplaySnapshot,
        scopeSnapshotVersion: { ...data.resolved.scopeSnapshotVersion, prequoteAdmission: admission },
        // Historical column name, existing NOT NULL FK to the shared source table.
        // Native rows retain a distinct namespace/status/typed contract, never a
        // manually_bound legacy identity. Customer master legacy FK stays null.
        scopeResolutionEvidenceRef: proof, legacyCustomerBindingId: data.binding.id, scopeResolvedAt: new Date(),
        vehicleId: data.vehicle.id, lifecycleStatus: 'intake_draft', customerConfirmationState: 'not_requested',
        activePlanVersion: null, activeQuoteVersion: null, activeExplanationVersion: null,
        version: 1, knowledgeCatalogVersion: 1, createdBy: data.actor.id, updatedBy: null }));
      await this.logs.create({ module: 'repair_work_order', targetId: id, action: 'prequote_admitted',
        operatorId: data.actor.id, detail: '原工单报价前接入；未确认报价或施工',
        detailJson: { contract: admission.contract, requestId, profileId: profile.id,
          intakeRevision: data.revision, financialEffect: false, wagesAvailable: false,
          personalDataIncluded: false } }, manager);
      return this.receipt(profile, false);
    });
  }

  /** Called only by the two existing document mutations and the safe workspace read. */
  async documentProfile(id: number, actor: CurrentUser, manager: EntityManager, permission: RepairPermission) {
    const result = await this.boundProfile(id, actor, manager, permission);
    assertPrequoteLifecycle(result.profile);
    return result;
  }

  /** Existing intake identity/binding locks, without granting any lifecycle operation. */
  async boundProfile(id: number, actor: CurrentUser, manager: EntityManager, permission: RepairPermission) {
    const hint = await manager.getRepository(RepairWorkOrderProfile).findOne({ where: { workOrderId: id } });
    if (!hint) throw new NotFoundException('汽修工单档案不存在');
    const data = await this.inputs(id, { ...this.scopeOf(hint), vehicleId: hint.vehicleId }, actor, manager, false, permission);
    const profile = await manager.getRepository(RepairWorkOrderProfile).findOne({
      where: { workOrderId: id }, lock: { mode: 'pessimistic_write' },
    });
    if (!profile) throw new NotFoundException('汽修工单档案不存在');
    this.assertBinding(profile, data);
    return { profile, data };
  }

  private receipt(profile: RepairWorkOrderProfile, replayed: boolean) {
    return { workOrderId: profile.workOrderId, profileId: profile.id, profileVersion: profile.version,
      state: 'admitted_prequote_only', replayed, intakeEditsFrozen: true,
      financialEffect: false, wagesAvailable: false };
  }

  private async currentActor(actor: CurrentUser, manager: EntityManager) {
    if (actor?.identitySource !== 'trusted_proxy' || !manager.queryRunner?.isTransactionActive) {
      throw new ForbiddenException('[repair_prequote_identity_required] 需要正式登录身份和活动事务');
    }
    const user = await manager.getRepository(User).findOne({ where: { id: actor.id, username: actor.username, status: 1 },
      relations: { userRoles: { role: true } }, lock: { mode: 'pessimistic_read' } });
    const roles = (user?.userRoles ?? []).map((r) => r.role?.code).filter(Boolean);
    if (!user || !roles.some((r) => ['owner', 'admin', 'operator'].includes(r))) {
      throw new ForbiddenException('[repair_prequote_actor_revoked] 当前人员身份或角色已失效');
    }
    const employees = await manager.getRepository(Employee).find({
      where: { linkedUserId: actor.id, status: 1 }, order: { id: 'ASC' }, take: 2, lock: { mode: 'pessimistic_read' },
    });
    if (employees.length !== 1) throw new ForbiddenException('[repair_prequote_employee_invalid] 缺少唯一有效员工绑定');
    return { actor: { ...actor, roleCodes: roles }, employeeId: employees[0].id };
  }

  private async inputs(id: number, input: QueryRepairPrequoteReadinessDto, suppliedActor: CurrentUser,
    manager: EntityManager, admission: boolean, permission: RepairPermission = 'intake.manage') {
    const { actor, employeeId } = await this.currentActor(suppliedActor, manager);
    if (![id, input.vehicleId].every((n) => Number.isSafeInteger(n) && n > 0 && n <= 2147483647)) {
      throw new BadRequestException('[repair_prequote_reference_invalid] 工单及车辆引用无效');
    }
    const scope = this.scopeOf(input);
    const rootRepo = manager.getRepository(WorkOrder);
    // A hint is never authority. Root and every mutable dependency are read again
    // with current locks after actor/scope authorization and before any write.
    const hint = await rootRepo.findOne({ where: { id } });
    const hinted = decodeIntakeMetadata(hint?.remark);
    if (!hint || !hinted || (admission && hint.createdBy !== actor.id && hint.responsibleUserId !== actor.id)) {
      throw new NotFoundException('[repair_prequote_root_unavailable] 接车工单不存在或无权访问');
    }
    if (scope.companyRef !== hinted.c || scope.storeRef !== hinted.s) {
      throw new ForbiddenException('[repair_prequote_scope_mismatch] 不能改变原接车门店和公司');
    }
    if (admission) await this.scope.assertStoreIntakeAccess(actor, hinted.s, manager);
    const resolved = (await this.scope.assertAccess(actor, scope, permission, manager, { lockAuthorityRows: true })).resolved;
    await this.scope.assertAccess(actor, scope, 'repair.read', manager, { lockAuthorityRows: true });
    if (admission) await this.scope.assertAccess(actor, scope, 'scope.resolve', manager, { lockAuthorityRows: true });
    const grants = await manager.getRepository(BusinessScopeGrant).find({
      where: { userId: actor.id, employeeId, companyRef: scope.companyRef, status: 'active' },
      order: { id: 'ASC' }, lock: { mode: 'pessimistic_read' },
    });
    const root = await rootRepo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    const meta = decodeIntakeMetadata(root?.remark);
    if (!root || !meta || root.status !== WorkOrderStatus.DRAFT
      || meta.c !== scope.companyRef || meta.s !== scope.storeRef
      || (admission && root.createdBy !== actor.id && root.responsibleUserId !== actor.id)) {
      throw new ConflictException('[repair_prequote_root_changed] 原接车工单已变化');
    }
    if (!meta.d?.v || meta.d.o === null || !meta.d.t) {
      throw new ConflictException('[repair_prequote_details_incomplete] 请先在原接车单补齐实际 VIN、里程和需求；未知不可编造');
    }
    const vehicle = await manager.getRepository(RepairVehicleProfile).findOne({
      where: { id: input.vehicleId }, lock: { mode: 'pessimistic_read' },
    });
    if (!vehicle || vehicle.status !== 'active' || vehicle.companyRef !== scope.companyRef
      || vehicle.businessSectorRef !== scope.businessSectorRef || vehicle.vin !== meta.d.v) {
      throw new ConflictException('[repair_prequote_vehicle_unverified] 所选已核实车辆与接车资料不一致');
    }
    const links = await manager.getRepository(RepairVehicleCustomerLink).find({
      where: { vehicleId: vehicle.id, companyRef: scope.companyRef, businessSectorRef: scope.businessSectorRef,
        customerRef: scope.customerRef, status: 'active', confirmationStatus: 'confirmed' },
      order: { id: 'ASC' }, lock: { mode: 'pessimistic_read' },
    });
    const currentLinks = links.filter((l) => l.storeRef === scope.storeRef && l.validUntil === null
      && l.reviewedBy > 0 && Number.isFinite(new Date(l.validFrom).getTime()) && new Date(l.validFrom).getTime() <= Date.now());
    if (currentLinks.length !== 1) throw new ConflictException('[repair_prequote_relationship_unverified] 缺少唯一有效的已核实客户车辆关系');
    const link = currentLinks[0];
    const customer = await manager.getRepository(CustomerMasterRecord).findOne({
      where: { customerRef: scope.customerRef, status: 'active' }, lock: { mode: 'pessimistic_read' },
    });
    let binding = customer?.legacyIdentificationBindingId ? await manager.getRepository(CustomerIdentificationBinding).findOne({
      where: { id: customer.legacyIdentificationBindingId }, lock: { mode: 'pessimistic_read' },
    }) : null;
    const phone = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '').replace(/^86(?=1\d{10}$)/, '');
    let nativeFacts: string | null = null;
    {
      const repo = manager.getRepository(CustomerIdentificationBinding);
      const native = await repo.findOne({ where: nativeReviewWhere(id), lock: { mode: 'pessimistic_read' } });
      if (native) {
        const declaration = await repo.findOne({ where: { sourceSystem: INTAKE_ASSOCIATION_SOURCE,
          sourceTable: INTAKE_ASSOCIATION_TABLE, sourceId: String(id) }, lock: { mode: 'pessimistic_read' } });
        const p = assertNativeSource(native, root, declaration);
        const identity = await repo.findOne({ where: { id: p.identityBindingId }, lock: { mode: 'pessimistic_read' } });
        assertNativeIdentity(identity,customer,p.companyRef,phone(root.customerMobile));
        if (p.customerRef !== scope.customerRef || p.businessSectorRef !== scope.businessSectorRef
          || p.vehicleId !== vehicle.id || p.linkId !== link.id
          || p.factsHash !== nativeFactsHash(identity,customer,vehicle,link)) {
          throw new ConflictException('[repair_prequote_native_stale] 原生客户车辆核实依据已变化');
        }
        nativeFacts = prequoteHash(p);
        binding = native;
      }
    }
    if (!nativeFacts && (!binding || binding.bindingStatus !== 'manually_bound' || !binding.boundBy || !binding.boundAt
      || !binding.matchedCustomerId?.trim() || !/^1\d{10}$/.test(phone(root.customerMobile))
      || ![binding.matchedCustomerMobile, binding.sourceCustomerMobile].map(phone).includes(phone(root.customerMobile)))) {
      throw new ConflictException('[repair_prequote_customer_unverified] 缺少可证明的已人工审核客户来源绑定');
    }
    // Hashes bind authoritative values in memory; no raw VIN/phone/text is copied
    // into the profile envelope, readiness response or operation log.
    if (!binding) throw new ConflictException('[repair_prequote_customer_unverified] 缺少客户核实依据');
    const dataHash = prequoteHash({ rootId: id, rootMetadata: root.remark, createdBy: root.createdBy,
      responsibleUserId: root.responsibleUserId, rootPhone: root.customerMobile, scope,
      scopeVersions: resolved.scopeSnapshotVersion, vehicleId: vehicle.id, vehicleVersion: vehicle.version,
      vehicleVin: vehicle.vin, link, bindingId: binding.id, bindingStatus: binding.bindingStatus,
      matchedCustomerId: binding.matchedCustomerId, matchedMobile: binding.matchedCustomerMobile,
      sourceMobile: binding!.sourceCustomerMobile, boundBy: binding!.boundBy, boundAt: binding!.boundAt,
      ...(nativeFacts ? { nativeFacts } : {}) });
    const authorityHash = prequoteHash({ dataHash, actorId: actor.id, roles: actor.roleCodes.slice().sort(), employeeId,
      grants: grants.map((g) => ({ id: g.id, version: g.version, effect: g.effect,
        permissions: g.permissions.slice().sort(), sector: g.businessSectorRef, store: g.storeRef,
        customer: g.customerRef, validFrom: g.validFrom, validUntil: g.validUntil })) });
    return { actor, employeeId, scope, resolved, root, vehicle, link, binding,
      revision: meta.d.r, odometerKm: meta.d.o, dataHash, authorityHash };
  }

  private assertBinding(profile: RepairWorkOrderProfile, data: Awaited<ReturnType<RepairPrequoteService['inputs']>>) {
    const record = prequoteAdmission(profile);
    if (!record || record.dataHash !== data.dataHash || record.intakeRevision !== data.revision
      || record.vehicleCustomerLinkId !== data.link.id || profile.vehicleId !== data.vehicle.id
      || profile.legacyCustomerBindingId !== data.binding.id || prequoteHash(this.scopeOf(profile)) !== prequoteHash(data.scope)) {
      throw new ConflictException('[repair_prequote_binding_stale] 接入依据已失效，禁止沿用旧归属或旧报价');
    }
    return record;
  }

  private scopeOf(input: RepairResourceScope): RepairResourceScope {
    const scope = { companyRef: input.companyRef, businessSectorRef: input.businessSectorRef,
      storeRef: input.storeRef, customerRef: input.customerRef };
    if (!Object.values(scope).every((v) => typeof v === 'string' && v === v.trim() && v.length > 0 && v.length <= 100)) {
      throw new BadRequestException('[repair_prequote_scope_invalid] 请选择已授权的真实范围引用');
    }
    return scope;
  }
}
