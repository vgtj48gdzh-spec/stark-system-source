import { BadRequestException, ConflictException } from '@nestjs/common';
import { CustomerIdentificationBinding } from '../performance/entities/customer-identification-binding.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { intakeAssociationSnapshot, intakeAssociationSourceHash } from '../work-orders/work-order-intake-association.policy';
import { decodeIntakeMetadata } from '../work-orders/work-order-intake.policy';
import { prequoteHash } from './repair-prequote.policy';
import { ReviewRepairFirstVisitDto } from './dto/repair-first-visit.dto';

export const NATIVE_REVIEW_SOURCE = 'stark_native_intake_review';
export const NATIVE_CUSTOMER_SOURCE = 'stark_native_customer';
export const NATIVE_REVIEW_CONTRACT = 'repair_native_first_visit_review_v1';
export const NATIVE_CUSTOMER_CONTRACT = 'repair_native_customer_identity_v1';
export const nativeReviewWhere = (id: number) => ({ sourceSystem: NATIVE_REVIEW_SOURCE, sourceTable: 'work_orders', sourceId: String(id) });
export const nativePhone = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '').replace(/^86(?=1\d{10}$)/, '');
const positiveId = (n: unknown) => Number.isSafeInteger(n) && Number(n) > 0 && Number(n) <= 2147483647;
const nativeOnly = (row: CustomerIdentificationBinding) => row.performanceReadyFlag === false
  && row.performanceBlockReason === 'native_identity_only_not_payroll'
  && ['matchedCustomerName','matchedCustomerMobile','bindingConfidence','performanceDecisionReason',
    'taskExecutionCount','taskOnTimeCount','taskConfirmedCount','taskRewardEligibleFlag','aiTaskScore','aiTaskRemark']
    .every(key => (row as any)[key] === null);
export function assertNativeIdentity(row: CustomerIdentificationBinding | null, customer: any, companyRef: string, phone: string) {
  const p = row?.normalizedPayload;
  const keys = ['contract','companyRef','customerRef','collectorId','reviewerId','evidenceRef'];
  if (!row || !p || Object.keys(p).sort().join() !== keys.sort().join()
    || p.contract !== NATIVE_CUSTOMER_CONTRACT || p.companyRef !== companyRef
    || !customer || customer.status !== 'active' || customer.legacyIdentificationBindingId !== null
    || p.customerRef !== customer.customerRef || row.matchedCustomerId !== customer.customerRef
    || row.sourceSystem !== NATIVE_CUSTOMER_SOURCE || row.sourceTable !== 'customer_master_records'
    || row.sourceId !== prequoteHash(phone) || nativePhone(row.sourceCustomerMobile) !== phone
    || row.sourceCustomerName !== customer.displayName || row.bindingStatus !== 'native_identity_verified'
    || !positiveId(p.collectorId) || !positiveId(p.reviewerId) || p.collectorId === p.reviewerId
    || row.boundBy !== p.reviewerId || customer.createdBy !== p.collectorId || customer.reviewedBy !== p.reviewerId
    || !row.boundAt || !Number.isFinite(new Date(row.boundAt).getTime()) || !nativeOnly(row)) {
    throw new ConflictException('[first_visit_customer_conflict] 原生客户证据不可用，不会自动新建或回退历史来源');
  }
  internalReviewEvidence(p.evidenceRef);
}
export function internalReviewEvidence(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{2,254}$/.test(value)
    || /\/\/|\.\.|1\d{10}|[A-HJ-NPR-Z0-9]{17}|Bearer|PRIVATE.KEY/i.test(value)) {
    throw new BadRequestException('[first_visit_evidence_invalid] 只允许内部不透明证据引用，不得填写证件或联系方式');
  }
  return value;
}
export function normalizeFirstVisitRequest(dto: ReviewRepairFirstVisitDto) {
  const keys = ['businessSectorRef','requestId','expectedIntakeRevision','expectedDeclarationRevision',
    'expectedReviewHash','evidenceRef','identityAndRelationshipChecked','vehicleAndDetailsChecked'];
  if (!dto || Object.keys(dto).sort().join() !== keys.sort().join()
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(dto.requestId ?? '')
    || ![dto.expectedIntakeRevision, dto.expectedDeclarationRevision].every(n => Number.isSafeInteger(n) && n > 0 && n <= 2147483647)
    || !/^[a-f0-9]{64}$/.test(dto.expectedReviewHash ?? '')
    || dto.identityAndRelationshipChecked !== true || dto.vehicleAndDetailsChecked !== true) {
    throw new BadRequestException('[first_visit_request_invalid] 请回读当前版本并明确核对资料');
  }
  return { ...dto, requestId: dto.requestId.toLowerCase(), evidenceRef: internalReviewEvidence(dto.evidenceRef) };
}
export interface NativeReview {
  contract: typeof NATIVE_REVIEW_CONTRACT;
  workOrderId: number; collectorId: number; reviewerId: number; reviewerEmployeeId: number;
  requestId: string; requestHash: string; reviewHash: string; authorityHash: string; sourceHash: string;
  declarationId: number; declarationRevision: number; intakeRevision: number;
  companyRef: string; businessSectorRef: string; storeRef: string; customerRef: string;
  identityBindingId: number; vehicleId: number; linkId: number; evidenceRef: string;
  factsHash: string;
}
export function nativeReviewSnapshot(row: CustomerIdentificationBinding): NativeReview {
  const p = row?.normalizedPayload as unknown as NativeReview;
  const keys = ['contract','workOrderId','collectorId','reviewerId','reviewerEmployeeId','requestId','requestHash','reviewHash','authorityHash',
    'sourceHash','declarationId','declarationRevision','intakeRevision','companyRef','businessSectorRef','storeRef',
    'customerRef','identityBindingId','vehicleId','linkId','evidenceRef','factsHash'];
  if (!p || Object.keys(p).sort().join() !== keys.sort().join() || p.contract !== NATIVE_REVIEW_CONTRACT
    || row.sourceSystem !== NATIVE_REVIEW_SOURCE || row.sourceTable !== 'work_orders' || row.sourceId !== String(p.workOrderId)
    || row.bindingStatus !== 'native_reviewed' || row.boundBy !== p.reviewerId || !row.boundAt
    || !Number.isFinite(new Date(row.boundAt).getTime()) || p.reviewerId === p.collectorId
    || !nativeOnly(row)
    || row.matchedCustomerId !== p.customerRef
    || ![p.workOrderId,p.collectorId,p.reviewerId,p.reviewerEmployeeId,p.declarationId,p.declarationRevision,
      p.intakeRevision,p.identityBindingId,p.vehicleId,p.linkId].every(n => Number.isSafeInteger(n) && n > 0 && n <= 2147483647)
    || ![p.sourceHash,p.requestHash,p.reviewHash,p.authorityHash,p.factsHash].every(h => /^[a-f0-9]{64}$/.test(h))
    || ![p.companyRef,p.businessSectorRef,p.storeRef,p.customerRef].every(s => typeof s === 'string' && s.length > 0 && s.length <= 100)
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(p.requestId)) {
    throw new ConflictException('[first_visit_review_invalid] 原单核实证据不可用，不能回退为历史客户');
  }
  internalReviewEvidence(p.evidenceRef);
  if (p.requestHash !== prequoteHash({ workOrderId: p.workOrderId, actorId: p.reviewerId,
    businessSectorRef: p.businessSectorRef, requestId: p.requestId,
    expectedIntakeRevision: p.intakeRevision, expectedDeclarationRevision: p.declarationRevision,
    expectedReviewHash: p.reviewHash, evidenceRef: p.evidenceRef,
    identityAndRelationshipChecked: true, vehicleAndDetailsChecked: true })) {
    throw new ConflictException('[first_visit_review_invalid] 核实请求与留存证据不一致');
  }
  return p;
}
export function assertNativeSource(row: CustomerIdentificationBinding, root: WorkOrder, declaration: CustomerIdentificationBinding | null) {
  const p = nativeReviewSnapshot(row);
  const d = declaration && intakeAssociationSnapshot(declaration);
  const m = decodeIntakeMetadata(root.remark);
  if (!d || !m?.d || p.workOrderId !== root.id || p.collectorId !== root.createdBy || d.actorId !== root.createdBy
    || p.sourceHash !== intakeAssociationSourceHash(root) || d.sourceHash !== p.sourceHash
    || p.declarationId !== declaration!.id || p.declarationRevision !== d.revision
    || p.intakeRevision !== m.d.r || d.intakeRevision !== m.d.r || p.companyRef !== m.c || p.storeRef !== m.s
    || nativePhone(row.sourceCustomerMobile) !== nativePhone(root.customerMobile)
    || row.sourceCustomerName !== declaration!.sourceCustomerName || row.sourceCarPlate !== m.p) {
    throw new ConflictException('[first_visit_source_changed] 原单资料或关系声明已变化，旧核实不可沿用');
  }
  return p;
}
/** Current live master facts, never raw PII in response or audit. */
export const nativeFactsHash = (identity: any, customer: any, vehicle: any, link: any) =>
  prequoteHash({
    identity: identity && [identity.id,identity.sourceSystem,identity.sourceTable,identity.sourceId,identity.bindingStatus,
      identity.boundBy,identity.boundAt,identity.sourceCustomerMobile,identity.sourceCustomerName,
      identity.matchedCustomerId,identity.performanceReadyFlag,identity.performanceBlockReason,identity.normalizedPayload],
    customer: customer && [customer.id,customer.customerRef,customer.status,customer.version,
      customer.displayName,customer.mobileMasked,customer.legacyIdentificationBindingId,customer.createdBy,customer.reviewedBy],
    vehicle: vehicle && [vehicle.id,vehicle.companyRef,vehicle.businessSectorRef,vehicle.vin,vehicle.plateNumber,
      vehicle.status,vehicle.version,vehicle.createdBy],
    link: link && [link.id,link.vehicleId,link.companyRef,link.businessSectorRef,link.storeRef,link.customerRef,
      link.relationshipType,link.status,link.confirmationStatus,link.validFrom,link.validUntil,link.reviewedBy,link.relationshipSource],
  });
