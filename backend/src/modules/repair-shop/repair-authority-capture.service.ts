import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { BusinessFoundationService } from '../business-foundation/business-foundation.service';
import { proposeRepairEconomicLineageV1, approveRepairEconomicLineageV1 } from '../group-operations/repair-economic-lineage-authority.contract';
import { draftRepairResponsibilityAttributionAuthorityV1, submitRepairResponsibilityAttributionAuthorityV1, decideRepairResponsibilityAttributionAuthorityV1 } from '../group-operations/repair-responsibility-attribution-authority.contract';
import { draftRepairBaselineCostEventAuthorityV1, submitRepairBaselineCostEventAuthorityV1, decideRepairBaselineCostEventAuthorityV1 } from '../group-operations/repair-baseline-cost-event-authority.contract';
import { RepairAuthorityCaptureAction as Action, RepairAuthorityCaptureFamily as Family } from './dto/repair-authority-capture.dto';
import { buildRepairCaptureReviewChecklistV1 } from './repair-capture-review-checklist';

type Row = Record<string, unknown>;
const MAKER_ROLES = ['group_leader', 'business_owner', 'admin', 'finance', 'founder', 'super_admin', 'owner'];
const CHECKER_ROLES = ['admin', 'finance', 'founder', 'super_admin', 'owner'];
const PERMISSIONS = {
  lineage: ['gov1.repair.lineage.propose', 'gov1.repair.lineage.approve'],
  assignment: ['gov1.repair.assignment.draft', 'gov1.repair.assignment.submit', 'gov1.repair.assignment.decide'],
  baseline: ['gov1.repair.cost_event.draft', 'gov1.repair.cost_event.submit', 'gov1.repair.cost_event.decide'],
} as const;

@Injectable()
export class RepairAuthorityCaptureService {
  constructor(private readonly dataSource: DataSource, private readonly foundation: BusinessFoundationService) {}

  async execute(action: Action, command: unknown, actor: CurrentUser) {
    this.assertIdentity(actor);
    try {
      // No facade transaction, SQL write, auto-submit, auto-approve or chained
      // action. The immutable contracts own current RBAC, locks and idempotency.
      switch (action) {
        case Action.LineagePropose: return await proposeRepairEconomicLineageV1(this.dataSource, actor, command);
        case Action.LineageApprove: return await approveRepairEconomicLineageV1(this.dataSource, actor, command);
        case Action.AssignmentDraft: return await draftRepairResponsibilityAttributionAuthorityV1(this.dataSource, actor, command);
        case Action.AssignmentSubmit: return await submitRepairResponsibilityAttributionAuthorityV1(this.dataSource, actor, command);
        case Action.AssignmentDecide: return await decideRepairResponsibilityAttributionAuthorityV1(this.dataSource, actor, command);
        case Action.BaselineDraft: return await draftRepairBaselineCostEventAuthorityV1(this.dataSource, actor, command);
        case Action.BaselineSubmit: return await submitRepairBaselineCostEventAuthorityV1(this.dataSource, actor, command);
        case Action.BaselineDecide: return await decideRepairBaselineCostEventAuthorityV1(this.dataSource, actor, command);
        default: throw new BadRequestException('[repair_capture_action_invalid] 不支持的资料操作');
      }
    } catch (error) { this.safeFailure(error); }
  }

  async read(workOrderId: number, family: Family, actor: CurrentUser) {
    this.assertIdentity(actor);
    if (!Number.isSafeInteger(workOrderId) || workOrderId <= 0 || !Object.values(Family).includes(family)) {
      throw new BadRequestException('[repair_capture_target_invalid] 工单或资料类型无效');
    }
    try {
      return await this.dataSource.transaction('REPEATABLE READ', async (manager) => {
        // Read-only projection in one snapshot. Domain commands independently
        // reauthorize at mutation time; this response is never a write token.
        const currentActor = await this.currentActor(actor, manager);
        const profiles = await manager.query(
          `SELECT work_order_id, company_ref, business_sector_ref, store_ref, customer_ref, version
             FROM repair_work_order_profiles WHERE work_order_id = ?`, [workOrderId],
        ) as Row[];
        if (profiles.length !== 1) throw new NotFoundException('[repair_capture_profile_missing] 工单档案不可用');
        const profile = profiles[0];
        const scope = { companyRef: String(profile.company_ref), businessSectorRef: String(profile.business_sector_ref), storeRef: String(profile.store_ref), customerRef: String(profile.customer_ref) };
        const capabilities: Record<string, boolean> = {};
        for (const permission of PERMISSIONS[family]) {
          const phase = permission.split('.').slice(-1)[0];
          const allowedRoles = phase === 'approve' || phase === 'decide' ? CHECKER_ROLES : MAKER_ROLES;
          capabilities[phase] = false;
          if (!currentActor.roleCodes.some((role) => allowedRoles.includes(role))) continue;
          try {
            await this.foundation.assertAccess(currentActor, scope, permission, manager);
            capabilities[phase] = true;
          } catch (error) { if (!(error instanceof ForbiddenException)) throw error; }
        }
        if (!Object.values(capabilities).some(Boolean)) throw new ForbiddenException('[repair_capture_scope_denied] 无权读取此类正式资料');
        const records = family === Family.Lineage
          ? await this.lineageRecords(workOrderId, currentActor.id, capabilities, manager)
          : await this.authorityRecords(workOrderId, family, currentActor.id, capabilities, manager);
        const projection = {
          workOrderRef: `work-order:${workOrderId}`, profileVersion: this.positiveId(profile.version), family,
          capabilities, records,
          boundaries: { projectionOnly: true, formalContributionEnabled: false, wageEnabled: false, firstProfile: 'repair_zero_external_direct_cost_v1', nonzeroCostAdmissible: false },
        };
        return { ...projection, reviewChecklist: buildRepairCaptureReviewChecklistV1(projection, currentActor.id) };
      });
    } catch (error) { this.safeFailure(error); }
  }

  private assertIdentity(actor: CurrentUser) {
    if (!actor || actor.identitySource !== 'trusted_proxy' || !Number.isSafeInteger(actor.id) || actor.id <= 0) {
      throw new ForbiddenException('[repair_capture_identity_required] 必须使用可信代理绑定的正式人员身份');
    }
  }

  private async currentActor(actor: CurrentUser, manager: EntityManager): Promise<CurrentUser> {
    const users = await manager.query('SELECT id, username, status FROM users WHERE id = ?', [actor.id]) as Row[];
    if (users.length !== 1 || Number(users[0].status) !== 1 || users[0].username !== actor.username) {
      throw new ForbiddenException('[repair_capture_actor_revoked] 正式人员身份已撤销');
    }
    const bindings = await manager.query('SELECT role_id FROM user_roles WHERE user_id = ? ORDER BY role_id, id', [actor.id]) as Row[];
    const roleIds = bindings.map((row) => this.positiveId(row.role_id));
    if (!roleIds.length || roleIds.length !== new Set(roleIds).size) throw new ForbiddenException('[repair_capture_roles_invalid] 正式角色无效');
    const roles = await manager.query(`SELECT id, code FROM roles WHERE id IN (${roleIds.map(() => '?').join(',')}) ORDER BY id`, roleIds) as Row[];
    if (roles.length !== roleIds.length || roles.some((row) => !roleIds.includes(Number(row.id)))) throw new ForbiddenException('[repair_capture_roles_revoked] 正式角色已撤销');
    const codes = roles.map((row) => String(row.code));
    if (!codes.some((code) => MAKER_ROLES.includes(code))) throw new ForbiddenException('[repair_capture_role_denied] 当前角色无权读取正式资料');
    const employees = await manager.query('SELECT id FROM employees WHERE linked_user_id = ? AND status = 1 ORDER BY id', [actor.id]) as Row[];
    if (employees.length !== 1) throw new ForbiddenException('[repair_capture_employee_binding_invalid] 缺少唯一有效员工绑定');
    return { ...actor, roleCodes: codes };
  }

  private async lineageRecords(workOrderId: number, actorId: number, capabilities: Record<string, boolean>, manager: EntityManager) {
    const rows = await manager.query(
      `SELECT id, decision_ref, phase, proposal_decision_id, relation_type, predecessor_work_order_id,
              target_work_order_id, evidence_hash, expected_target_version, expected_predecessor_version, actor_user_id
         FROM repair_economic_lineage_decisions FORCE INDEX (idx_repair_lineage_decision_target)
        WHERE target_work_order_id = ? ORDER BY id DESC LIMIT 51`, [workOrderId],
    ) as Row[];
    this.assertBounded(rows);
    for (const row of rows) {
      this.code(row.phase, ['proposal', 'approval']);
      this.positiveId(row.actor_user_id);
      if (this.positiveId(row.target_work_order_id) !== workOrderId) throw new ConflictException('[repair_capture_record_invalid] 工单关联无效');
    }
    return rows.map((row) => ({
      ref: `lineage-decision:${this.hash(row.decision_ref)}`,
      status: row.phase === 'approval' ? 'accepted' : rows.some((other) => Number(other.proposal_decision_id) === Number(row.id)) ? 'approved' : 'pending_checker_approval',
      relationType: this.code(row.relation_type, ['origin', 'cancel_recreate']),
      workOrderRef: `work-order:${this.positiveId(row.target_work_order_id)}`,
      predecessorWorkOrderRef: row.predecessor_work_order_id == null ? null : `work-order:${this.positiveId(row.predecessor_work_order_id)}`,
      evidenceHash: this.hash(row.evidence_hash),
      expectedTargetVersion: this.positiveId(row.expected_target_version),
      expectedPredecessorVersion: row.expected_predecessor_version == null ? null : this.positiveId(row.expected_predecessor_version),
      canApprove: capabilities.approve === true && row.phase === 'proposal' && Number(row.actor_user_id) !== actorId
        && !rows.some((other) => Number(other.proposal_decision_id) === Number(row.id)),
    }));
  }

  private async authorityRecords(workOrderId: number, family: Family.Assignment | Family.Baseline, actorId: number, capabilities: Record<string, boolean>, manager: EntityManager) {
    const roots = await manager.query('SELECT economic_root_id FROM repair_work_order_economic_lineages WHERE work_order_id = ?', [workOrderId]) as Row[];
    if (!roots.length) return [];
    if (roots.length !== 1) throw new ConflictException('[repair_capture_lineage_invalid] 经济事实关联不唯一');
    const assignment = family === Family.Assignment;
    const rows = await manager.query(assignment
      ? `SELECT id, authority_ref, work_order_id, authority_version, content_hash, status, created_by_user_id,
                submitted_by_user_id, responsibility_employee_id, responsibility_effective_from, responsibility_effective_to,
                responsibility_evidence_hash, expected_work_order_version, supersedes_authority_id
           FROM repair_contribution_assignment_authorities FORCE INDEX (uq_repair_assignment_root_version)
          WHERE economic_root_id = ? AND work_order_id = ? ORDER BY authority_version DESC LIMIT 51`
      : `SELECT id, authority_ref, work_order_id, authority_version, content_hash, status, created_by_user_id,
                submitted_by_user_id, total_direct_cost_cents, profile_eligibility, assignment_authority_id,
                assignment_authority_version, assignment_content_hash, expected_work_order_version, supersedes_authority_id
           FROM repair_cost_event_authorities FORCE INDEX (uq_rce_root_version)
          WHERE economic_root_id = ? AND work_order_id = ? ORDER BY authority_version DESC LIMIT 51`,
      [roots[0].economic_root_id, workOrderId],
    ) as Row[];
    this.assertBounded(rows);
    const records: Row[] = [];
    for (const row of rows) {
      if (this.positiveId(row.work_order_id) !== workOrderId) throw new ConflictException('[repair_capture_record_invalid] 工单关联无效');
      const makerId = this.positiveId(row.created_by_user_id);
      const superseded = row.supersedes_authority_id == null ? null : rows.find((candidate) => Number(candidate.id) === this.positiveId(row.supersedes_authority_id));
      if (row.supersedes_authority_id != null && !superseded) throw new ConflictException('[repair_capture_cross_order_history] 被替代版本不在本工单安全视图中，需另行核验历史范围');
      if (row.status === 'submitted' && this.positiveId(row.submitted_by_user_id) !== makerId) throw new ConflictException('[repair_capture_record_invalid] 提交人员关联无效');
      const lines = await manager.query(assignment
        ? `SELECT role, employee_id, share_bps, effective_from, effective_to, evidence_hash
             FROM repair_contribution_assignment_attributions WHERE authority_id = ? ORDER BY role, employee_id LIMIT 51`
        : `SELECT category, disposition, amount_cents, occurred_at, evidence_hash
             FROM repair_cost_event_authority_lines WHERE authority_id = ? ORDER BY category LIMIT 6`, [row.id],
      ) as Row[];
      if ((assignment && (lines.length < 3 || lines.length > 30 || new Set(lines.map((line) => line.role)).size !== 3 || new Set(lines.map((line) => `${line.role}:${line.employee_id}`)).size !== lines.length || lines.reduce((sum, line) => sum + this.bps(line.share_bps), 0) !== 10000)) || (!assignment && (lines.length !== 5 || new Set(lines.map((line) => line.category)).size !== 5))) throw new ConflictException('[repair_capture_lines_invalid] 正式资料明细不完整');
      let assignmentRef: string | undefined;
      if (!assignment) {
        const linked = await manager.query('SELECT authority_ref, authority_version, content_hash FROM repair_contribution_assignment_authorities WHERE id = ?', [row.assignment_authority_id]) as Row[];
        if (linked.length !== 1 || Number(linked[0].authority_version) !== Number(row.assignment_authority_version) || linked[0].content_hash !== row.assignment_content_hash) throw new ConflictException('[repair_capture_assignment_invalid] 责任归因版本关联无效');
        assignmentRef = `repair-assignment:${this.hash(linked[0].authority_ref)}`;
      }
      const details = assignment
        ? { responsibilityEmployeeRef: `employee:${this.positiveId(row.responsibility_employee_id)}`, responsibilityEffectiveFrom: this.instant(row.responsibility_effective_from), responsibilityEffectiveTo: this.instant(row.responsibility_effective_to), responsibilityEvidenceHash: this.hash(row.responsibility_evidence_hash), attributions: lines.map((line) => ({ role: this.code(line.role, ['lead_originator', 'business_owner', 'service_owner']), employeeRef: `employee:${this.positiveId(line.employee_id)}`, shareBps: this.bps(line.share_bps), effectiveFrom: this.instant(line.effective_from), effectiveTo: this.instant(line.effective_to), evidenceHash: this.hash(line.evidence_hash) })) }
        : { totalDirectCostCents: this.cents(row.total_direct_cost_cents), profileEligibility: this.code(row.profile_eligibility, ['eligible', 'blocked_external_cost']), assignmentAuthorityRef: assignmentRef, assignmentAuthorityVersion: this.positiveId(row.assignment_authority_version), assignmentContentHash: this.hash(row.assignment_content_hash), declarations: lines.map((line) => ({ category: this.code(line.category, ['parts', 'outsourced', 'other_direct', 'refund', 'rework']), disposition: this.code(line.disposition, ['confirmed_cost', 'not_applicable']), amountCents: this.cents(line.amount_cents), occurredAt: this.instant(line.occurred_at), evidenceHash: this.hash(line.evidence_hash) })) };
      records.push({
        ref: `${assignment ? 'repair-assignment' : 'repair-cost-event'}:${this.hash(row.authority_ref)}`,
        workOrderRef: `work-order:${this.positiveId(row.work_order_id)}`,
        authorityVersion: this.positiveId(row.authority_version), contentHash: this.hash(row.content_hash),
        status: this.code(row.status, ['draft', 'submitted', 'approved', 'rejected', 'superseded']),
        expectedWorkOrderVersion: this.positiveId(row.expected_work_order_version), details,
        supersedesAuthorityRef: superseded ? `${assignment ? 'repair-assignment' : 'repair-cost-event'}:${this.hash(superseded.authority_ref)}` : null,
        supersedesAuthorityVersion: superseded ? this.positiveId(superseded.authority_version) : null,
        canSubmit: capabilities.submit === true && row.status === 'draft' && makerId === actorId,
        canDecide: capabilities.decide === true && row.status === 'submitted' && Number(row.submitted_by_user_id) !== actorId && makerId !== actorId,
      });
    }
    return records;
  }

  private positiveId(value: unknown): number { const n = Number(value); if (!Number.isSafeInteger(n) || n <= 0) throw new ConflictException('[repair_capture_record_invalid] 正式资料标识无效'); return n; }
  private bps(value: unknown): number { const n = Number(value); if (!Number.isInteger(n) || n <= 0 || n > 10000) throw new ConflictException('[repair_capture_record_invalid] 归因比例无效'); return n; }
  private hash(value: unknown): string { if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) throw new ConflictException('[repair_capture_record_invalid] 正式资料摘要无效'); return value; }
  private cents(value: unknown): string { const v = String(value); if (!/^(0|[1-9]\d{0,18})$/.test(v) || BigInt(v) > 9223372036854775807n) throw new ConflictException('[repair_capture_record_invalid] 声明金额无效'); return v; }
  private code(value: unknown, allowed: readonly string[]): string { if (typeof value !== 'string' || !allowed.includes(value)) throw new ConflictException('[repair_capture_record_invalid] 正式资料枚举无效'); return value; }
  private instant(value: unknown): string | null { if (value == null) return null; const date = value instanceof Date ? value : new Date(String(value).replace(' ', 'T') + (/[zZ]|[+-]\d\d:\d\d$/.test(String(value)) ? '' : 'Z')); if (!Number.isFinite(date.getTime())) throw new ConflictException('[repair_capture_record_invalid] 正式资料时间无效'); return date.toISOString(); }
  private assertBounded(rows: Row[]) { if (rows.length > 50) throw new ConflictException('[repair_capture_history_limit] 历史版本超过当前安全展示上限，禁止省略后继续复核'); }
  private safeFailure(error: unknown): never {
    const status = error instanceof HttpException ? error.getStatus() : 503;
    const code = error instanceof HttpException ? /^\[(repair_[a-z0-9_]+)\]/.exec(error.message)?.[1] : null;
    throw new HttpException(`[${code ?? 'repair_capture_unavailable'}] 资料操作未完成；请核对权限、版本和证据后重试，勿重复自动提交`, status >= 400 && status <= 599 ? status : 503);
  }
}
