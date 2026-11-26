import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { Material } from '../materials/entities/material.entity';
import { MaterialStatus } from '../../shared/enums/material-status.enum';
import { CustomerIdentificationBinding } from '../performance/entities/customer-identification-binding.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { decodeIntakeMetadata } from '../work-orders/work-order-intake.policy';
import { INTAKE_ASSOCIATION_SOURCE, INTAKE_ASSOCIATION_TABLE, intakeAssociationSnapshot,
  intakeAssociationSourceHash, intakeAssociationHash } from '../work-orders/work-order-intake-association.policy';
import { proposalAmounts, proposalSnapshot } from '../work-orders/work-order-intake-proposal.policy';
import { OWNER_INTAKE_PROPOSAL_TYPE, RepairDocumentVersion, RepairWorkOrderProfile } from './entities/repair-shop.entities';
import { prequoteAdmission, prequoteHash } from './repair-prequote.policy';

export const PROPOSAL_DOCUMENT_SOURCE = 'repair_owner_proposal_document_v1';
export interface OwnerProposalDocumentInput {
  requestId: string;
  proposalVersion: number;
  proposalHash: string;
  materialBindings: Array<{ row: number; materialId: number }>;
}
const invalid = () => new BadRequestException('[proposal_document_input] 请回读草稿版本并逐行选择已有材料，不得传入成本或付款结论');
const stale = () => new ConflictException('[proposal_document_stale] 草稿、材料或前序版本已变化，请回读原单');
const exact = (v: any, keys: string[]) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join(',') === keys.sort().join(',');
export function normalizeProposalDocumentInput(value: OwnerProposalDocumentInput): OwnerProposalDocumentInput {
  if (!exact(value, ['requestId', 'proposalVersion', 'proposalHash', 'materialBindings'])
    || typeof value.requestId !== 'string'
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value.requestId)
    || !Number.isSafeInteger(value.proposalVersion) || value.proposalVersion < 1
    || typeof value.proposalHash !== 'string' || !/^[a-f0-9]{64}$/.test(value.proposalHash)
    || !Array.isArray(value.materialBindings) || value.materialBindings.length > 20) throw invalid();
  const materialBindings = value.materialBindings.map(b => {
    if (!exact(b, ['row', 'materialId']) || !Number.isSafeInteger(b.row) || b.row < 0 || b.row >= 20
      || !Number.isSafeInteger(b.materialId) || b.materialId < 1 || b.materialId > 2147483647) throw invalid();
    return { row: b.row, materialId: b.materialId };
  }).sort((a, b) => a.row - b.row);
  if (new Set(materialBindings.map(b => b.row)).size !== materialBindings.length) throw invalid();
  return { ...value, materialBindings };
}

/** Caller must hold current RBAC, original root and admitted-profile locks in the same RR transaction. */
export async function loadProposalDocumentSource(manager: EntityManager, profile: RepairWorkOrderProfile) {
  if (!manager.queryRunner?.isTransactionActive || !prequoteAdmission(profile)) {
    throw new ForbiddenException('[proposal_document_admission_required] 先完成原单客户车辆独立核实与报价前接入');
  }
  const root = await manager.getRepository(WorkOrder).findOne({
    where: { id: profile.workOrderId }, lock: { mode: 'pessimistic_read' },
  });
  const meta = decodeIntakeMetadata(root?.remark);
  const binding = await manager.getRepository(CustomerIdentificationBinding).findOne({
    where: { sourceSystem: INTAKE_ASSOCIATION_SOURCE, sourceTable: INTAKE_ASSOCIATION_TABLE, sourceId: String(profile.workOrderId) },
    lock: { mode: 'pessimistic_read' },
  });
  const association = binding ? intakeAssociationSnapshot(binding) : null;
  const document = await manager.getRepository(RepairDocumentVersion).findOne({
    where: { workOrderId: profile.workOrderId, documentType: OWNER_INTAKE_PROPOSAL_TYPE },
    order: { version: 'DESC' }, lock: { mode: 'pessimistic_read' },
  });
  if (!root || !meta?.d || !association || !document) throw stale();
  const snapshot = proposalSnapshot(document), rootHash = intakeAssociationSourceHash(root);
  if (document.status !== 'draft' || document.createdBy !== root.createdBy || association.actorId !== root.createdBy
    || association.sourceHash !== rootHash || snapshot.sourceHash !== intakeAssociationHash([rootHash, association.requestHash])
    || snapshot.input.expectedIntakeRevision !== meta.d.r
    || snapshot.input.expectedAssociationRevision !== association.revision) throw stale();
  return { document, snapshot };
}

export function proposalDocumentEnvelope(document: RepairDocumentVersion) {
  const refs = document.sourceReferences;
  const tagged = Array.isArray(refs) && refs.some(r => r?.contract === PROPOSAL_DOCUMENT_SOURCE);
  if (!tagged) return null;
  if (refs!.length !== 1) throw stale();
  const e = refs![0] as any;
  if (!exact(e, ['contract', 'input', 'actorId', 'profileVersion', 'scopeHash', 'sourceCreatorId', 'dependencyId',
    'dependencyVersion', 'dependencyHash', 'payloadHash', 'requestHash'])
    || !['repair_plan', 'quote'].includes(document.documentType)
    || document.generatedBy !== 'human' || e.actorId !== document.createdBy
    || !Number.isSafeInteger(e.profileVersion) || e.profileVersion < 1
    || !Number.isSafeInteger(e.sourceCreatorId) || e.sourceCreatorId < 1
    || !Number.isSafeInteger(e.dependencyId) || e.dependencyId < 1
    || !Number.isSafeInteger(e.dependencyVersion) || e.dependencyVersion < 1
    || ![e.scopeHash, e.dependencyHash, e.payloadHash, e.requestHash].every(h => typeof h === 'string' && /^[a-f0-9]{64}$/.test(h))) throw stale();
  const input = normalizeProposalDocumentInput(e.input);
  if (prequoteHash(input) !== prequoteHash(e.input) || e.payloadHash !== prequoteHash(document.payload)
    || e.requestHash !== proposalDocumentRequestHash(document.workOrderId, document.documentType, e.actorId, e.profileVersion, input)) throw stale();
  return { ...e, input } as { contract: string; input: OwnerProposalDocumentInput; actorId: number;
    profileVersion: number; sourceCreatorId: number; scopeHash: string; dependencyId: number;
    dependencyVersion: number; dependencyHash: string; payloadHash: string; requestHash: string };
}
export const proposalDocumentRequestHash = (id: number, type: string, actorId: number, version: number, input: OwnerProposalDocumentInput) =>
  prequoteHash({ id, type, actorId, version, input });
const scopeHash = (p: RepairWorkOrderProfile) => prequoteHash({ workOrderId: p.workOrderId, companyRef: p.companyRef,
  businessSectorRef: p.businessSectorRef, storeRef: p.storeRef, customerRef: p.customerRef, vehicleId: p.vehicleId,
  admission: prequoteAdmission(p) });

export async function buildProposalDocument(manager: EntityManager, profile: RepairWorkOrderProfile,
  source: Awaited<ReturnType<typeof loadProposalDocumentSource>>, type: string,
  raw: OwnerProposalDocumentInput, actorId: number, expectedProfileVersion: number) {
  const input = normalizeProposalDocumentInput(raw), { document, snapshot } = source;
  if (!['repair_plan', 'quote'].includes(type) || document.version !== input.proposalVersion
    || snapshot.requestHash !== input.proposalHash) throw stale();
  const data = snapshot.input, amounts = proposalAmounts(data);
  const partRows = data.rows.flatMap((r, row) => r.category === 'part' ? [row] : []);
  if (prequoteHash(partRows) !== prequoteHash(input.materialBindings.map(b => b.row))) throw invalid();
  const materials = new Map<number, { materialId: number; materialNo: string; name: string; specification: string | null; unit: string }>();
  // Global material master is a catalog only, not a stock, supplier or cost authority.
  for (const id of [...new Set(input.materialBindings.map(b => b.materialId))].sort((a,b) => a-b)) {
    const m = await manager.getRepository(Material).findOne({ where: { id, status: MaterialStatus.ACTIVE }, lock: { mode: 'pessimistic_read' } });
    if (!m) throw stale();
    materials.set(id, { materialId: m.id, materialNo: m.materialNo, name: m.name, specification: m.specification, unit: m.unit });
  }
  for (const b of input.materialBindings) if (materials.get(b.materialId)!.unit !== data.rows[b.row].unit || !data.rows[b.row].quantity) throw invalid();
  const repo = manager.getRepository(RepairDocumentVersion);
  const dependency = await repo.findOne({ where: { workOrderId: profile.workOrderId,
    documentType: type === 'repair_plan' ? 'diagnosis' : 'repair_plan', status: In(['approved', 'authorized']),
    ...(type === 'quote' ? { version: profile.activePlanVersion ?? -1 } : {}) },
    order: { version: 'DESC' }, lock: { mode: 'pessimistic_read' } });
  if (!dependency) throw new ConflictException('[proposal_document_dependency] 请先独立审核诊断，再接入方案；方案独立审核后才能接入报价');
  if (type === 'quote') {
    await assertProposalDocumentReview(manager, profile, dependency);
    const planSource = proposalDocumentEnvelope(dependency);
    if (!planSource || planSource.input.proposalHash !== input.proposalHash
      || prequoteHash(planSource.input.materialBindings) !== prequoteHash(input.materialBindings)
      || planSource.scopeHash !== scopeHash(profile)) throw stale();
    if (amounts.quoteTotal === null) throw new BadRequestException('[proposal_document_incomplete_price] 待核实草稿缺少数量、单位或对客单价，不能按零生成报价');
  }
  const rowRef = (i: number) => 'owner-proposal-' + document.version + '-row-' + (i + 1);
  const material = (i: number) => { const b = input.materialBindings.find(b => b.row === i); return b ? materials.get(b.materialId)! : null; };
  const totals = { labor: 0n, part: 0n, other: 0n };
  data.rows.forEach((r,i) => { if (amounts.amounts[i] !== null) totals[r.category] += BigInt(amounts.amounts[i]!.replace('.', '')); });
  const money = (n: bigint) => n / 100n + '.' + String(n % 100n).padStart(2, '0');
  const payload: Record<string, unknown> = type === 'repair_plan' ? {
    diagnosisVersion: dependency.version, description: data.plan,
    items: data.rows.map((r,i) => ({ itemRef: rowRef(i), action: r.name, expectedLaborHours: null,
      materialNeeds: r.category === 'part' ? [{ ...material(i), quantity: r.quantity, sourceRowRef: rowRef(i) }] : [] })),
    risks: [], alternatives: [], ownerNotes: data.notes,
  } : { planVersion: dependency.version,
    lineItems: data.rows.map((r,i) => ({ lineRef: rowRef(i), planItemRef: rowRef(i), category: r.category,
      name: r.name, quantity: r.quantity, unit: r.unit, customerUnitPrice: r.unitPrice, amount: amounts.amounts[i],
      ...(r.category === 'part' ? { materialId: material(i)!.materialId, materialSnapshot: material(i) } : {}) })),
    laborTotal: money(totals.labor), partsTotal: money(totals.part), otherTotal: money(totals.other),
    total: amounts.quoteTotal, currency: 'CNY' };
  const envelope = { contract: PROPOSAL_DOCUMENT_SOURCE, input, actorId, profileVersion: expectedProfileVersion,
    scopeHash: scopeHash(profile), sourceCreatorId: document.createdBy, dependencyId: dependency.id,
    dependencyVersion: dependency.version, dependencyHash: prequoteHash(dependency.payload), payloadHash: prequoteHash(payload),
    requestHash: proposalDocumentRequestHash(profile.workOrderId, type, actorId, expectedProfileVersion, input) };
  return { payload, envelope, summary: '原单待核实方案材料 v' + document.version + (type === 'repair_plan' ? ' → 维修方案（待复核）' : ' → 对客报价（待复核）') };
}

export async function assertProposalDocumentReview(manager: EntityManager, profile: RepairWorkOrderProfile,
  document: RepairDocumentVersion, reviewerId?: number) {
  const e = proposalDocumentEnvelope(document);
  if (!e) return;
  if (reviewerId === e.actorId || reviewerId === e.sourceCreatorId) {
    throw new ForbiddenException('[proposal_document_independent_review] 草稿提交人及版本录入人不能审核自己的资料');
  }
  const source = await loadProposalDocumentSource(manager, profile);
  const rebuilt = await buildProposalDocument(manager, profile, source, document.documentType, e.input, e.actorId, e.profileVersion);
  if (prequoteHash(rebuilt.envelope) !== prequoteHash(e) || document.summary !== rebuilt.summary) throw stale();
}
