import { gov1AcceptanceHttp } from './http';

export interface CommandMetadata {
  reason: string;
  sourceChannel: string;
  correlationId: string;
  idempotencyKey: string;
}

export interface OrganizationGroup {
  id: number;
  groupCode: string;
  groupName: string;
  companyRef: string;
  businessSectorRef: string | null;
  storeRef: string | null;
  leaderEmployeeId: number | null;
  businessOwnerEmployeeId: number | null;
  establishedAt: string;
  closedAt: string | null;
  status: 'active' | 'closed';
  safetyFactorPolicyVersionId: string;
  rampUpPolicyVersionId: string;
}

export interface GroupMember {
  id: number;
  groupId: number;
  employeeId: number;
  jobLevel: 'L0' | 'L1' | 'L2' | 'L3';
  roleCode: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  responsibilityWeightBps: number | null;
  costAllocationBps: number;
}

export interface CompensationProfile {
  id: number;
  employeeId: number;
  baseGuaranteeCents: string;
  positionPerformanceBudgetCents: string;
  employerSocialCostCents: string;
  fixedBenefitCostCents: string;
  benefitCashOffsetCents: string;
  otherFixedEmploymentCostCents: string;
  fullyLoadedLaborCostCents: string;
  currency: 'CNY';
  effectiveFrom: string;
  effectiveTo: string | null;
  status: 'approved' | 'superseded';
  version: number;
}

export interface PayrollCalendarRule {
  id: number;
  companyRef: string;
  settlementPeriod: string;
  calendarRuleVersionId: string;
  payrollDatesJson: string[];
  payrollDateSetHash: string;
  standardPayrollDays: number;
  status: 'approved';
  version: number;
}

export interface GroupTargetPolicy {
  id: number;
  groupId: number;
  settlementPeriod: string;
  policyVersionId: string;
  safetyFactorBps: number;
  rampFactorBps: number;
  standardPayrollDays: number;
  calendarRuleVersionId: string;
  safetyFactorPolicyVersionId: string;
  rampUpPolicyVersionId: string;
  payrollCalendarRuleId: number;
  payrollDateSetHash: string;
  currency: 'CNY';
  status: 'approved' | 'superseded';
  version: number;
}

export interface GroupTarget {
  id: number;
  groupId: number;
  settlementPeriod: string;
  calculationVersion: number;
  groupFixedLaborCostCents: string;
  breakEvenTargetCents: string;
  safetyFactorBps: number;
  rampFactorBps: number;
  standardPayrollDays: number;
  calculationStatus: 'calculated' | 'calculation_blocked' | 'recalculation_required' | 'locked';
  blockedReason: string | null;
  memberSnapshotCount: number;
  currency: 'CNY';
}

export type GroupOperatingStatus =
  | 'excellent'
  | 'achieved'
  | 'warning'
  | 'severe_warning'
  | 'business_failure';

export interface GroupContributionSummary {
  groupId: number;
  recognitionPeriod: string;
  currency: 'CNY';
  confirmedAndReversedRecordCount: number;
  appendOnlyCorrectionCount: number;
  validContributionMarginCents: string;
  byBusinessDomain: Record<
    string,
    { count: number; correctionCount: number; marginCents: string }
  >;
  targetSnapshot: null | {
    calculationVersion: number;
    calculationStatus: GroupTarget['calculationStatus'];
    groupFixedLaborCostCents: string;
    breakEvenTargetCents: string;
    currency: 'CNY';
  };
  formalSourceCoverage: {
    status: 'complete' | 'incomplete';
    requiredDomainCount: number;
    readyDomainCount: number;
    readyDomains: string[];
    blockedDomains: Array<{
      businessDomain: string;
      blockerCode: string;
    }>;
  };
  achievement:
    | {
        calculationStatus: 'calculated';
        achievementRateBps: string;
        operatingStatus: GroupOperatingStatus;
        excessMarginCents: string;
        rewardGateOpen: boolean;
        blockedReasonCode: null;
      }
    | {
        calculationStatus: 'calculation_blocked';
        achievementRateBps: null;
        operatingStatus: 'calculation_blocked';
        excessMarginCents: '0';
        rewardGateOpen: false;
        blockedReasonCode: string;
      };
  calculationRule: string;
}

export interface CalculationInputMember {
  groupMemberId: number;
  employeeId: number;
  activePayrollDays: number;
  profileSegments?: Array<{
    compensationProfileId: number;
    activePayrollDays: number;
  }>;
}

export interface GroupTargetInputPreview {
  status: 'ready' | 'calculation_blocked';
  blockers: string[];
  formalPayrollEffect: false;
  groupId: number;
  settlementPeriod: string;
  targetPolicyVersionId: string;
  standardPayrollDays: number;
  safetyFactorBps: number;
  rampFactorBps: number;
  groupFixedLaborCostCents?: string;
  breakEvenTargetCents?: string;
  previewFingerprint?: string;
  members: Array<Record<string, unknown>>;
  calculationInput: null | {
    settlementPeriod: string;
    targetPolicyVersionId: string;
    members: CalculationInputMember[];
  };
}

export interface HiringImpactPreview {
  groupId: number;
  settlementPeriod: string;
  currentBreakEvenTargetCents: string;
  addedFullyLoadedLaborCostCents: string;
  marginalTargetCents: string;
  projectedBreakEvenTargetCents: string;
  safetyFactorBps: number;
  rampFactorBps: number;
  currency: 'CNY';
  status: 'preview';
  formalPayrollEffect: false;
}

export function getOrganizationGroups(params?: Record<string, unknown>) {
  return gov1AcceptanceHttp.get('/group-operations/groups', { params });
}

export function getOrganizationGroup(id: number) {
  return gov1AcceptanceHttp.get(`/group-operations/groups/${id}`);
}

export function createOrganizationGroup(payload: Record<string, unknown> & CommandMetadata) {
  return gov1AcceptanceHttp.post('/group-operations/groups', payload);
}

export function addOrganizationGroupMember(
  groupId: number,
  payload: Record<string, unknown> & CommandMetadata,
) {
  return gov1AcceptanceHttp.post(`/group-operations/groups/${groupId}/members`, payload);
}

export function endOrganizationGroupMember(
  memberId: number,
  payload: { effectiveTo: string } & CommandMetadata,
) {
  return gov1AcceptanceHttp.patch(`/group-operations/members/${memberId}/end`, payload);
}

export function getCompensationProfiles(employeeId: number) {
  return gov1AcceptanceHttp.get(
    `/group-operations/employees/${employeeId}/compensation-profiles`,
  );
}

export function createCompensationProfile(
  employeeId: number,
  payload: Record<string, unknown> & CommandMetadata,
) {
  return gov1AcceptanceHttp.post(
    `/group-operations/employees/${employeeId}/compensation-profiles`,
    payload,
  );
}

export function createPayrollCalendarRule(payload: Record<string, unknown> & CommandMetadata) {
  return gov1AcceptanceHttp.post('/group-operations/payroll-calendar-rules', payload);
}

export function getPayrollCalendarRules(groupId: number, settlementPeriod: string) {
  return gov1AcceptanceHttp.get(
    `/group-operations/groups/${groupId}/payroll-calendar-rules/${settlementPeriod}`,
  );
}

export function createGroupTargetPolicy(
  groupId: number,
  payload: Record<string, unknown> & CommandMetadata,
) {
  return gov1AcceptanceHttp.post(
    `/group-operations/groups/${groupId}/target-policies`,
    payload,
  );
}

export function getGroupTargetPolicies(groupId: number, settlementPeriod: string) {
  return gov1AcceptanceHttp.get(
    `/group-operations/groups/${groupId}/target-policies/${settlementPeriod}`,
  );
}

export function previewGroupTargetCalculationInput(
  groupId: number,
  settlementPeriod: string,
  targetPolicyVersionId: string,
) {
  return gov1AcceptanceHttp.post(
    `/group-operations/groups/${groupId}/targets/${settlementPeriod}/calculation-input-preview`,
    { targetPolicyVersionId },
  );
}

export function calculateGroupTarget(
  groupId: number,
  payload: Record<string, unknown> & CommandMetadata,
) {
  return gov1AcceptanceHttp.post(`/group-operations/groups/${groupId}/targets`, payload);
}

export function getLatestGroupTarget(groupId: number, settlementPeriod: string) {
  return gov1AcceptanceHttp.get(
    `/group-operations/groups/${groupId}/targets/${settlementPeriod}`,
    {
      headers: { 'x-suppress-global-error': '1' },
    },
  );
}

export function getGroupContributionSummary(groupId: number, recognitionPeriod: string) {
  return gov1AcceptanceHttp.get(
    `/group-operations/contributions/groups/${groupId}/periods/${recognitionPeriod}/summary`,
    {
      headers: { 'x-suppress-global-error': '1' },
    },
  );
}

export function previewGroupHiringImpact(
  groupId: number,
  settlementPeriod: string,
  payload: Record<string, string>,
) {
  return gov1AcceptanceHttp.post(
    `/group-operations/groups/${groupId}/targets/${settlementPeriod}/hiring-impact-preview`,
    payload,
  );
}
