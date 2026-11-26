import { BadRequestException, ConflictException, ForbiddenException, HttpException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { maskPhoneNumber } from '../../common/utils/contact-permission.util';
import { CustomerMasterRecord, CustomerOrganizationRelationship } from '../business-foundation/entities/business-foundation.entities';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { CustomerIdentificationBinding } from '../performance/entities/customer-identification-binding.entity';
import { User } from '../users/entities/user.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { decodeIntakeMetadata } from '../work-orders/work-order-intake.policy';
import { INTAKE_ASSOCIATION_SOURCE, INTAKE_ASSOCIATION_TABLE, intakeAssociationSnapshot, intakeAssociationSourceHash } from '../work-orders/work-order-intake-association.policy';
import { QueryRepairFirstVisitDto, ReviewRepairFirstVisitDto } from './dto/repair-first-visit.dto';
import { RepairVehicleCustomerLink, RepairVehiclePlateHistory, RepairVehicleProfile, RepairWorkOrderProfile } from './entities/repair-shop.entities';
import { RepairShopScopeService } from './repair-shop-scope.service';
import { prequoteHash } from './repair-prequote.policy';
import { assertNativeIdentity, assertNativeSource, NATIVE_CUSTOMER_CONTRACT, NATIVE_CUSTOMER_SOURCE, NATIVE_REVIEW_CONTRACT, nativeFactsHash,
  nativePhone, nativeReviewWhere, NativeReview, normalizeFirstVisitRequest } from './repair-first-visit.policy';

/** Native authority in the existing source-binding JSON; never a legacy match or payroll authority.
 * Existing unique source triple, customer-ref, company/VIN and active-link keys
 * plus a transaction mutex serialize this writer. No schema change or external API.
 */
export class RepairFirstVisitService {
  constructor(private readonly source: DataSource, private readonly scope: RepairShopScopeService,
    private readonly logs: OperationLogsService) {}

  private async run<T>(fn: (m: EntityManager) => Promise<T>): Promise<T> {
    for (let n = 0; ; n++) {
      try { return await this.source.transaction('REPEATABLE READ', fn); }
      catch (e) {
        if (e instanceof HttpException) throw e;
        if ((e as any)?.driverError?.errno === 1213 && (e as any).driverError.code === 'ER_LOCK_DEADLOCK' && n < 4) continue;
        throw new ServiceUnavailableException('[first_visit_unconfirmed] 核实结果尚未确认，请回读原单，不要重复建档');
      }
    }
  }

  async preview(id: number, dto: QueryRepairFirstVisitDto, actor: CurrentUser) {
    return this.run(async m => {
      const c = await this.context(id, dto, actor, m, false);
      const targets = await this.targets(c, m);
      if (c.review) {
        const p = assertNativeSource(c.review, c.root, c.declaration);
        this.assertTargets(p, targets);
        return { ...this.receipt(p, false), canReview: false };
      }
      return { contract: 'repair_first_visit_preview_v1', workOrderId: id, state: 'pending_independent_review',
        expectedIntakeRevision: c.meta.d!.r, expectedDeclarationRevision: c.draft.revision,
        expectedReviewHash: this.reviewHash(c, targets), canReview: c.actor.id !== c.root.createdBy,
        source: { customerName: c.declaration.sourceCustomerName, mobileMasked: maskPhoneNumber(c.phone),
          plateNumber: c.meta.p, vehicleModel: c.meta.m, vin: c.meta.d!.v, odometerKm: c.meta.d!.o,
          serviceRequest: c.meta.d!.t, relationshipType: c.draft.relationshipType },
        scope: { companyRef: c.meta.c, storeRef: c.meta.s, businessSectorRef: dto.businessSectorRef,
          companyName: c.access.organization.company.displayNameSnapshot, storeName: c.access.organization.store.name,
          businessSectorName: c.access.organization.sector.name },
        reuseCustomer: Boolean(targets.customer), reuseVehicle: Boolean(targets.vehicle),
        financialEffect: false, wagesAvailable: false };
    });
  }

  async review(id: number, input: ReviewRepairFirstVisitDto, actor: CurrentUser) {
    const dto = normalizeFirstVisitRequest(input);
    return this.run(async m => {
      const c = await this.context(id, dto, actor, m, true);
      if (c.actor.id === c.root.createdBy || c.actor.id === c.draft.actorId) {
        throw new ForbiddenException('[first_visit_independent_review_required] 资料录入人不能核实自己的声明');
      }
      const requestHash = prequoteHash({ workOrderId: id, actorId: c.actor.id, ...dto });
      let t = await this.targets(c, m);
      if (c.review) {
        const p = assertNativeSource(c.review, c.root, c.declaration);
        this.assertTargets(p, t);
        if (p.requestHash !== requestHash || p.reviewerId !== c.actor.id || p.authorityHash !== c.authorityHash) {
          throw new ConflictException('[first_visit_replay_conflict] 原单已有不同核实请求或当前权限已变化');
        }
        return this.receipt(p, true);
      }
      if (c.meta.d!.r !== dto.expectedIntakeRevision || c.draft.revision !== dto.expectedDeclarationRevision
        || this.reviewHash(c, t) !== dto.expectedReviewHash) {
        throw new ConflictException('[first_visit_stale] 资料、归属或权限已变化，请重新预览');
      }
      if (await m.getRepository(RepairWorkOrderProfile).findOne({ where: { workOrderId: id }, lock: { mode: 'pessimistic_read' } })) {
        throw new ConflictException('[first_visit_already_admitted] 原单已接入，不得覆盖核实依据');
      }
      // Existing DATETIME columns have second precision. Hash what will be read.
      const now = new Date(Math.floor(Date.now() / 1000) * 1000);
      const bindingRepo = m.getRepository(CustomerIdentificationBinding);
      const customerRepo = m.getRepository(CustomerMasterRecord);
      if (!t.customer) {
        t.customer = await customerRepo.save(customerRepo.create({ customerRef: 'cus_' + randomUUID().replace(/-/g, ''),
          displayName: c.declaration.sourceCustomerName!, mobileMasked: maskPhoneNumber(c.phone),
          legacyIdentificationBindingId: null, status: 'active', version: 1, createdBy: c.root.createdBy, reviewedBy: c.actor.id }));
        t.identity = await bindingRepo.save(bindingRepo.create({
          ...this.emptyBinding(c), sourceSystem: NATIVE_CUSTOMER_SOURCE, sourceTable: 'customer_master_records',
          sourceId: prequoteHash(c.phone), bindingStatus: 'native_identity_verified', matchedCustomerId: t.customer.customerRef,
          boundBy: c.actor.id, boundAt: now,
          normalizedPayload: { contract: NATIVE_CUSTOMER_CONTRACT, companyRef: c.meta.c,
            customerRef: t.customer.customerRef, collectorId: c.root.createdBy, reviewerId: c.actor.id,
            evidenceRef: dto.evidenceRef },
        }));
      }
      const customerRef = t.customer.customerRef;
      const orgRepo = m.getRepository(CustomerOrganizationRelationship);
      const org = await orgRepo.findOne({ where: { customerRef, companyRef: c.meta.c, storeRef: c.meta.s }, lock: { mode: 'pessimistic_write' } });
      if (org && (org.status !== 'active' || org.validUntil !== null || new Date(org.validFrom).getTime() > now.getTime())) {
        throw new ConflictException('[first_visit_relationship_inactive] 既有客户门店关系不可用，不得自动恢复');
      }
      if (!org) await orgRepo.save(orgRepo.create({ customerRef, companyRef: c.meta.c, storeRef: c.meta.s,
        status: 'active', validFrom: now, validUntil: null, relationshipSource: dto.evidenceRef,
        version: 1, createdBy: c.actor.id }));
      const o = c.access.organization;
      if (!t.vehicle) {
        const repo = m.getRepository(RepairVehicleProfile);
        t.vehicle = await repo.save(repo.create({ companyRef: c.meta.c, businessSectorRef: dto.businessSectorRef,
          initialServiceStoreRef: c.meta.s, companyDisplaySnapshot: o.company.displayNameSnapshot,
          businessSectorDisplaySnapshot: o.sector.name, initialServiceStoreDisplaySnapshot: o.store.name,
          scopeSnapshotVersion: { company: o.company.version, businessSector: o.sector.version, store: o.store.version },
          plateNumber: c.meta.p, vin: c.meta.d!.v, brand: null, model: c.meta.m, modelYear: null,
          engineCode: null, salesMarket: null, odometerKm: c.meta.d!.o, status: 'active', version: 1,
          createdBy: c.actor.id, updatedBy: null }));
        const plates = m.getRepository(RepairVehiclePlateHistory);
        await plates.save(plates.create({ vehicleId: t.vehicle.id, companyRef: c.meta.c, plateNumber: c.meta.p,
          validFrom: now, validUntil: null, sourceEvidenceRef: dto.evidenceRef, reviewedBy: c.actor.id, createdBy: c.actor.id }));
      }
      if (!t.link) {
        const links = m.getRepository(RepairVehicleCustomerLink);
        t.link = await links.save(links.create({ vehicleId: t.vehicle.id, companyRef: c.meta.c,
          businessSectorRef: dto.businessSectorRef, storeRef: c.meta.s, customerRef,
          relationshipType: c.draft.relationshipType, confirmationStatus: 'confirmed', status: 'active',
          validFrom: now, validUntil: null, relationshipSource: dto.evidenceRef, reviewedBy: c.actor.id,
          closedBy: null, closureEvidenceRef: null, createdBy: c.actor.id }));
      }
      const p: NativeReview = { contract: NATIVE_REVIEW_CONTRACT, workOrderId: id, collectorId: c.root.createdBy,
        reviewerId: c.actor.id, reviewerEmployeeId: c.access.employeeId, requestId: dto.requestId, requestHash,
        reviewHash: dto.expectedReviewHash, authorityHash: c.authorityHash, sourceHash: c.draft.sourceHash,
        declarationId: c.declaration.id, declarationRevision: c.draft.revision, intakeRevision: c.meta.d!.r,
        companyRef: c.meta.c, businessSectorRef: dto.businessSectorRef, storeRef: c.meta.s, customerRef,
        identityBindingId: t.identity!.id, vehicleId: t.vehicle.id, linkId: t.link.id, evidenceRef: dto.evidenceRef,
        factsHash: nativeFactsHash(t.identity, t.customer, t.vehicle, t.link) };
      await bindingRepo.save(bindingRepo.create({ ...this.emptyBinding(c), ...nativeReviewWhere(id),
        bindingStatus: 'native_reviewed', boundBy: c.actor.id, boundAt: now,
        matchedCustomerId: customerRef, normalizedPayload: p as unknown as Record<string, unknown> }));
      const audit = await this.logs.create({ module: 'repair_work_order', targetId: id, action: 'native_first_visit_reviewed',
        operatorId: c.actor.id, detail: '首访客户和车辆独立核实；原单未报价、未施工、未结算',
        detailJson: { contract: NATIVE_REVIEW_CONTRACT, requestId: dto.requestId, workOrderId: id,
          intakeRevision: p.intakeRevision, declarationRevision: p.declarationRevision,
          collectorId: p.collectorId, reviewerId: p.reviewerId, customerRef, vehicleId: p.vehicleId,
          financialEffect: false, wagesAvailable: false, personalDataIncluded: false } }, m);
      if (!Number.isSafeInteger(audit?.id) || audit.id <= 0) throw new Error('audit not confirmed');
      return this.receipt(p, false);
    });
  }

  private async context(id: number, dto: QueryRepairFirstVisitDto, supplied: CurrentUser, m: EntityManager, write: boolean) {
    if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647
      || typeof dto.businessSectorRef !== 'string' || !dto.businessSectorRef.trim()
      || dto.businessSectorRef !== dto.businessSectorRef.trim() || dto.businessSectorRef.length > 100) {
      throw new BadRequestException('[first_visit_reference_invalid] 原单或业务范围引用无效');
    }
    if (supplied?.identitySource !== 'trusted_proxy' || !m.queryRunner?.isTransactionActive) {
      throw new ForbiddenException('[first_visit_identity_required] 需要正式身份和活动事务');
    }
    const user = await m.getRepository(User).findOne({ where: { id: supplied.id, username: supplied.username, status: 1 },
      relations: { userRoles: { role: true } }, lock: { mode: 'pessimistic_read' } });
    const roles = (user?.userRoles ?? []).map(r => r.role?.code).filter(Boolean).sort();
    if (!user || !roles.some(r => ['owner','admin','operator'].includes(r))) throw new ForbiddenException('[first_visit_actor_revoked] 当前身份已失效');
    const actor = { ...supplied, roleCodes: roles };
    const rootRepo = m.getRepository(WorkOrder);
    const hint = await rootRepo.findOne({ where: { id } });
    const h = decodeIntakeMetadata(hint?.remark);
    if (!h) throw new NotFoundException('[first_visit_unavailable] 原接车单不存在或不可用');
    // Current RBAC locks precede mutex, root and all customer/vehicle data.
    const access = await this.scope.assertFirstVisitAccess(actor, { companyRef: h.c, storeRef: h.s, businessSectorRef: dto.businessSectorRef }, m);
    if (write) await m.query(`INSERT INTO sequences (biz_type,biz_date,current_value,created_at,updated_at)
      VALUES (?,?,0,NOW(),NOW()) ON DUPLICATE KEY UPDATE current_value=current_value`,
      ['native_first_visit_review_mutex','1970-01-01']);
    const root = await rootRepo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    const meta = decodeIntakeMetadata(root?.remark);
    if (!root || !meta || root.status !== 'draft' || meta.c !== h.c || meta.s !== h.s
      || !meta.d?.v || meta.d.o === null || !meta.d.t) {
      throw new ConflictException('[first_visit_details_incomplete] 原单须补齐实际车辆资料、里程和需求');
    }
    const bindingRepo = m.getRepository(CustomerIdentificationBinding);
    const declaration = await bindingRepo.findOne({ where: { sourceSystem: INTAKE_ASSOCIATION_SOURCE,
      sourceTable: INTAKE_ASSOCIATION_TABLE, sourceId: String(id) }, lock: { mode: 'pessimistic_read' } });
    const draft = declaration && intakeAssociationSnapshot(declaration);
    const phone = nativePhone(root.customerMobile);
    if (!draft || draft.actorId !== root.createdBy || draft.sourceHash !== intakeAssociationSourceHash(root)
      || draft.intakeRevision !== meta.d.r || !/^1\d{10}$/.test(phone)
      || nativePhone(declaration!.sourceCustomerMobile) !== phone || declaration!.sourceCarPlate !== meta.p) {
      throw new ConflictException('[first_visit_declaration_stale] 缺少与当前车辆资料一致的本人关系声明');
    }
    const review = await bindingRepo.findOne({ where: nativeReviewWhere(id), lock: { mode: 'pessimistic_read' } });
    const o = access.organization;
    const authorityHash = prequoteHash({ actorId: actor.id, roles, employeeId: access.employeeId,
      scope: [meta.c,dto.businessSectorRef,meta.s], versions: [o.company.version,o.sector.version,o.store.version,o.companySector.version,o.storeSector.version],
      grants: access.grants.map(g => [g.id,g.version,g.effect,g.permissions.slice().sort(),g.businessSectorRef,g.storeRef,g.customerRef,g.validFrom,g.validUntil]) });
    return { actor, access, root, meta, declaration: declaration!, draft, phone, review, authorityHash, sector: dto.businessSectorRef };
  }

  private async targets(c: Awaited<ReturnType<RepairFirstVisitService['context']>>, m: EntityManager) {
    const repo = m.getRepository(CustomerIdentificationBinding);
    const lock = { lock: { mode: 'pessimistic_read' as const } };
    const identity = await repo.findOne({ where: { sourceSystem: NATIVE_CUSTOMER_SOURCE,
      sourceTable: 'customer_master_records', sourceId: prequoteHash(c.phone) }, ...lock });
    const customer = identity?.matchedCustomerId ? await m.getRepository(CustomerMasterRecord).findOne({
      where: { customerRef: identity.matchedCustomerId }, ...lock }) : null;
    if (identity) assertNativeIdentity(identity,customer,c.meta.c,c.phone);
    if (identity && (identity.sourceCustomerName !== c.declaration.sourceCustomerName || customer!.displayName !== c.declaration.sourceCustomerName)) {
      throw new ConflictException('[first_visit_customer_conflict] 既有客户信息需要人工处理，不会自动新建或合并');
    }
    // Native path does not manufacture an ABC/history customer. Existing legacy
    // phone matches must use the old independently reviewed mapping workflow.
    const formats = [...new Set([c.root.customerMobile, c.phone, '+86' + c.phone, '86' + c.phone])];
    const legacy = await repo.find({ where: [
      { bindingStatus: 'manually_bound', sourceCustomerMobile: In(formats) },
      { bindingStatus: 'manually_bound', matchedCustomerMobile: In(formats) },
    ], take: 2, ...lock });
    if (legacy.length) throw new ConflictException('[first_visit_existing_legacy] 已有历史客户来源，请核对既有客户，不重复建档');
    const vehicle = await m.getRepository(RepairVehicleProfile).findOne({ where: { companyRef: c.meta.c, vin: c.meta.d!.v! }, ...lock });
    if (vehicle && (vehicle.status !== 'active' || vehicle.businessSectorRef !== c.sector || vehicle.plateNumber !== c.meta.p)) {
      throw new ConflictException('[first_visit_vehicle_conflict] 既有车辆信息不一致，不得覆盖或仅按车牌归并');
    }
    const links = vehicle ? await m.getRepository(RepairVehicleCustomerLink).find({
      where: { vehicleId: vehicle.id, status: 'active' }, order: { id: 'ASC' }, ...lock }) : [];
    const current = links.filter(l => l.validUntil === null);
    const link = current.length === 1 ? current[0] : null;
    if (current.length && (!link || !customer || link.customerRef !== customer.customerRef
      || link.companyRef !== c.meta.c || link.businessSectorRef !== c.sector || link.storeRef !== c.meta.s
      || link.relationshipType !== c.draft.relationshipType || link.confirmationStatus !== 'confirmed'
      || !link.reviewedBy || !Number.isFinite(new Date(link.validFrom).getTime()) || new Date(link.validFrom).getTime() > Date.now())) {
      throw new ConflictException('[first_visit_vehicle_relationship_conflict] 车辆存在其他或未核实关系，请人工处理');
    }
    return { identity, customer, vehicle, link };
  }

  private assertTargets(p: NativeReview, t: Awaited<ReturnType<RepairFirstVisitService['targets']>>) {
    if (p.identityBindingId !== t.identity?.id || p.customerRef !== t.customer?.customerRef
      || p.vehicleId !== t.vehicle?.id || p.linkId !== t.link?.id
      || p.factsHash !== nativeFactsHash(t.identity,t.customer,t.vehicle,t.link)) {
      throw new ConflictException('[first_visit_authority_changed] 客户或车辆核实依据已变化，禁止沿用');
    }
  }
  private reviewHash(c: Awaited<ReturnType<RepairFirstVisitService['context']>>, t: Awaited<ReturnType<RepairFirstVisitService['targets']>>) {
    return prequoteHash({ source: c.draft.sourceHash, declarationId: c.declaration.id,
      declaration: c.declaration.normalizedPayload, authorityHash: c.authorityHash,
      targets: nativeFactsHash(t.identity,t.customer,t.vehicle,t.link) });
  }
  private emptyBinding(c: Awaited<ReturnType<RepairFirstVisitService['context']>>) {
    return { sourceCustomerName: c.declaration.sourceCustomerName, sourceCustomerMobile: c.phone, sourceCarPlate: c.meta.p,
      matchedCustomerName: null, matchedCustomerMobile: null, bindingConfidence: null,
      bindingRemark: '原生客户身份及车辆核实；非历史匹配；非工资权威', performanceReadyFlag: false,
      performanceBlockReason: 'native_identity_only_not_payroll', performanceDecisionReason: null,
      taskExecutionCount: null, taskOnTimeCount: null, taskConfirmedCount: null,
      taskRewardEligibleFlag: null, aiTaskScore: null, aiTaskRemark: null };
  }
  private receipt(p: NativeReview, replayed: boolean) {
    return { contract: 'repair_first_visit_preview_v1', workOrderId: p.workOrderId, state: 'reviewed_native_source',
      expectedIntakeRevision: p.intakeRevision, expectedDeclarationRevision: p.declarationRevision,
      requestId: p.requestId, reviewerId: p.reviewerId, collectorId: p.collectorId, replayed,
      selection: { companyRef: p.companyRef, businessSectorRef: p.businessSectorRef, storeRef: p.storeRef,
        customerRef: p.customerRef, vehicleId: p.vehicleId },
      evidenceRef: p.evidenceRef, intakeEditsFrozen: true, financialEffect: false, wagesAvailable: false };
  }
}
