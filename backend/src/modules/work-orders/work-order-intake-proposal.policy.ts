import { BadRequestException, ConflictException } from '@nestjs/common';
import { RepairDocumentVersion, OWNER_INTAKE_PROPOSAL_TYPE } from '../repair-shop/entities/repair-shop.entities';
import { SaveIntakeProposalDto } from './dto/save-intake-proposal.dto';
import { intakeAssociationHash } from './work-order-intake-association.policy';

export const INTAKE_PROPOSAL_CONTRACT = 'owner_intake_proposal_draft_v1';
export const proposalSummary = (requestId: string) => INTAKE_PROPOSAL_CONTRACT + ':' + requestId;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
const invalid = () => new BadRequestException('[intake_proposal_invalid] 请核对方案、项目、版本和待核实声明；不要填写电话、证件或秘密');
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k])).join(',') + '}';
  return JSON.stringify(value);
}
function exact(value: unknown, keys: string[]) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}
function safeText(value: unknown, max: number, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())
    || /[\u0000-\u0008\u000b-\u001f\u007f]|1[3-9]\d{9}|\b[A-HJ-NPR-Z0-9]{17}\b|\d{16,}|(?:password|secret|token)\s*[:=]|PRIVATE KEY/i.test(value)) throw invalid();
  return value.trim();
}
function decimal(value: unknown, positive: boolean) {
  if (typeof value !== 'string') throw invalid();
  const s = value.trim();
  if (s === '') return '';
  if (!/^(0|[1-9]\d{0,5})(\.\d{1,2})?$/.test(s)) throw invalid();
  const [w, f = ''] = s.split('.');
  const n = BigInt(w) * 100n + BigInt(f.padEnd(2, '0'));
  if (positive && n === 0n) throw invalid();
  return (n / 100n) + '.' + String(n % 100n).padStart(2, '0');
}
const cents = (s: string) => BigInt(s.replace('.', ''));
const money = (n: bigint) => (n / 100n) + '.' + String(n % 100n).padStart(2, '0');
export function normalizeIntakeProposal(dto: SaveIntakeProposalDto) {
  if (!exact(dto, ['requestId', 'expectedIntakeRevision', 'expectedAssociationRevision', 'expectedDraftRevision', 'plan', 'notes', 'rows', 'pendingDeclarationAcknowledged'])
    || typeof dto.requestId !== 'string' || !UUID.test(dto.requestId.toLowerCase())
    || ![dto.expectedIntakeRevision, dto.expectedAssociationRevision].every(n => Number.isInteger(n) && n > 0 && n <= 2147483647)
    || !Number.isInteger(dto.expectedDraftRevision) || dto.expectedDraftRevision < 0 || dto.expectedDraftRevision > 2147483646
    || dto.pendingDeclarationAcknowledged !== true || !Array.isArray(dto.rows) || dto.rows.length < 1 || dto.rows.length > 20) throw invalid();
  const rows = dto.rows.map(row => {
    if (!exact(row, ['category', 'name', 'specification', 'unit', 'quantity', 'unitPrice', 'supplierCandidate', 'sourceHint'])
      || !['part', 'labor', 'other'].includes(row.category)
      || !['unknown', 'pending_purchase', 'existing_stock', 'customer_supplied'].includes(row.sourceHint)) throw invalid();
    if (row.category !== 'part' && (row.supplierCandidate !== '' || row.sourceHint !== 'unknown')) throw invalid();
    return { category: row.category, name: safeText(row.name, 120, true), specification: safeText(row.specification, 200),
      unit: safeText(row.unit, 20), quantity: decimal(row.quantity, true), unitPrice: decimal(row.unitPrice, false),
      supplierCandidate: safeText(row.supplierCandidate, 120), sourceHint: row.sourceHint };
  });
  const data = { plan: safeText(dto.plan, 1000, true), notes: safeText(dto.notes, 1000), rows };
  proposalAmounts(data); // Bound totals even when another line has unknown values.
  return { requestId: dto.requestId.toLowerCase(), expectedIntakeRevision: dto.expectedIntakeRevision,
    expectedAssociationRevision: dto.expectedAssociationRevision, expectedDraftRevision: dto.expectedDraftRevision,
    ...data, pendingDeclarationAcknowledged: true as const };
}
export function proposalAmounts(data: { rows: Array<{ quantity: string; unitPrice: string; unit: string }> }) {
  let sum = 0n, complete = true;
  const amounts = data.rows.map(row => {
    if (row.quantity === '' || row.unitPrice === '' || !row.unit) { complete = false; return null; }
    const n = (cents(row.quantity) * cents(row.unitPrice) + 50n) / 100n;
    sum += n;
    if (sum > 9999999999n) throw invalid();
    return money(n);
  });
  return { amounts, quoteTotal: complete ? money(sum) : null };
}
export function proposalRequestHash(workOrderId: number, actorId: number, sourceHash: string, input: SaveIntakeProposalDto) {
  return intakeAssociationHash([workOrderId, actorId, sourceHash, input]);
}
export function proposalSnapshot(document: RepairDocumentVersion) {
  try {
    const p = document.payload as unknown as SaveIntakeProposalDto;
    const refs = document.sourceReferences;
    const s = refs?.[0];
    const input = normalizeIntakeProposal(p);
    if (document.documentType !== OWNER_INTAKE_PROPOSAL_TYPE || !['draft', 'superseded'].includes(document.status)
      || document.generatedBy !== 'human' || document.reviewedBy !== null || document.reviewedAt !== null || document.reviewNote !== null
      || !Number.isInteger(document.version) || document.version !== input.expectedDraftRevision + 1
      || document.summary !== proposalSummary(input.requestId) || !Array.isArray(refs) || refs.length !== 1
      || !exact(s, ['contract', 'sourceHash', 'requestHash']) || s!.contract !== INTAKE_PROPOSAL_CONTRACT
      || typeof s!.sourceHash !== 'string' || !HASH.test(s!.sourceHash)
      || s!.requestHash !== proposalRequestHash(document.workOrderId, document.createdBy, s!.sourceHash, input)
      || canonical(p) !== canonical(input)) throw invalid();
    return { input, sourceHash: s!.sourceHash as string, requestHash: s!.requestHash as string };
  } catch {
    throw new ConflictException('[intake_proposal_integrity] 草稿完整性或状态已变化，不能覆盖或当作正式报价');
  }
}
