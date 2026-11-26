import { IsIn, IsOptional } from 'class-validator';
import {
  FundTruthLevel,
  FundTruthPrimaryObjectType,
  FundTruthReconciliationStatus,
  FundTruthSourceRole,
} from '../view-models/fund-truth-reconciliation.view-model';

export class QueryFundTruthReconciliationsDto {
  @IsOptional()
  page?: number;

  @IsOptional()
  pageSize?: number;

  @IsOptional()
  @IsIn(['approval_request', 'payment_record', 'payout_record', 'abc_sync_fund'])
  primaryObjectType?: FundTruthPrimaryObjectType;

  @IsOptional()
  @IsIn([
    'approval_control',
    'business_arrival_semantics',
    'payout_registration',
    'sync_replica',
    'report_only',
  ])
  sourceRole?: FundTruthSourceRole;

  @IsOptional()
  @IsIn(['supporting_source', 'replica_only', 'not_truth_source'])
  truthLevel?: FundTruthLevel;

  @IsOptional()
  @IsIn([
    'aligned',
    'partially_aligned',
    'missing_link',
    'no_truth_source',
    'needs_manual_review',
  ])
  reconciliationStatus?: FundTruthReconciliationStatus;
}
