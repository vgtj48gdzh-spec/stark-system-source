import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';
import { CustomerIdentificationBinding } from '../performance/entities/customer-identification-binding.entity';
import { SaveIntakeAssociationDto } from './dto/save-intake-association.dto';
import { WorkOrder } from './entities/work-order.entity';
import { safeIntakeText } from './work-order-intake.policy';

export const INTAKE_ASSOCIATION_SOURCE = 'stark_owner_intake';
export const INTAKE_ASSOCIATION_TABLE = 'work_orders';
export const INTAKE_ASSOCIATION_CONTRACT = 'owner_intake_association_draft_v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
export interface IntakeAssociationSnapshot {
  contract: typeof INTAKE_ASSOCIATION_CONTRACT;
  actorId: number;
  revision: number;
  intakeRevision: number;
  requestId: string;
  requestHash: string;
  sourceHash: string;
  relationshipType: 'owner' | 'user' | 'contact';
}
export const intakeAssociationHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function intakeAssociationSourceHash(root: WorkOrder) {
  // All private source values stay in memory. No client-provided source or hash.
  return intakeAssociationHash([root.id, root.createdBy, root.responsibleUserId,
    root.customerName, root.customerMobile, root.remark, root.status]);
}
export function normalizeIntakeAssociation(dto: SaveIntakeAssociationDto) {
  const key = typeof dto.requestId === 'string' ? dto.requestId.toLowerCase() : '';
  if (!UUID.test(key) || !Number.isInteger(dto.expectedIntakeRevision) || dto.expectedIntakeRevision < 1
    || dto.expectedIntakeRevision > 2147483647 || !Number.isInteger(dto.expectedDraftRevision)
    || dto.expectedDraftRevision < 0 || dto.expectedDraftRevision > 2147483646
    || typeof dto.customerName !== 'string' || dto.customerName.length > 100
    || !['owner', 'user', 'contact'].includes(dto.relationshipType) || dto.pendingDeclarationAcknowledged !== true) {
    throw new BadRequestException('[intake_association_invalid] 请核对姓名、关系、资料版本和待核实声明');
  }
  return { requestId: key, customerName: safeIntakeText(dto.customerName), relationshipType: dto.relationshipType };
}
export function intakeAssociationSnapshot(binding: CustomerIdentificationBinding): IntakeAssociationSnapshot {
  const p = binding.normalizedPayload as unknown as IntakeAssociationSnapshot;
  if (binding.sourceSystem !== INTAKE_ASSOCIATION_SOURCE || binding.sourceTable !== INTAKE_ASSOCIATION_TABLE
    || binding.bindingStatus !== 'manual_pending' || binding.boundBy !== null || binding.boundAt !== null
    || binding.matchedCustomerId !== null || binding.matchedCustomerName !== null || binding.matchedCustomerMobile !== null
    || binding.performanceReadyFlag !== false || binding.performanceBlockReason !== 'native_intake_unverified'
    || [binding.bindingConfidence, binding.performanceDecisionReason, binding.taskExecutionCount, binding.taskOnTimeCount,
      binding.taskConfirmedCount, binding.taskRewardEligibleFlag, binding.aiTaskScore, binding.aiTaskRemark].some(v => v !== null)
    || !/^[1-9]\d*$/.test(binding.sourceId) || !Number.isSafeInteger(Number(binding.sourceId))
    || typeof binding.sourceCustomerName !== 'string' || !binding.sourceCustomerName.trim() || binding.sourceCustomerName.length > 100
    || typeof binding.sourceCustomerMobile !== 'string' || !/^1[3-9]\d{9}$/.test(binding.sourceCustomerMobile)
    || typeof binding.sourceCarPlate !== 'string' || !binding.sourceCarPlate
    || !p || typeof p !== 'object' || Array.isArray(p)
    || Object.keys(p).sort().join(',') !== 'actorId,contract,intakeRevision,relationshipType,requestHash,requestId,revision,sourceHash'
    || p.contract !== INTAKE_ASSOCIATION_CONTRACT || ![p.actorId, p.revision, p.intakeRevision].every(n => Number.isSafeInteger(n) && n > 0 && n <= 2147483647)
    || !UUID.test(p.requestId) || !HASH.test(p.requestHash) || !HASH.test(p.sourceHash)
    || !['owner', 'user', 'contact'].includes(p.relationshipType)
    || p.requestHash !== intakeAssociationHash([Number(binding.sourceId), p.actorId, p.intakeRevision, p.revision - 1,
      p.sourceHash, binding.sourceCustomerName, binding.sourceCustomerMobile, binding.sourceCarPlate, p.relationshipType, p.requestId])) {
    throw new ConflictException('[intake_association_frozen] 关联资料状态已变化，不能覆盖或当作已核实资料');
  }
  return p;
}
