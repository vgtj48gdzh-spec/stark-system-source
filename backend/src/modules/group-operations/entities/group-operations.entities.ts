import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BUSINESS_CONTRIBUTION_ENTITIES } from './business-contribution.entities';

export type GroupStatus = 'active' | 'closed';
export type JobLevel = 'L0' | 'L1' | 'L2' | 'L3';
export type CompensationProfileStatus = 'approved' | 'superseded';
export type GroupTargetPolicyStatus = 'approved' | 'superseded';
export type PayrollCalendarRuleStatus = 'approved';
export type CalculationStatus =
  | 'calculated'
  | 'calculation_blocked'
  | 'recalculation_required'
  | 'locked';

@Entity('organization_groups')
@Index('uq_organization_group_code', ['groupCode'], { unique: true })
@Index('idx_organization_group_scope', ['companyRef', 'businessSectorRef', 'storeRef', 'status'])
@Index('uq_organization_group_idempotency', ['idempotencyKey'], { unique: true })
export class OrganizationGroup {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'group_code', type: 'varchar', length: 64 })
  groupCode!: string;

  @Column({ name: 'group_name', type: 'varchar', length: 160 })
  groupName!: string;

  @Column({ name: 'company_ref', type: 'varchar', length: 100 })
  companyRef!: string;

  @Column({ name: 'business_sector_ref', type: 'varchar', length: 100, nullable: true })
  businessSectorRef!: string | null;

  @Column({ name: 'store_ref', type: 'varchar', length: 100, nullable: true })
  storeRef!: string | null;

  @Column({ name: 'leader_employee_id', type: 'int', nullable: true })
  leaderEmployeeId!: number | null;

  @Column({ name: 'business_owner_employee_id', type: 'int', nullable: true })
  businessOwnerEmployeeId!: number | null;

  @Column({ name: 'established_at', type: 'date' })
  establishedAt!: string;

  @Column({ name: 'closed_at', type: 'date', nullable: true })
  closedAt!: string | null;

  @Column({ type: 'varchar', length: 24, default: 'active' })
  status!: GroupStatus;

  @Column({ name: 'safety_factor_policy_version_id', type: 'varchar', length: 100 })
  safetyFactorPolicyVersionId!: string;

  @Column({ name: 'ramp_up_policy_version_id', type: 'varchar', length: 100 })
  rampUpPolicyVersionId!: string;

  @Column({ name: 'change_reason', type: 'varchar', length: 500 })
  changeReason!: string;

  @Column({ name: 'source_channel', type: 'varchar', length: 50 })
  sourceChannel!: string;

  @Column({ name: 'correlation_id', type: 'varchar', length: 100 })
  correlationId!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 120 })
  idempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64 })
  requestFingerprint!: string;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'approved_by', type: 'int' })
  approvedBy!: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt!: Date;
}

@Entity('group_members')
@Index('idx_group_member_group_period', ['groupId', 'effectiveFrom', 'effectiveTo'])
@Index('idx_group_member_employee_period', ['employeeId', 'effectiveFrom', 'effectiveTo'])
@Index('uq_group_member_idempotency', ['idempotencyKey'], { unique: true })
@Index('uq_group_member_last_command_idempotency', ['lastCommandIdempotencyKey'], { unique: true })
export class GroupMember {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'group_id', type: 'int' })
  groupId!: number;

  @Column({ name: 'employee_id', type: 'int' })
  employeeId!: number;

  @Column({ name: 'job_level', type: 'varchar', length: 2 })
  jobLevel!: JobLevel;

  @Column({ name: 'role_code', type: 'varchar', length: 64 })
  roleCode!: string;

  @Column({ name: 'is_primary', type: 'tinyint', width: 1, default: 1 })
  isPrimary!: boolean;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom!: string;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo!: string | null;

  @Column({ name: 'responsibility_weight_bps', type: 'int', nullable: true })
  responsibilityWeightBps!: number | null;

  @Column({ name: 'cost_allocation_bps', type: 'int', default: 10000 })
  costAllocationBps!: number;

  @Column({ name: 'change_reason', type: 'varchar', length: 500 })
  changeReason!: string;

  @Column({ name: 'source_channel', type: 'varchar', length: 50 })
  sourceChannel!: string;

  @Column({ name: 'correlation_id', type: 'varchar', length: 100 })
  correlationId!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 120 })
  idempotencyKey!: string;

  @Column({ name: 'last_command_idempotency_key', type: 'varchar', length: 120 })
  lastCommandIdempotencyKey!: string;

  @Column({ name: 'create_request_fingerprint', type: 'char', length: 64 })
  createRequestFingerprint!: string;

  @Column({ name: 'last_command_fingerprint', type: 'char', length: 64 })
  lastCommandFingerprint!: string;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'approved_by', type: 'int' })
  approvedBy!: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt!: Date;
}

@Entity('payroll_calendar_rule_versions')
@Index(
  'uq_payroll_calendar_company_period_version',
  ['companyRef', 'settlementPeriod', 'calendarRuleVersionId'],
  { unique: true },
)
@Index('idx_payroll_calendar_company_period_status', [
  'companyRef',
  'settlementPeriod',
  'status',
])
@Index(
  'uq_payroll_calendar_company_period_sequence',
  ['companyRef', 'settlementPeriod', 'version'],
  { unique: true },
)
@Index('uq_payroll_calendar_idempotency', ['idempotencyKey'], { unique: true })
export class PayrollCalendarRuleVersion {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'company_ref', type: 'varchar', length: 100 })
  companyRef!: string;

  @Column({ name: 'settlement_period', type: 'char', length: 7 })
  settlementPeriod!: string;

  @Column({ name: 'calendar_rule_version_id', type: 'varchar', length: 100 })
  calendarRuleVersionId!: string;

  @Column({ name: 'payroll_dates_json', type: 'json' })
  payrollDatesJson!: string[];

  @Column({ name: 'payroll_date_set_hash', type: 'char', length: 64 })
  payrollDateSetHash!: string;

  @Column({ name: 'standard_payroll_days', type: 'int' })
  standardPayrollDays!: number;

  @Column({ type: 'varchar', length: 24, default: 'approved' })
  status!: PayrollCalendarRuleStatus;

  @Column({ type: 'int' })
  version!: number;

  @Column({ name: 'change_reason', type: 'varchar', length: 500 })
  changeReason!: string;

  @Column({ name: 'source_channel', type: 'varchar', length: 50 })
  sourceChannel!: string;

  @Column({ name: 'correlation_id', type: 'varchar', length: 100 })
  correlationId!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 120 })
  idempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64 })
  requestFingerprint!: string;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'approved_by', type: 'int' })
  approvedBy!: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt!: Date;
}

@Entity('group_target_policy_versions')
@Index('uq_group_target_policy_version_id', ['policyVersionId'], { unique: true })
@Index('uq_group_target_policy_group_period_version', ['groupId', 'settlementPeriod', 'version'], {
  unique: true,
})
@Index('uq_group_target_policy_scope_identity', ['id', 'groupId', 'settlementPeriod'], {
  unique: true,
})
@Index('idx_group_target_policy_group_period_status', ['groupId', 'settlementPeriod', 'status'])
@Index('uq_group_target_policy_idempotency', ['idempotencyKey'], { unique: true })
export class GroupTargetPolicyVersion {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'group_id', type: 'int' })
  groupId!: number;

  @Column({ name: 'settlement_period', type: 'char', length: 7 })
  settlementPeriod!: string;

  @Column({ name: 'policy_version_id', type: 'varchar', length: 100 })
  policyVersionId!: string;

  @Column({ name: 'safety_factor_bps', type: 'int' })
  safetyFactorBps!: number;

  @Column({ name: 'ramp_factor_bps', type: 'int' })
  rampFactorBps!: number;

  @Column({ name: 'standard_payroll_days', type: 'int' })
  standardPayrollDays!: number;

  @Column({ name: 'safety_factor_policy_version_id', type: 'varchar', length: 100 })
  safetyFactorPolicyVersionId!: string;

  @Column({ name: 'ramp_up_policy_version_id', type: 'varchar', length: 100 })
  rampUpPolicyVersionId!: string;

  @Column({ name: 'calendar_rule_version_id', type: 'varchar', length: 100 })
  calendarRuleVersionId!: string;

  @Column({ name: 'payroll_calendar_rule_id', type: 'int', nullable: true })
  payrollCalendarRuleId!: number | null;

  @Column({ name: 'payroll_date_set_hash', type: 'char', length: 64, nullable: true })
  payrollDateSetHash!: string | null;

  @Column({ type: 'char', length: 3, default: 'CNY' })
  currency!: 'CNY';

  @Column({ type: 'varchar', length: 24, default: 'approved' })
  status!: GroupTargetPolicyStatus;

  @Column({ type: 'int' })
  version!: number;

  @Column({ name: 'change_reason', type: 'varchar', length: 500 })
  changeReason!: string;

  @Column({ name: 'source_channel', type: 'varchar', length: 50 })
  sourceChannel!: string;

  @Column({ name: 'correlation_id', type: 'varchar', length: 100 })
  correlationId!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 120 })
  idempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64 })
  requestFingerprint!: string;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'approved_by', type: 'int' })
  approvedBy!: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt!: Date;
}

@Entity('compensation_profiles')
@Index('uq_compensation_profile_employee_version', ['employeeId', 'version'], { unique: true })
@Index('idx_compensation_profile_employee_period', ['employeeId', 'effectiveFrom', 'effectiveTo', 'status'])
@Index('uq_compensation_profile_idempotency', ['idempotencyKey'], { unique: true })
export class CompensationProfile {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'employee_id', type: 'int' })
  employeeId!: number;

  @Column({ name: 'base_guarantee_cents', type: 'bigint' })
  baseGuaranteeCents!: string;

  @Column({ name: 'position_performance_budget_cents', type: 'bigint' })
  positionPerformanceBudgetCents!: string;

  @Column({ name: 'employer_social_cost_cents', type: 'bigint' })
  employerSocialCostCents!: string;

  @Column({ name: 'fixed_benefit_cost_cents', type: 'bigint' })
  fixedBenefitCostCents!: string;

  @Column({ name: 'benefit_cash_offset_cents', type: 'bigint', default: '0' })
  benefitCashOffsetCents!: string;

  @Column({ name: 'other_fixed_employment_cost_cents', type: 'bigint' })
  otherFixedEmploymentCostCents!: string;

  @Column({ name: 'fully_loaded_labor_cost_cents', type: 'bigint' })
  fullyLoadedLaborCostCents!: string;

  @Column({ type: 'char', length: 3, default: 'CNY' })
  currency!: string;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom!: string;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo!: string | null;

  @Column({ name: 'benefit_rule_version_id', type: 'varchar', length: 100, nullable: true })
  benefitRuleVersionId!: string | null;

  @Column({ type: 'varchar', length: 24, default: 'approved' })
  status!: CompensationProfileStatus;

  @Column({ type: 'int' })
  version!: number;

  @Column({ name: 'change_reason', type: 'varchar', length: 500 })
  changeReason!: string;

  @Column({ name: 'source_channel', type: 'varchar', length: 50 })
  sourceChannel!: string;

  @Column({ name: 'correlation_id', type: 'varchar', length: 100 })
  correlationId!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 120 })
  idempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64 })
  requestFingerprint!: string;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'approved_by', type: 'int' })
  approvedBy!: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt!: Date;
}

@Entity('labor_cost_snapshots')
@Index(
  'uq_labor_cost_snapshot_member_period_version',
  ['groupMemberId', 'settlementPeriod', 'calculationVersion'],
  { unique: true },
)
@Index('uq_labor_cost_snapshot_idempotency', ['idempotencyKey'], { unique: true })
export class LaborCostSnapshot {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'group_id', type: 'int' })
  groupId!: number;

  @Column({ name: 'employee_id', type: 'int' })
  employeeId!: number;

  @Column({ name: 'group_member_id', type: 'int' })
  groupMemberId!: number;

  @Column({ name: 'compensation_profile_id', type: 'int' })
  compensationProfileId!: number;

  @Column({ name: 'settlement_period', type: 'char', length: 7 })
  settlementPeriod!: string;

  @Column({ name: 'calculation_version', type: 'int' })
  calculationVersion!: number;

  @Column({ name: 'job_level_snapshot', type: 'varchar', length: 2 })
  jobLevelSnapshot!: JobLevel;

  @Column({ name: 'role_code_snapshot', type: 'varchar', length: 64 })
  roleCodeSnapshot!: string;

  @Column({ name: 'active_payroll_days', type: 'int' })
  activePayrollDays!: number;

  @Column({ name: 'standard_payroll_days', type: 'int' })
  standardPayrollDays!: number;

  @Column({ name: 'calendar_rule_version_id', type: 'varchar', length: 100 })
  calendarRuleVersionId!: string;

  @Column({ type: 'char', length: 3, default: 'CNY' })
  currency!: 'CNY';

  @Column({ name: 'cost_allocation_bps', type: 'int' })
  costAllocationBps!: number;

  @Column({ name: 'base_guarantee_cents', type: 'bigint' })
  baseGuaranteeCents!: string;

  @Column({ name: 'position_performance_budget_cents', type: 'bigint' })
  positionPerformanceBudgetCents!: string;

  @Column({ name: 'employer_social_cost_cents', type: 'bigint' })
  employerSocialCostCents!: string;

  @Column({ name: 'fixed_benefit_cost_cents', type: 'bigint' })
  fixedBenefitCostCents!: string;

  @Column({ name: 'benefit_cash_offset_cents', type: 'bigint' })
  benefitCashOffsetCents!: string;

  @Column({ name: 'other_fixed_employment_cost_cents', type: 'bigint' })
  otherFixedEmploymentCostCents!: string;

  @Column({ name: 'fully_loaded_labor_cost_cents', type: 'bigint' })
  fullyLoadedLaborCostCents!: string;

  @Column({ name: 'prorated_labor_cost_cents', type: 'bigint' })
  proratedLaborCostCents!: string;

  @Column({ name: 'allocated_labor_cost_cents', type: 'bigint' })
  allocatedLaborCostCents!: string;

  @Column({ name: 'rounding_mode', type: 'varchar', length: 24 })
  roundingMode!: string;

  @Column({ name: 'profile_snapshot_json', type: 'json' })
  profileSnapshotJson!: Record<string, unknown>;

  @Column({ name: 'snapshot_status', type: 'varchar', length: 32, default: 'calculated' })
  snapshotStatus!: CalculationStatus;

  @Column({ name: 'source_channel', type: 'varchar', length: 50 })
  sourceChannel!: string;

  @Column({ name: 'correlation_id', type: 'varchar', length: 100 })
  correlationId!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 120 })
  idempotencyKey!: string;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'locked_at', type: 'datetime', nullable: true })
  lockedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;
}

@Entity('group_targets')
@Index('uq_group_target_period_version', ['groupId', 'settlementPeriod', 'calculationVersion'], {
  unique: true,
})
@Index('uq_group_target_idempotency', ['idempotencyKey'], { unique: true })
export class GroupTarget {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'group_id', type: 'int' })
  groupId!: number;

  @Column({ name: 'settlement_period', type: 'char', length: 7 })
  settlementPeriod!: string;

  @Column({ name: 'calculation_version', type: 'int' })
  calculationVersion!: number;

  @Column({ name: 'target_policy_id', type: 'int' })
  targetPolicyId!: number;

  @Column({ name: 'group_fixed_labor_cost_cents', type: 'bigint' })
  groupFixedLaborCostCents!: string;

  @Column({ name: 'safety_factor_bps', type: 'int' })
  safetyFactorBps!: number;

  @Column({ name: 'ramp_factor_bps', type: 'int' })
  rampFactorBps!: number;

  @Column({ name: 'standard_payroll_days', type: 'int' })
  standardPayrollDays!: number;

  @Column({ type: 'char', length: 3, default: 'CNY' })
  currency!: 'CNY';

  @Column({ name: 'break_even_target_cents', type: 'bigint' })
  breakEvenTargetCents!: string;

  @Column({ name: 'marginal_target_change_cents', type: 'bigint', default: '0' })
  marginalTargetChangeCents!: string;

  @Column({ name: 'member_snapshot_count', type: 'int', default: 0 })
  memberSnapshotCount!: number;

  @Column({ name: 'labor_cost_snapshot_ids', type: 'json' })
  laborCostSnapshotIds!: number[];

  @Column({ name: 'calculation_input_json', type: 'json' })
  calculationInputJson!: Record<string, unknown>;

  @Column({ name: 'calculation_status', type: 'varchar', length: 32 })
  calculationStatus!: CalculationStatus;

  @Column({ name: 'blocked_reason', type: 'varchar', length: 500, nullable: true })
  blockedReason!: string | null;

  @Column({ name: 'safety_factor_policy_version_id', type: 'varchar', length: 100 })
  safetyFactorPolicyVersionId!: string;

  @Column({ name: 'ramp_up_policy_version_id', type: 'varchar', length: 100 })
  rampUpPolicyVersionId!: string;

  @Column({ name: 'calendar_rule_version_id', type: 'varchar', length: 100 })
  calendarRuleVersionId!: string;

  @Column({ name: 'rounding_mode', type: 'varchar', length: 24 })
  roundingMode!: string;

  @Column({ name: 'source_channel', type: 'varchar', length: 50 })
  sourceChannel!: string;

  @Column({ name: 'correlation_id', type: 'varchar', length: 100 })
  correlationId!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 120 })
  idempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64 })
  requestFingerprint!: string;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'approved_by', type: 'int' })
  approvedBy!: number;

  @Column({ name: 'locked_at', type: 'datetime', nullable: true })
  lockedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;
}

export const GROUP_OPERATIONS_ENTITIES = [
  OrganizationGroup,
  GroupMember,
  PayrollCalendarRuleVersion,
  GroupTargetPolicyVersion,
  CompensationProfile,
  LaborCostSnapshot,
  GroupTarget,
  ...BUSINESS_CONTRIBUTION_ENTITIES,
] as const;
