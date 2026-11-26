import { BadRequestException } from '@nestjs/common';
import { WorkOrderStatus } from '../../shared/enums/work-order-status.enum';

export const INTAKE_PREFIX = 'STARK_INTAKE_V1:';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Latest intake-only snapshot; never a vehicle/quote/repair authority. */
export interface WorkOrderIntakeDetails {
  r: number;
  // Deliberately not `k`: legacy creation lookup searches that JSON key.
  q: string;
  v: string | null;
  o: number | null;
  t: string | null;
}

export function normalizeIntakeDetails(value: {
  vin: string | null; odometerKm: number | null; requestedService: string | null;
}) {
  if (value.vin !== null && (typeof value.vin !== 'string' || !/^[A-HJ-NPR-Z0-9]{17}$/i.test(value.vin))) {
    throw new BadRequestException('[intake_details_invalid] VIN 应为 17 位；未核实请留空');
  }
  if (value.odometerKm !== null && (!Number.isInteger(value.odometerKm) || value.odometerKm < 0 || value.odometerKm > 9999999)) {
    throw new BadRequestException('[intake_details_invalid] 里程应为非负整数；未核实请留空');
  }
  if (value.requestedService !== null && (typeof value.requestedService !== 'string' || value.requestedService.length > 100)) {
    throw new BadRequestException('[intake_details_invalid] 保养需求最多 100 字');
  }
  return { v: value.vin?.toUpperCase() ?? null, o: value.odometerKm,
    t: value.requestedService === null || value.requestedService.trim() === '' ? null : safeIntakeText(value.requestedService) };
}

/** Bounded structured remark on the existing root, not a second business ledger. */
export interface WorkOrderIntakeMetadata {
  v: 1;
  k: string;
  s: string;
  c: string;
  sv: number;
  sn: string;
  p: string;
  m: string;
  d?: WorkOrderIntakeDetails;
}

export function encodeIntakeMetadata(value: WorkOrderIntakeMetadata): string {
  const encoded = INTAKE_PREFIX + JSON.stringify(value);
  if (encoded.length > 500 || !decodeIntakeMetadata(encoded)) {
    throw new BadRequestException('[intake_metadata_invalid] 接车资料过长或格式无效');
  }
  return encoded;
}

export function decodeIntakeMetadata(remark: string | null | undefined): WorkOrderIntakeMetadata | null {
  if (!remark?.startsWith(INTAKE_PREFIX)) return null;
  try {
    const value = JSON.parse(remark.slice(INTAKE_PREFIX.length));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (!['c,k,m,p,s,sn,sv,v', 'c,d,k,m,p,s,sn,sv,v'].includes(Object.keys(value).sort().join(','))) return null;
    if (value.v !== 1 || !Number.isSafeInteger(value.sv) || value.sv < 1) return null;
    if (!UUID_V4.test(value.k)) return null;
    if (!['s', 'c', 'sn', 'p', 'm'].every((key) => typeof value[key] === 'string' && value[key].trim().length > 0)) return null;
    if ('d' in value) {
      const d = value.d;
      if (!d || typeof d !== 'object' || Array.isArray(d) || Object.keys(d).sort().join(',') !== 'o,q,r,t,v'
        || !Number.isInteger(d.r) || d.r < 1 || d.r > 2147483647 || !UUID_V4.test(d.q)) return null;
      const normalized = normalizeIntakeDetails({ vin: d.v, odometerKm: d.o, requestedService: d.t });
      if (normalized.v !== d.v || normalized.o !== d.o || normalized.t !== d.t) return null;
    }
    return value as WorkOrderIntakeMetadata;
  } catch {
    return null;
  }
}

export function isWorkOrderUnquoted(workOrder: { status: string; remark?: string | null }) {
  return workOrder.status === WorkOrderStatus.DRAFT || Boolean(workOrder.remark?.startsWith(INTAKE_PREFIX));
}

export function assertWorkOrderNotUnquoted(workOrder: { status: string; remark?: string | null }) {
  // The marker remains a guard even if a legacy writer accidentally changes status.
  if (isWorkOrderUnquoted(workOrder)) {
    throw new BadRequestException('[work_order_unquoted] 接车草稿尚未报价，不能收款、确认、施工或修改为正式业务');
  }
}

export function safeIntakeText(value: string): string {
  const normalized = value.trim();
  if (!normalized || /1[3-9]\d{9}/.test(normalized) || /[\u0000-\u001f]/.test(normalized)) {
    throw new BadRequestException('[intake_text_invalid] 请将电话只填在手机号栏，不要在文字栏填写敏感号码');
  }
  return normalized;
}
