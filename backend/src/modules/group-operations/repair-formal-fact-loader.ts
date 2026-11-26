import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { BusinessContributionAccessPolicy } from './business-contribution.access-policy';
import { quotedScopeSnapshot } from '../repair-shop/repair-prequote.policy';
import {
  buildRepairRevenueAuthorityCandidateV1,
  RepairRevenueAuthorityCandidateInputV1,
  VerifiedRepairRevenueAuthorityCandidateV1,
} from './repair-revenue-authority.contract';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { Role } from '../roles/entities/role.entity';
import { Employee } from '../performance/entities/employee.entity';
import { BusinessScopeGrant } from '../business-foundation/entities/business-foundation.entities';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import {
  RepairConfirmationRequest,
  RepairDeliveryRecord,
  RepairDocumentVersion,
  RepairQualityInspection,
  RepairWorkOrderProfile,
} from '../repair-shop/entities/repair-shop.entities';
import { FinanceCollectionOrder } from '../finance-reconciliation/entities/finance-collection-order.entity';
import { FinanceCollectionConfirmationAuthority } from '../finance-reconciliation/entities/finance-collection-confirmation-authority.entity';
import { FinanceReconciliationLink } from '../finance-reconciliation/entities/finance-reconciliation-link.entity';
import { BankSmsTransaction } from '../finance-bank-sms/entities/bank-sms-transaction.entity';
import { collectAuthorityEnvelopeProblems } from '../finance-reconciliation/collection-order-confirmation.contract';

/**
 * Internal, read-only, production-unwired repair formal fact loader candidate.
 *
 * This file is a pure loader used ONLY by the isolated candidate tests and the
 * future current-RBAC-first lock-safe formal fact loader Gate. It is NOT a
 * Nest provider, is NOT imported by the controller/module, BusinessContributionService,
 * BusinessContributionSourceAuthorityResolver or the adapters, and it does NOT
 * return the production contribution source snapshot. Production resolution
 * stays fail-closed and formal adapters remain 0/4.
 */

export const REPAIR_FORMAL_FACT_LOADER_SCHEMA_VERSION =
  'repair-formal-fact-loader-candidate-v1' as const;
export const REPAIR_FORMAL_FACT_LOADER_RULE_VERSION = 'gov1-s2-repair-fact-loader-v1' as const;

const WORK_ORDER_SOURCE_ID = /^work-order:([1-9]\d*)$/;
const WRITE_PERMISSION = 'gov1.contribution.draft.write' as const;
const NOWAIT: { mode: 'pessimistic_write'; onLocked: 'nowait' } = {
  mode: 'pessimistic_write',
  onLocked: 'nowait',
};

// Module-private branded RR transaction context. Never exported: it is the only
// proof the inner loader accepts, and it can only be minted by the public
// loadRepairAuthorityFactReceiptV1 operation.
const RR_CONTEXT = Symbol('repair-rr-context');

interface InternalRepairFormalFactsV1 {
  readonly status: 'loaded_revenue_only_direct_costs_unresolved';
  readonly schemaVersion: typeof REPAIR_FORMAL_FACT_LOADER_SCHEMA_VERSION;
  readonly ruleVersion: typeof REPAIR_FORMAL_FACT_LOADER_RULE_VERSION;
  readonly authorityGraphHash: string;
  readonly candidate: VerifiedRepairRevenueAuthorityCandidateV1;
}

/**
 * Non-authoritative diagnostic receipt only. It proves that the internal,
 * read-only loader completed for one transaction snapshot; it is NOT a formal
 * contribution source, revenue result, ownership result or adapter input.
 */
export interface RepairAuthorityFactDiagnosticReceiptV1 {
  readonly status: 'non_authoritative_diagnostic_receipt';
  readonly schemaVersion: typeof REPAIR_FORMAL_FACT_LOADER_SCHEMA_VERSION;
  readonly ruleVersion: typeof REPAIR_FORMAL_FACT_LOADER_RULE_VERSION;
  readonly factGraphHash: string;
}

interface LocatorScope {
  companyRef: string;
  businessSectorRef: string;
  storeRef: string;
  customerRef: string;
}

interface CollectionTuple {
  id: number;
  workOrderId: number;
  bankTransactionId: number;
  reconciliationLinkId: number;
  formalConfirmationAuthorityId: number;
}

function failClosed(code: string, message: string): never {
  throw new ConflictException(`[${code}] ${message}`);
}

function canonicalizeTransactionIsolation(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[-_\s]+/g, ' ');
}

async function assertCurrentRepeatableReadTransaction(manager: EntityManager): Promise<void> {
  if (!manager.queryRunner?.isTransactionActive) {
    failClosed(
      'repair_fact_loader_transaction_required',
      '汽修权威事实加载必须在活动事务内执行',
    );
  }

  let rows: Array<{
    state?: unknown;
    isolation_level?: unknown;
    autocommit?: unknown;
  }>;
  try {
    rows = (await manager.query(
      `SELECT trx.STATE AS state,
              trx.ISOLATION_LEVEL AS isolation_level,
              trx.AUTOCOMMIT AS autocommit
         FROM performance_schema.events_transactions_current trx
         JOIN performance_schema.threads th ON th.THREAD_ID = trx.THREAD_ID
        WHERE th.PROCESSLIST_ID = CONNECTION_ID()`,
    )) as typeof rows;
  } catch {
    failClosed(
      'repair_fact_loader_transaction_oracle_unavailable',
      '无法核验当前事务隔离级别，禁止加载汽修权威事实',
    );
  }

  if (rows.length !== 1) {
    failClosed(
      'repair_fact_loader_transaction_oracle_invalid',
      '当前连接缺少唯一活动事务证据，禁止加载汽修权威事实',
    );
  }
  const actualIsolation = canonicalizeTransactionIsolation(rows[0].isolation_level);
  const expectedIsolation = canonicalizeTransactionIsolation('REPEATABLE READ');
  const state = String(rows[0].state ?? '').trim().toUpperCase();
  const autocommit = String(rows[0].autocommit ?? '').trim().toUpperCase();
  if (
    actualIsolation !== expectedIsolation ||
    state !== 'ACTIVE' ||
    !['NO', '0'].includes(autocommit)
  ) {
    failClosed(
      'repair_fact_loader_transaction_isolation_invalid',
      '当前事务不是活动的 REPEATABLE READ 非自动提交事务，禁止加载汽修权威事实',
    );
  }
}

function assertTrustedBackendDataSourceBoundary(dataSource: DataSource): void {
  // This is an internal backend DI/runtime dependency boundary, not a capability
  // proof against arbitrary malicious code already executing in this Node
  // process. External/API callers never supply the DataSource. These checks catch
  // structural fakes, an uninitialized dependency, a wrong driver and accidental
  // manager/connection rebinding before any transaction or domain read.
  if (
    !(dataSource instanceof DataSource) ||
    !dataSource.isInitialized ||
    dataSource.options.type !== 'mysql' ||
    !(dataSource.manager instanceof EntityManager) ||
    dataSource.manager.connection !== dataSource
  ) {
    failClosed(
      'repair_fact_loader_data_source_invalid',
      '汽修权威事实诊断只接受后端依赖注入的已初始化 MySQL TypeORM DataSource',
    );
  }
}

function assertTransactionManagerIdentity(manager: EntityManager, dataSource: DataSource): void {
  const queryRunner = manager.queryRunner;
  if (
    !(manager instanceof EntityManager) ||
    manager.connection !== dataSource ||
    !queryRunner ||
    queryRunner.connection !== dataSource ||
    queryRunner.manager !== manager
  ) {
    failClosed(
      'repair_fact_loader_transaction_manager_invalid',
      '当前事务管理器与可信后端 DataSource/QueryRunner 不一致，禁止加载汽修权威事实',
    );
  }
}

function isNowaitContention(error: unknown): boolean {
  const code = (error as { code?: string; errno?: number })?.code;
  const errno = (error as { errno?: number })?.errno;
  return code === 'ER_LOCK_NOWAIT' || code === 'ER_LOCK_DEADLOCK' || errno === 3572 || errno === 1213;
}

function assertPositiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    failClosed('repair_fact_loader_integer_invalid', `${label} 必须是正整数`);
  }
  return Number(value);
}

export function parseRepairWorkOrderSourceId(sourceId: string): number {
  const match = WORK_ORDER_SOURCE_ID.exec(String(sourceId ?? '').trim().toLowerCase());
  if (!match) {
    throw new NotFoundException(
      '[repair_fact_loader_source_id_invalid] 汽修事实加载只接受 work-order:<正整数> 定位符',
    );
  }
  const id = Number(match[1]);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) {
    throw new NotFoundException(
      '[repair_fact_loader_source_id_invalid] 汽修事实加载定位符超出 MySQL 有符号 INT 范围',
    );
  }
  return id;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    return `{${entries
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashJson(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

function normalizeGrantPermissions(value: unknown): string[] {
  let raw: unknown = value;
  if (typeof value === 'string') {
    try {
      raw = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  if (raw.some((item) => typeof item !== 'string')) return [];
  return raw as string[];
}

async function innerLoadRepairAuthorityFactsV1(
  sourceId: string,
  currentUser: CurrentUser,
  manager: EntityManager,
  serverObservedAt: Date,
  rrToken: object,
): Promise<InternalRepairFormalFactsV1> {
  const workOrderId = parseRepairWorkOrderSourceId(sourceId);

  // (0) private brand + active guard, before any domain locator read. The public
  // wrapper has already proved current RR on this same connection; @@session is
  // never trusted because it reports only the session default.
  if ((manager as unknown as Record<symbol, unknown>)[RR_CONTEXT] !== rrToken) {
    failClosed(
      'repair_fact_loader_transaction_required',
      '汽修权威事实加载必须经固定诊断 receipt 操作在活动事务内执行',
    );
  }
  if (!manager.queryRunner?.isTransactionActive) {
    failClosed(
      'repair_fact_loader_transaction_required',
      '汽修权威事实加载必须在活动事务内执行',
    );
  }

  // (1) minimum-range locator scope projection.
  const locatorProfile = await manager.getRepository(RepairWorkOrderProfile).findOne({
    where: { workOrderId },
    select: [
      'id',
      'workOrderId',
      'companyRef',
      'businessSectorRef',
      'storeRef',
      'customerRef',
    ] as never,
  });
  if (!locatorProfile) {
    throw new NotFoundException('[repair_fact_loader_profile_missing] 汽修工单档案不存在');
  }
  const locatorScope: LocatorScope = {
    companyRef: locatorProfile.companyRef,
    businessSectorRef: locatorProfile.businessSectorRef,
    storeRef: locatorProfile.storeRef,
    customerRef: locatorProfile.customerRef,
  };

  // (2) transaction-current RBAC (may wait, stable order).
  await assertCurrentRbacRead(currentUser, locatorScope, manager);

  // (3) non-authoritative locator collection tuples (post-RBAC, pre-lock).
  const locatorOrders = await manager.getRepository(FinanceCollectionOrder).find({
    where: { workOrderId },
    order: { id: 'ASC' },
    select: [
      'id',
      'workOrderId',
      'bankTransactionId',
      'reconciliationLinkId',
      'formalConfirmationAuthorityId',
    ] as never,
  });
  const locatorTuples: CollectionTuple[] = locatorOrders.map((order) => ({
    id: Number(order.id),
    workOrderId: Number(order.workOrderId),
    bankTransactionId: Number(order.bankTransactionId),
    reconciliationLinkId: Number(order.reconciliationLinkId),
    formalConfirmationAuthorityId: Number(order.formalConfirmationAuthorityId),
  }));
  const bankIds = [
    ...new Set(locatorTuples.map((t) => t.bankTransactionId).filter((id) => id > 0)),
  ].sort((a, b) => a - b);
  const linkIds = [
    ...new Set(locatorTuples.map((t) => t.reconciliationLinkId).filter((id) => id > 0)),
  ].sort((a, b) => a - b);

  try {
    // (4) profile guard row (serial NOWAIT).
    const profile = await manager.getRepository(RepairWorkOrderProfile).findOne({
      where: { workOrderId },
      lock: NOWAIT,
    });
    if (!profile) failClosed('repair_fact_loader_profile_missing', '汽修工单档案不存在');
    assertScopeExact(profile, locatorScope);

    // (5) WorkOrder (serial NOWAIT).
    const workOrder = await manager.getRepository(WorkOrder).findOne({
      where: { id: workOrderId },
      lock: NOWAIT,
    });
    if (!workOrder) failClosed('repair_fact_loader_work_order_missing', '工单不存在');

    // (6) bank entities (serial NOWAIT, id ASC).
    const bankById = new Map<number, BankSmsTransaction>();
    for (const bankId of bankIds) {
      const bank = await manager.getRepository(BankSmsTransaction).findOne({
        where: { id: bankId },
        lock: NOWAIT,
      });
      if (!bank) failClosed('repair_fact_loader_bank_missing', '汽修收款银行流水缺失');
      bankById.set(bankId, bank);
    }

    // (7) link entities (serial NOWAIT, id ASC).
    const linkById = new Map<number, FinanceReconciliationLink>();
    for (const linkId of linkIds) {
      const link = await manager.getRepository(FinanceReconciliationLink).findOne({
        where: { id: linkId },
        lock: NOWAIT,
      });
      if (!link) failClosed('repair_fact_loader_link_missing', '汽修收款对账链接缺失');
      linkById.set(linkId, link);
    }

    // (8) collection range gap lock via FORCE INDEX + FOR UPDATE NOWAIT.
    const lockedIdRows = (await manager.query(
      `SELECT id FROM finance_collection_order
        FORCE INDEX (idx_finance_collection_work_order)
       WHERE work_order_id = ?
       ORDER BY id ASC
       FOR UPDATE NOWAIT`,
      [workOrderId],
    )) as Array<{ id: number }>;
    const lockedIds = lockedIdRows.map((row) => Number(row.id)).sort((a, b) => a - b);
    const locatorIds = locatorTuples.map((t) => t.id).sort((a, b) => a - b);
    if (JSON.stringify(lockedIds) !== JSON.stringify(locatorIds)) {
      failClosed(
        'repair_fact_loader_collection_set_phantom',
        '汽修收款集合在锁内发生幻读漂移，禁止形成候选',
      );
    }

    // (8b) locked full collection reread and full-tuple drift check.
    const collectionById = new Map<number, FinanceCollectionOrder>();
    for (const collectionId of lockedIds) {
      const order = await manager.getRepository(FinanceCollectionOrder).findOne({
        where: { id: collectionId },
        lock: NOWAIT,
      });
      if (!order) failClosed('repair_fact_loader_collection_missing', '汽修收款单缺失');
      const tuple: CollectionTuple = {
        id: Number(order.id),
        workOrderId: Number(order.workOrderId),
        bankTransactionId: Number(order.bankTransactionId),
        reconciliationLinkId: Number(order.reconciliationLinkId),
        formalConfirmationAuthorityId: Number(order.formalConfirmationAuthorityId),
      };
      const expected = locatorTuples.find((t) => t.id === tuple.id);
      if (
        !expected ||
        expected.workOrderId !== tuple.workOrderId ||
        expected.bankTransactionId !== tuple.bankTransactionId ||
        expected.reconciliationLinkId !== tuple.reconciliationLinkId ||
        expected.formalConfirmationAuthorityId !== tuple.formalConfirmationAuthorityId
      ) {
        failClosed(
          'repair_fact_loader_collection_tuple_drift',
          '汽修收款 tuple 在锁内漂移，禁止形成候选',
        );
      }
      collectionById.set(collectionId, order);
    }
    const lockedTuples: CollectionTuple[] = [...collectionById.values()]
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map((order) => ({
        id: Number(order.id),
        workOrderId: Number(order.workOrderId),
        bankTransactionId: Number(order.bankTransactionId),
        reconciliationLinkId: Number(order.reconciliationLinkId),
        formalConfirmationAuthorityId: Number(order.formalConfirmationAuthorityId),
      }));

    // (9) authorities (serial NOWAIT, id ASC).
    const authorityById = new Map<number, FinanceCollectionConfirmationAuthority>();
    const authorityIds = [
      ...new Set(lockedTuples.map((t) => t.formalConfirmationAuthorityId).filter((id) => id > 0)),
    ].sort((a, b) => a - b);
    for (const authorityId of authorityIds) {
      const authority = await manager.getRepository(FinanceCollectionConfirmationAuthority).findOne({
        where: { id: authorityId },
        lock: NOWAIT,
      });
      if (!authority) failClosed('repair_fact_loader_authority_missing', '汽修收款正式权威缺失');
      authorityById.set(authorityId, authority);
    }

    // (10) documents (serial NOWAIT, id ASC).
    const documents = await manager.getRepository(RepairDocumentVersion).find({
      where: { workOrderId },
      order: { id: 'ASC' },
      lock: NOWAIT,
    });

    // (11) confirmation requests (serial NOWAIT, id ASC).
    const confirmations = await manager.getRepository(RepairConfirmationRequest).find({
      where: { workOrderId },
      order: { id: 'ASC' },
      lock: NOWAIT,
    });

    // (12) quality inspections (serial NOWAIT, id ASC).
    const qualities = await manager.getRepository(RepairQualityInspection).find({
      where: { workOrderId },
      order: { id: 'ASC' },
      lock: NOWAIT,
    });

    // (13) delivery (serial NOWAIT).
    const delivery = await manager.getRepository(RepairDeliveryRecord).findOne({
      where: { workOrderId },
      lock: NOWAIT,
    });
    if (!delivery) failClosed('repair_fact_loader_delivery_missing', '汽修交车记录缺失');

    // (14) assemble input from locked entities, computing real envelope problems.
    const input: RepairRevenueAuthorityCandidateInputV1 = {
      profile: {
        workOrderId,
        companyRef: profile.companyRef,
        businessSectorRef: profile.businessSectorRef,
        storeRef: profile.storeRef,
        customerRef: profile.customerRef,
        vehicleId: profile.vehicleId,
        lifecycleStatus: profile.lifecycleStatus,
        customerConfirmationState: profile.customerConfirmationState,
        activePlanVersion: profile.activePlanVersion,
        activeQuoteVersion: profile.activeQuoteVersion,
        activeExplanationVersion: profile.activeExplanationVersion,
        latestApprovedDiagnosisVersion: deriveLatestDiagnosisVersion(documents),
        scopeResolvedAt: profile.scopeResolvedAt,
        scopeSnapshotVersion: quotedScopeSnapshot(profile),
        version: profile.version,
      },
      workOrder: { id: workOrder.id, workOrderNo: workOrder.workOrderNo },
      delivery: {
        id: delivery.id,
        workOrderId: delivery.workOrderId,
        planVersion: delivery.planVersion,
        quoteVersion: delivery.quoteVersion,
        explanationVersion: delivery.explanationVersion,
        financeEvidenceRefs: delivery.financeEvidenceRefs,
        quoteTotalSnapshot: delivery.quoteTotalSnapshot,
        financeReadyAmountSnapshot: delivery.financeReadyAmountSnapshot,
        customerAckEvidenceRef: delivery.customerAckEvidenceRef,
        deliveredByEmployeeId: delivery.deliveredByEmployeeId,
        deliveredAt: delivery.deliveredAt,
        createdBy: delivery.createdBy,
        createdAt: delivery.createdAt,
      },
      documents: decisionDocuments(documents),
      confirmationRequests: confirmations.map((row) => ({
        id: row.id,
        workOrderId: row.workOrderId,
        planVersion: row.planVersion,
        quoteVersion: row.quoteVersion,
        explanationVersion: row.explanationVersion,
        requestFingerprint: row.requestFingerprint,
        status: row.status,
        decisionEvidenceRef: row.decisionEvidenceRef,
        decidedBy: row.decidedBy,
        decidedAt: row.decidedAt,
        version: row.version,
      })),
      qualityInspections: qualities.map((row) => ({
        id: row.id,
        workOrderId: row.workOrderId,
        result: row.result,
        inspectedByEmployeeId: row.inspectedByEmployeeId,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
      })),
      collections: lockedTuples.map((tuple) => {
        const order = collectionById.get(tuple.id);
        const authority = authorityById.get(tuple.formalConfirmationAuthorityId);
        const bank = bankById.get(tuple.bankTransactionId);
        const link = linkById.get(tuple.reconciliationLinkId);
        if (!order || !authority) {
          failClosed('repair_fact_loader_authority_missing', '汽修收款正式权威缺失');
        }
        const envelopeProblems = collectAuthorityEnvelopeProblems({
          order,
          authority,
          profile,
          bank,
          link,
          workOrder,
        });
        return {
          collectionOrderId: tuple.id,
          workOrderId: tuple.workOrderId,
          authorityId: tuple.formalConfirmationAuthorityId,
          bankTransactionId: tuple.bankTransactionId,
          reconciliationLinkId: tuple.reconciliationLinkId,
          grossCents: authority.grossCents,
          currency: authority.currency,
          authorityCanonicalSnapshotHash: authority.canonicalSnapshotHash,
          authorityConfirmedAt: authority.authorityConfirmedAt,
          sourceOccurredAt: authority.sourceOccurredAt,
          envelopeProblems,
        };
      }),
    };

    const candidate = buildRepairRevenueAuthorityCandidateV1(input, serverObservedAt);
    const authorityGraphHash = hashJson(input);
    return deepFreeze({
      status: 'loaded_revenue_only_direct_costs_unresolved',
      schemaVersion: REPAIR_FORMAL_FACT_LOADER_SCHEMA_VERSION,
      ruleVersion: REPAIR_FORMAL_FACT_LOADER_RULE_VERSION,
      authorityGraphHash,
      candidate,
    });
  } catch (error) {
    if (isNowaitContention(error)) {
      failClosed(
        'repair_fact_loader_contention',
        '汽修权威图在当前事务下存在并发争用，请按稳定重试阻塞处理',
      );
    }
    throw error;
  }
}

function assertScopeExact(profile: RepairWorkOrderProfile, locatorScope: LocatorScope): void {
  if (
    profile.companyRef !== locatorScope.companyRef ||
    profile.businessSectorRef !== locatorScope.businessSectorRef ||
    profile.storeRef !== locatorScope.storeRef ||
    profile.customerRef !== locatorScope.customerRef
  ) {
    failClosed('repair_fact_loader_scope_drift', '锁内档案范围与定位/授权范围不一致');
  }
}

function deriveLatestDiagnosisVersion(documents: RepairDocumentVersion[]): number | null {
  const approved = documents.filter(
    (doc) => doc.documentType === 'diagnosis' && ['approved', 'authorized'].includes(doc.status),
  );
  if (!approved.length) return null;
  return approved.reduce((max, doc) => Math.max(max, doc.version), 0);
}

function decisionDocuments(
  documents: RepairDocumentVersion[],
): RepairRevenueAuthorityCandidateInputV1['documents'] {
  const allowed = new Set(['repair_plan', 'quote', 'customer_explanation']);
  return documents
    .filter((doc) => allowed.has(doc.documentType))
    .map((doc) => ({
      id: doc.id,
      workOrderId: doc.workOrderId,
      documentType: doc.documentType as 'repair_plan' | 'quote' | 'customer_explanation',
      version: doc.version,
      status: doc.status,
      payload: doc.payload,
      reviewedBy: doc.reviewedBy,
      reviewedAt: doc.reviewedAt,
    }));
}

async function assertCurrentRbacRead(
  currentUser: CurrentUser,
  scope: LocatorScope,
  manager: EntityManager,
): Promise<void> {
  // Reject non-trusted identity BEFORE any User/UserRole query.
  if (currentUser.identitySource !== 'trusted_proxy') {
    throw new ForbiddenException('[repair_fact_loader_identity_source_invalid] 非可信代理身份禁止加载汽修权威事实');
  }

  const user = await manager.getRepository(User).findOne({
    where: { id: currentUser.id },
    lock: { mode: 'pessimistic_read' },
  });
  if (!user || user.status !== 1 || user.username !== currentUser.username) {
    throw new ForbiddenException('[repair_fact_loader_actor_revoked] 当前正式人员已禁用或身份已变化');
  }

  const userRoles = await manager.getRepository(UserRole).find({
    where: { userId: user.id },
    order: { id: 'ASC' },
    lock: { mode: 'pessimistic_read' },
  });
  const boundRoleIds = userRoles.map((item) => item.roleId);
  const roleIds = [...new Set(boundRoleIds)].sort((a, b) => a - b);
  if (boundRoleIds.length !== roleIds.length) {
    throw new ForbiddenException('[repair_fact_loader_role_binding_duplicate] 当前正式人员角色绑定重复');
  }
  const roleCodes: string[] = [];
  for (const roleId of roleIds) {
    const role = await manager.getRepository(Role).findOne({
      where: { id: roleId },
      lock: { mode: 'pessimistic_read' },
    });
    if (!role) {
      throw new ForbiddenException('[repair_fact_loader_role_revoked] 当前正式角色绑定已失效');
    }
    roleCodes.push(role.code);
  }
  const lockedCurrentUser: CurrentUser = {
    ...currentUser,
    username: user.username,
    realName: user.realName,
    roleCodes,
  };
  if (!BusinessContributionAccessPolicy.canUseWritePermission(lockedCurrentUser, WRITE_PERMISSION)) {
    throw new ForbiddenException('[repair_fact_loader_role_denied] 事务当前角色无权执行汽修权威事实加载');
  }

  const employees = await manager.getRepository(Employee).find({
    where: { linkedUserId: user.id, status: 1 },
    order: { id: 'ASC' },
    lock: { mode: 'pessimistic_read' },
  });
  if (employees.length !== 1) {
    throw new ForbiddenException('[repair_fact_loader_employee_revoked] 当前人员缺少唯一有效员工绑定');
  }

  const grants = await manager.getRepository(BusinessScopeGrant).find({
    where: { userId: user.id, employeeId: employees[0].id, companyRef: scope.companyRef, status: 'active' },
    order: { id: 'ASC' },
    lock: { mode: 'pessimistic_read' },
  });
  const now = new Date();
  const matching = grants.filter((grant) => {
    const permissions = normalizeGrantPermissions(grant.permissions);
    if (!permissions.length) return false;
    const validFrom = grant.validFrom instanceof Date ? grant.validFrom : new Date(grant.validFrom);
    const validUntil = grant.validUntil == null ? null : grant.validUntil instanceof Date ? grant.validUntil : new Date(grant.validUntil);
    return (
      validFrom.getTime() <= now.getTime() &&
      (validUntil == null || validUntil.getTime() >= now.getTime()) &&
      (permissions.includes('*') || permissions.includes(WRITE_PERMISSION)) &&
      (grant.businessSectorRef == null || grant.businessSectorRef === scope.businessSectorRef) &&
      (grant.storeRef == null || grant.storeRef === scope.storeRef) &&
      (grant.customerRef == null || grant.customerRef === scope.customerRef)
    );
  });
  if (matching.some((grant) => grant.effect === 'deny')) {
    throw new ForbiddenException('[repair_fact_loader_scope_denied] 当前人员被明确禁止在该组织范围加载汽修权威事实');
  }
  if (!matching.some((grant) => grant.effect === 'allow')) {
    throw new ForbiddenException('[repair_fact_loader_scope_missing] 当前人员缺少该组织范围的汽修权威事实加载权限');
  }
}

/**
 * Fixed internal diagnostic operation. The trusted backend supplies its
 * dependency-injected DataSource; no controller/external caller can supply one.
 * This function owns the REPEATABLE READ lifecycle, proves the actual current
 * transaction on the same connection, runs the private loader, discards the raw
 * facts and returns only a non-authoritative diagnostic receipt after commit.
 *
 * A future formal adapter must implement a separate fixed module-internal
 * consumer and reload/validate under its own transaction. This receipt can never
 * be promoted into VerifiedContributionSourceSnapshot or a business write.
 */
export async function loadRepairAuthorityFactReceiptV1(
  dataSource: DataSource,
  currentUser: CurrentUser,
  sourceId: string,
  serverObservedAt: Date,
): Promise<RepairAuthorityFactDiagnosticReceiptV1> {
  assertTrustedBackendDataSourceBoundary(dataSource);
  const rrToken = {};
  return dataSource.transaction('REPEATABLE READ', async (manager) => {
    assertTransactionManagerIdentity(manager, dataSource);
    await assertCurrentRepeatableReadTransaction(manager);
    const branded = Object.assign(Object.create(manager) as EntityManager, {
      [RR_CONTEXT]: rrToken,
    });
    const internalFacts = await innerLoadRepairAuthorityFactsV1(
      sourceId,
      currentUser,
      branded,
      serverObservedAt,
      rrToken,
    );
    return deepFreeze({
      status: 'non_authoritative_diagnostic_receipt',
      schemaVersion: REPAIR_FORMAL_FACT_LOADER_SCHEMA_VERSION,
      ruleVersion: REPAIR_FORMAL_FACT_LOADER_RULE_VERSION,
      factGraphHash: internalFacts.authorityGraphHash,
    });
  });
}
