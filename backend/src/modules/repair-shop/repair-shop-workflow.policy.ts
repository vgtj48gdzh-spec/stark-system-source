import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  RepairDocumentType,
  RepairLifecycleStatus,
  RepairPermission,
} from './entities/repair-shop.entities';

const lifecycleOrder: RepairLifecycleStatus[] = [
  'intake_draft',
  'intake_checked',
  'diagnosed',
  'quote_pending_customer',
  'authorized',
  'repair_scheduled',
  'repairing',
  'qc_pending',
  'rework_required',
  'ready_for_delivery',
  'delivered',
  'after_sales',
  'closed',
];

const protectedTerminalStates = new Set<RepairLifecycleStatus>(['closed', 'cancelled']);

export function assertExpectedVersion(actual: number, expected: number, resource: string) {
  if (actual !== expected) {
    throw new ConflictException(
      `[version_conflict] ${resource} 已更新，当前版本 ${actual}，请求版本 ${expected}`,
    );
  }
}

export function documentPermission(documentType: RepairDocumentType): RepairPermission {
  switch (documentType) {
    case 'intake_inspection':
      return 'intake.manage';
    case 'diagnosis':
    case 'repair_plan':
      return 'diagnosis.manage';
    case 'quote':
    case 'customer_explanation':
      return 'quote.manage';
  }
}

export function statusAfterDocument(
  current: RepairLifecycleStatus,
  documentType: RepairDocumentType,
): RepairLifecycleStatus {
  if (protectedTerminalStates.has(current) || current === 'suspended') {
    throw new BadRequestException(`[repair_lifecycle_locked] ${current} 状态不可新增业务版本`);
  }

  if (documentType === 'intake_inspection') {
    return 'intake_checked';
  }
  if (documentType === 'diagnosis') {
    assertAtLeast(current, 'intake_checked', '必须先完成接车检查');
    return 'diagnosed';
  }
  if (documentType === 'repair_plan') {
    assertAtLeast(current, 'diagnosed', '必须先形成诊断版本');
    return 'diagnosed';
  }
  if (documentType === 'quote') {
    assertAtLeast(current, 'diagnosed', '必须先形成诊断和维修方案');
    return 'quote_pending_customer';
  }

  assertAtLeast(current, 'diagnosed', '必须先形成诊断和维修方案');
  return 'quote_pending_customer';
}

export function assertCanRequestConfirmation(status: RepairLifecycleStatus) {
  if (status !== 'quote_pending_customer' && status !== 'diagnosed') {
    throw new BadRequestException(
      `[confirmation_not_allowed] 当前状态 ${status} 不能请求客户确认`,
    );
  }
}

export function statusAfterCustomerDecision(decision: 'confirmed' | 'rejected') {
  return decision === 'confirmed' ? ('authorized' as const) : ('diagnosed' as const);
}

export function assertTaskStatusTransition(
  current: string,
  target: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled',
) {
  const allowed: Record<string, string[]> = {
    pending: ['in_progress', 'blocked', 'cancelled'],
    in_progress: ['blocked', 'completed'],
    blocked: ['in_progress', 'cancelled'],
    completed: [],
    cancelled: [],
  };
  if (!allowed[current]?.includes(target)) {
    throw new BadRequestException(`[task_transition_denied] ${current} -> ${target} 不允许`);
  }
}

export function assertCanCreateTask(status: RepairLifecycleStatus) {
  if (!['authorized', 'repair_scheduled', 'repairing', 'rework_required'].includes(status)) {
    throw new BadRequestException(`[repair_task_not_allowed] 当前状态 ${status} 不能创建维修任务`);
  }
}

export function statusAfterTaskActivity(
  targetTaskStatus: string,
  allWorkCompleted: boolean,
): RepairLifecycleStatus {
  if (allWorkCompleted) {
    return 'qc_pending';
  }
  return ['pending', 'cancelled'].includes(targetTaskStatus) ? 'repair_scheduled' : 'repairing';
}

export function assertCanInspectQuality(status: RepairLifecycleStatus) {
  if (status !== 'qc_pending') {
    throw new BadRequestException(`[quality_not_allowed] 当前状态 ${status} 不能提交质检`);
  }
}

export function assertCanDeliver(status: RepairLifecycleStatus) {
  if (status !== 'ready_for_delivery') {
    throw new BadRequestException(`[delivery_not_allowed] 当前状态 ${status} 不能交车`);
  }
}

export function assertManualTransition(
  current: RepairLifecycleStatus,
  target: 'suspended' | 'cancelled' | 'closed' | 'resume',
) {
  if (target === 'resume') {
    if (current !== 'suspended') {
      throw new BadRequestException('[resume_not_allowed] 只有已暂停工单可以恢复');
    }
    return;
  }
  if (current === target) {
    throw new BadRequestException(`[repair_lifecycle_unchanged] 工单已经处于 ${target} 状态`);
  }
  if (target === 'closed' && !['delivered', 'after_sales'].includes(current)) {
    throw new BadRequestException('[close_not_allowed] 只有已交车或售后状态可以关闭');
  }
  if (protectedTerminalStates.has(current)) {
    throw new BadRequestException(`[repair_lifecycle_locked] ${current} 状态不可再次变更`);
  }
  if (
    ['delivered', 'after_sales'].includes(current) &&
    (target === 'cancelled' || target === 'suspended')
  ) {
    throw new BadRequestException(`[repair_lifecycle_locked] ${current} 状态不可取消或暂停`);
  }
}

export function maskVin(vin: string | null | undefined) {
  const value = vin?.trim() ?? '';
  if (!value) {
    return null;
  }
  if (value.length <= 8) {
    return `${value.slice(0, 2)}***${value.slice(-2)}`;
  }
  return `${value.slice(0, 4)}*********${value.slice(-4)}`;
}

export function maskCustomerRef(customerRef: string) {
  const value = customerRef.trim();
  if (value.length <= 4) {
    return `${value.slice(0, 1)}***`;
  }
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

export function knowledgeAuthorityRank(
  referenceType: 'regulation' | 'manufacturer_manual' | 'service_bulletin' | 'case' | 'video',
) {
  switch (referenceType) {
    case 'regulation':
      return 5;
    case 'manufacturer_manual':
    case 'service_bulletin':
      return 4;
    case 'case':
      return 3;
    case 'video':
      return 1;
  }
}

function assertAtLeast(
  current: RepairLifecycleStatus,
  minimum: RepairLifecycleStatus,
  message: string,
) {
  if (current === 'suspended') {
    throw new BadRequestException(`[repair_lifecycle_suspended] ${message}`);
  }
  if (lifecycleOrder.indexOf(current) < lifecycleOrder.indexOf(minimum)) {
    throw new BadRequestException(`[repair_sequence_invalid] ${message}`);
  }
}
