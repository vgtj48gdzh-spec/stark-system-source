import { computed, ref } from 'vue';

export type RoleCode =
  | 'admin'
  | 'operator'
  | 'finance'
  | 'approver'
  | 'super_admin'
  | 'owner'
  | 'finance_manager'
  | 'finance_operator'
  | 'auditor'
  | 'founder'
  | 'business_owner'
  | 'group_leader';

export interface RoleProfile {
  code: RoleCode;
  label: string;
  userId: number;
  homePath: string;
}

export interface AuthenticatedUserIdentity {
  id: number;
  username: string;
  realName: string;
  roleCodes: string[];
  identitySource: 'trusted_proxy' | 'development_override' | 'default_user';
  formalIdentityBound: boolean;
}

export type PermissionKey =
  | 'workOrderMaterial.create'
  | 'workOrderMaterial.update'
  | 'workOrderMaterial.delete'
  | 'workOrderMaterial.audit'
  | 'workOrderMaterial.includeDeleted'
  | 'inventory.view'
  | 'inventory.inbound'
  | 'inventory.outbound'
  | 'materialPreparation.create'
  | 'materialPreparation.bind'
  | 'materialPreparation.audit'
  | 'materialPreparation.view'
  | 'operationLog.view'
  | 'abcSync.dashboard.view'
  | 'abcSync.orders.view'
  | 'abcSync.funds.view'
  | 'abcSync.cards.view'
  | 'abcSync.cardLedger.view'
  | 'abcSync.materials.view'
  | 'abcSync.suppliers.view'
  | 'abcSync.warehouses.view'
  | 'abcSync.inventoryLedger.view'
  | 'abcSync.jobRuns.view'
  | 'abcSync.mappingExceptions.view'
  | 'abcSync.cardMappingExceptions.view'
  | 'abcSync.inventoryMappingExceptions.view'
  | 'abcSync.rules.manage'
  | 'abcSync.normalization.rerun'
  | 'performance.bindings.view'
  | 'performance.bindings.manage'
  | 'performance.rules.view'
  | 'performance.rules.manage'
  | 'performance.events.view'
  | 'performance.events.generate'
  | 'performance.summaries.view'
  | 'performance.summaries.generate'
  | 'performance.pending.view'
  | 'performance.pending.process'
  | 'businessStats.tags.view'
  | 'businessStats.tags.generate'
  | 'businessStats.tags.manage'
  | 'businessStats.events.view'
  | 'businessStats.events.generate'
  | 'businessStats.events.process'
  | 'businessStats.rules.view'
  | 'businessStats.rules.manage'
  | 'businessStats.summaries.view'
  | 'businessStats.summaries.generate'
  | 'businessStats.summaries.confirm'
  | 'businessStats.pending.view'
  | 'payrollTrials.view'
  | 'payrollTrials.generate'
  | 'payrollTrials.confirm'
  | 'payrollTrials.pending.view'
  | 'engagement.contents.view'
  | 'engagement.contents.manage'
  | 'engagement.interactions.view'
  | 'engagement.interactions.manage'
  | 'engagement.memories.view'
  | 'engagement.memories.manage'
  | 'engagement.links.view'
  | 'engagement.links.manage'
  | 'engagement.recommendations.view'
  | 'engagement.recommendations.manage'
  | 'engagement.leads.view'
  | 'engagement.leads.manage'
  | 'engagement.attributions.view'
  | 'engagement.attributions.manage'
  | 'engagement.profiles.view'
  | 'engagement.followups.view'
  | 'engagement.importBatches.view'
  | 'engagement.importBatches.manage'
  | 'engagement.importRecords.view'
  | 'engagement.platformLeads.view'
  | 'engagement.platformLeads.manage'
  | 'engagement.connectorConfigs.view'
  | 'engagement.connectorConfigs.manage'
  | 'engagement.recommendationRules.view'
  | 'engagement.recommendationRules.manage'
  | 'engagement.scriptTemplates.view'
  | 'engagement.scriptTemplates.manage'
  | 'engagement.scriptExperiments.view'
  | 'engagement.scriptExperiments.manage'
  | 'engagement.followupFeedback.view'
  | 'engagement.followupFeedback.manage'
  | 'engagement.executionPlaybooks.view'
  | 'engagement.executionPlaybooks.manage'
  | 'engagement.executionTasks.view'
  | 'engagement.executionTasks.manage'
  | 'engagement.executionTasks.operate'
  | 'engagement.executionResults.view'
  | 'engagement.executionResults.manage'
  | 'employeeBenefits.issues.view'
  | 'employeeBenefits.issues.create'
  | 'employeeBenefits.issues.confirm'
  | 'employeeBenefits.issues.issue'
  | 'employeeBenefits.accounts.view'
  | 'employeeBenefits.notifications.view'
  | 'employeeBenefits.notifications.read'
  | 'employeeBenefits.aiContext.view'
  | 'groupOperations.view'
  | 'groupOperations.compensation.view'
  | 'groupOperations.compensation.manage'
  | 'groupOperations.target.view'
  | 'groupOperations.target.manage'
  | 'groupOperations.group.manage'
  | 'groupOperations.hiringPreview'
  | 'report.workOrderMaterialCosts'
  | 'report.inventoryAlerts'
  | 'report.unboundOverduePreparations'
  | 'report.supplierMaterialUsage';

const STORAGE_KEY = 'stark-system-role-code';

export const roleProfiles: Record<RoleCode, RoleProfile> = {
  admin: {
    code: 'admin',
    label: '管理员',
    userId: 1,
    homePath: '/work-orders',
  },
  operator: {
    code: 'operator',
    label: '操作员',
    userId: 2,
    homePath: '/work-orders',
  },
  finance: {
    code: 'finance',
    label: '财务',
    userId: 3,
    homePath: '/abc-sync/dashboard',
  },
  approver: {
    code: 'approver',
    label: '审批人',
    userId: 4,
    homePath: '/abc-sync/dashboard',
  },
  super_admin: {
    code: 'super_admin',
    label: '超级管理员',
    userId: 101,
    homePath: '/finance/bank-sms',
  },
  owner: {
    code: 'owner',
    label: '老板',
    userId: 102,
    homePath: '/finance/bank-sms',
  },
  finance_manager: {
    code: 'finance_manager',
    label: '财务经理',
    userId: 103,
    homePath: '/finance/bank-sms',
  },
  finance_operator: {
    code: 'finance_operator',
    label: '财务专员',
    userId: 104,
    homePath: '/finance/bank-sms',
  },
  auditor: {
    code: 'auditor',
    label: '审计员',
    userId: 105,
    homePath: '/finance/virtual-amount-check',
  },
  founder: {
    code: 'founder',
    label: '集团管理层',
    userId: 106,
    homePath: '/group-operations',
  },
  business_owner: {
    code: 'business_owner',
    label: '业务负责人',
    userId: 107,
    homePath: '/group-operations',
  },
  group_leader: {
    code: 'group_leader',
    label: '小组组长',
    userId: 108,
    homePath: '/group-operations',
  },
};

export const roleOptions = Object.values(roleProfiles);

const permissionMatrix: Record<PermissionKey, RoleCode[]> = {
  'workOrderMaterial.create': ['operator'],
  'workOrderMaterial.update': ['operator'],
  'workOrderMaterial.delete': ['admin'],
  'workOrderMaterial.audit': ['admin'],
  'workOrderMaterial.includeDeleted': ['admin'],
  'inventory.view': ['operator', 'finance'],
  'inventory.inbound': ['finance'],
  'inventory.outbound': ['admin'],
  'materialPreparation.create': ['operator'],
  'materialPreparation.bind': ['admin'],
  'materialPreparation.audit': ['finance', 'approver'],
  'materialPreparation.view': ['operator', 'finance', 'approver'],
  'operationLog.view': ['finance', 'approver'],
  'abcSync.dashboard.view': ['finance', 'approver'],
  'abcSync.orders.view': ['finance'],
  'abcSync.funds.view': ['finance'],
  'abcSync.cards.view': ['finance'],
  'abcSync.cardLedger.view': ['finance'],
  'abcSync.materials.view': ['finance'],
  'abcSync.suppliers.view': ['finance'],
  'abcSync.warehouses.view': ['finance'],
  'abcSync.inventoryLedger.view': ['finance'],
  'abcSync.jobRuns.view': ['finance', 'approver'],
  'abcSync.mappingExceptions.view': ['finance', 'approver'],
  'abcSync.cardMappingExceptions.view': ['finance'],
  'abcSync.inventoryMappingExceptions.view': ['finance'],
  'abcSync.rules.manage': ['admin'],
  'abcSync.normalization.rerun': ['admin'],
  'performance.bindings.view': ['admin', 'finance'],
  'performance.bindings.manage': ['admin'],
  'performance.rules.view': ['finance'],
  'performance.rules.manage': ['admin'],
  'performance.events.view': ['finance'],
  'performance.events.generate': ['admin'],
  'performance.summaries.view': ['finance', 'approver'],
  'performance.summaries.generate': ['admin'],
  'performance.pending.view': ['finance', 'approver'],
  'performance.pending.process': ['finance'],
  'businessStats.tags.view': ['finance'],
  'businessStats.tags.generate': ['admin'],
  'businessStats.tags.manage': ['admin', 'finance'],
  'businessStats.events.view': ['finance'],
  'businessStats.events.generate': ['admin'],
  'businessStats.events.process': ['admin', 'finance'],
  'businessStats.rules.view': ['finance'],
  'businessStats.rules.manage': ['admin'],
  'businessStats.summaries.view': ['finance', 'approver'],
  'businessStats.summaries.generate': ['admin'],
  'businessStats.summaries.confirm': ['admin', 'finance'],
  'businessStats.pending.view': ['finance', 'approver'],
  'payrollTrials.view': ['finance', 'approver'],
  'payrollTrials.generate': ['admin'],
  'payrollTrials.confirm': ['admin', 'finance'],
  'payrollTrials.pending.view': ['finance', 'approver'],
  'engagement.contents.view': ['finance', 'approver'],
  'engagement.contents.manage': ['admin'],
  'engagement.interactions.view': ['finance', 'approver'],
  'engagement.interactions.manage': ['admin'],
  'engagement.memories.view': ['finance', 'approver'],
  'engagement.memories.manage': ['admin'],
  'engagement.links.view': ['finance', 'approver'],
  'engagement.links.manage': ['admin'],
  'engagement.recommendations.view': ['finance', 'approver'],
  'engagement.recommendations.manage': ['admin'],
  'engagement.leads.view': ['finance', 'approver'],
  'engagement.leads.manage': ['admin'],
  'engagement.attributions.view': ['finance', 'approver'],
  'engagement.attributions.manage': ['admin'],
  'engagement.profiles.view': ['finance', 'approver'],
  'engagement.followups.view': ['finance', 'approver'],
  'engagement.importBatches.view': ['finance', 'approver'],
  'engagement.importBatches.manage': ['admin'],
  'engagement.importRecords.view': ['finance', 'approver'],
  'engagement.platformLeads.view': ['finance'],
  'engagement.platformLeads.manage': ['admin'],
  'engagement.connectorConfigs.view': ['finance'],
  'engagement.connectorConfigs.manage': ['admin'],
  'engagement.recommendationRules.view': ['admin', 'finance'],
  'engagement.recommendationRules.manage': ['admin'],
  'engagement.scriptTemplates.view': ['admin', 'finance'],
  'engagement.scriptTemplates.manage': ['admin'],
  'engagement.scriptExperiments.view': ['admin', 'finance', 'approver'],
  'engagement.scriptExperiments.manage': ['admin'],
  'engagement.followupFeedback.view': ['admin', 'finance', 'approver'],
  'engagement.followupFeedback.manage': ['admin'],
  'engagement.executionPlaybooks.view': ['admin', 'finance', 'approver'],
  'engagement.executionPlaybooks.manage': ['admin'],
  'engagement.executionTasks.view': ['admin', 'finance', 'approver', 'operator'],
  'engagement.executionTasks.manage': ['admin'],
  'engagement.executionTasks.operate': ['operator'],
  'engagement.executionResults.view': ['admin', 'finance', 'approver', 'operator'],
  'engagement.executionResults.manage': ['admin', 'operator'],
  'employeeBenefits.issues.view': ['admin', 'finance', 'approver'],
  'employeeBenefits.issues.create': ['admin'],
  'employeeBenefits.issues.confirm': ['admin', 'finance'],
  'employeeBenefits.issues.issue': ['admin', 'finance'],
  'employeeBenefits.accounts.view': ['admin', 'finance', 'approver'],
  'employeeBenefits.notifications.view': ['admin', 'finance'],
  'employeeBenefits.notifications.read': ['admin', 'finance'],
  'employeeBenefits.aiContext.view': ['admin', 'finance', 'approver'],
  'groupOperations.view': [
    'admin',
    'finance',
    'super_admin',
    'owner',
    'founder',
    'business_owner',
    'group_leader',
  ],
  'groupOperations.compensation.view': [
    'admin',
    'finance',
    'super_admin',
    'owner',
    'founder',
    'business_owner',
    'group_leader',
  ],
  'groupOperations.compensation.manage': ['admin', 'super_admin', 'owner', 'founder'],
  'groupOperations.target.view': [
    'admin',
    'finance',
    'super_admin',
    'owner',
    'founder',
    'business_owner',
    'group_leader',
  ],
  'groupOperations.target.manage': ['admin', 'super_admin', 'owner', 'founder'],
  'groupOperations.group.manage': ['admin', 'super_admin', 'owner', 'founder'],
  'groupOperations.hiringPreview': [
    'admin',
    'finance',
    'super_admin',
    'owner',
    'founder',
    'business_owner',
    'group_leader',
  ],
  'report.workOrderMaterialCosts': ['finance'],
  'report.inventoryAlerts': ['finance'],
  'report.unboundOverduePreparations': ['finance', 'approver'],
  'report.supplierMaterialUsage': ['finance'],
};

const formalIdentityRequiredPermissions = new Set<PermissionKey>([
  'workOrderMaterial.create',
  'workOrderMaterial.update',
  'workOrderMaterial.delete',
  'inventory.inbound',
  'inventory.outbound',
  'materialPreparation.create',
  'materialPreparation.bind',
  'groupOperations.compensation.manage',
  'groupOperations.target.manage',
  'groupOperations.group.manage',
]);

function isRoleCode(value: string | null): value is RoleCode {
  return (
    value === 'admin' ||
    value === 'operator' ||
    value === 'finance' ||
    value === 'approver' ||
    value === 'super_admin' ||
    value === 'owner' ||
    value === 'finance_manager' ||
    value === 'finance_operator' ||
    value === 'auditor' ||
    value === 'founder' ||
    value === 'business_owner' ||
    value === 'group_leader'
  );
}

function loadInitialRoleCode(): RoleCode {
  if (typeof window === 'undefined') {
    return 'admin';
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isRoleCode(stored) ? stored : 'admin';
}

export const currentRoleCode = ref<RoleCode>(loadInitialRoleCode());
export const currentRoleProfile = computed(() => roleProfiles[currentRoleCode.value]);
export const authenticatedUserIdentity = ref<AuthenticatedUserIdentity | null>(null);
export const formalActorIdentityBound = computed(
  () => authenticatedUserIdentity.value?.formalIdentityBound === true,
);

export function setAuthenticatedUserIdentity(identity: AuthenticatedUserIdentity | null) {
  authenticatedUserIdentity.value = identity;
  if (!identity?.formalIdentityBound) {
    return;
  }

  const supportedRole = roleOptions.find((role) => identity.roleCodes.includes(role.code))?.code;
  if (supportedRole) {
    currentRoleCode.value = supportedRole;
  }
}

export function setCurrentRole(code: RoleCode) {
  if (formalActorIdentityBound.value) {
    return;
  }
  currentRoleCode.value = code;

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, code);
  }
}

export function hasAnyRole(allowedRoles?: readonly RoleCode[], roleCode = currentRoleCode.value) {
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  if (formalActorIdentityBound.value && authenticatedUserIdentity.value) {
    const actualRoles = authenticatedUserIdentity.value.roleCodes.filter(
      (role): role is RoleCode => isRoleCode(role),
    );
    return actualRoles.includes('admin') || actualRoles.some((role) => allowedRoles.includes(role));
  }

  if (roleCode === 'admin') {
    return true;
  }

  return allowedRoles.includes(roleCode);
}

export function hasPermission(permission: PermissionKey, roleCode = currentRoleCode.value) {
  if (
    formalIdentityRequiredPermissions.has(permission) &&
    !formalActorIdentityBound.value
  ) {
    return false;
  }
  return hasAnyRole(permissionMatrix[permission], roleCode);
}

export function getCurrentUserId() {
  return formalActorIdentityBound.value && authenticatedUserIdentity.value
    ? authenticatedUserIdentity.value.id
    : roleProfiles[currentRoleCode.value].userId;
}

export function resolveHomePath(roleCode = currentRoleCode.value) {
  return roleProfiles[roleCode].homePath;
}
