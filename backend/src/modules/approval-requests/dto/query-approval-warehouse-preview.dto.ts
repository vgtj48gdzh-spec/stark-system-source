import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  APPROVAL_WAREHOUSE_EVIDENCE_CANDIDATE_STATUSES,
  APPROVAL_WAREHOUSE_EVIDENCE_CANDIDATE_TYPES,
} from '../approval-warehouse-evidence-intake.contract';

export const APPROVAL_WAREHOUSE_PREVIEW_SOURCE_SYSTEMS = [
  'stark_abc_sync',
  'stark_inventory',
  'stark_work_order',
] as const;

export type ApprovalWarehousePreviewSourceSystem =
  (typeof APPROVAL_WAREHOUSE_PREVIEW_SOURCE_SYSTEMS)[number];

export class QueryApprovalWarehousePreviewDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(APPROVAL_WAREHOUSE_EVIDENCE_CANDIDATE_TYPES)
  candidateType?: (typeof APPROVAL_WAREHOUSE_EVIDENCE_CANDIDATE_TYPES)[number];

  @IsOptional()
  @IsIn(APPROVAL_WAREHOUSE_PREVIEW_SOURCE_SYSTEMS)
  sourceSystem?: ApprovalWarehousePreviewSourceSystem;

  @IsOptional()
  @IsIn(APPROVAL_WAREHOUSE_EVIDENCE_CANDIDATE_STATUSES)
  status?: (typeof APPROVAL_WAREHOUSE_EVIDENCE_CANDIDATE_STATUSES)[number];
}
