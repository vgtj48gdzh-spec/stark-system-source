import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsObject,
  IsOptional,
  Matches,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RepairDocumentType } from '../entities/repair-shop.entities';
import type { OwnerProposalDocumentInput } from '../repair-proposal-document-source';

export class CreateRepairVehicleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  companyRef!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  businessSectorRef!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  storeRef!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  customerRef!: string;

  @IsIn(['owner', 'user', 'contact'])
  customerRelationshipType!: 'owner' | 'user' | 'contact';

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  customerRelationshipEvidenceRef!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  plateNumber!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  plateEvidenceRef!: string;

  @IsString()
  @Matches(/^[A-HJ-NPR-Z0-9]{17}$/i, { message: 'VIN 必须为 17 位且不能包含 I、O、Q' })
  vin!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2200)
  modelYear?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  engineCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  salesMarket?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  odometerKm?: number;
}

export class UpdateRepairVehicleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  plateNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  plateChangeEvidenceRef?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-HJ-NPR-Z0-9\s-]{17,32}$/i)
  vin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2200)
  modelYear?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  engineCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  salesMarket?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  odometerKm?: number;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class CreateRepairVehicleCustomerLinkDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  companyRef!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  businessSectorRef!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  storeRef!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  customerRef!: string;

  @IsIn(['owner', 'user', 'contact'])
  relationshipType!: 'owner' | 'user' | 'contact';

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  evidenceRef!: string;

  @IsInt()
  @Min(1)
  expectedVehicleVersion!: number;
}

export class CloseRepairVehicleCustomerLinkDto {
  @IsInt()
  @Min(1)
  expectedVehicleVersion!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  evidenceRef!: string;
}

export class QueryRepairVehiclesDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  companyRef!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  businessSectorRef!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  storeRef!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  customerRef!: string;
}

export class AttachRepairWorkOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  companyRef!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  businessSectorRef!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  storeRef!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  customerRef!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  scopeResolutionEvidenceRef!: string;

  @IsInt()
  @Min(1)
  vehicleId!: number;
}

export class CreateRepairDocumentVersionDto {
  // Strict nested shape is also enforced in the service for non-HTTP callers.
  @IsOptional()
  @IsObject()
  ownerProposalSource?: OwnerProposalDocumentInput;

  @IsIn([
    'intake_inspection',
    'diagnosis',
    'repair_plan',
    'quote',
    'customer_explanation',
  ] satisfies RepairDocumentType[])
  documentType!: RepairDocumentType;

  @IsInt()
  @Min(1)
  expectedProfileVersion!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  summary!: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  sourceReferences?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsIn(['human', 'ai'])
  generatedBy?: 'human' | 'ai';
}

export class ReviewRepairDocumentVersionDto {
  @IsInt()
  @Min(1)
  expectedProfileVersion!: number;

  @IsIn(['approved', 'rejected'])
  decision!: 'approved' | 'rejected';

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reviewNote!: string;
}

export class CreateRepairConfirmationRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(96)
  requestIdempotencyKey!: string;

  @IsInt()
  @Min(1)
  expectedProfileVersion!: number;

  @IsInt()
  @Min(1)
  planVersion!: number;

  @IsInt()
  @Min(1)
  quoteVersion!: number;

  @IsInt()
  @Min(1)
  explanationVersion!: number;

  @IsIn(['in_store', 'phone', 'wechat', 'sms', 'portal'])
  channel!: 'in_store' | 'phone' | 'wechat' | 'sms' | 'portal';

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  recipientMasked!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class RecordRepairConfirmationDecisionDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsIn(['confirmed', 'rejected'])
  decision!: 'confirmed' | 'rejected';

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  evidenceRef!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CreateRepairTaskDto {
  @IsInt()
  @Min(1)
  expectedProfileVersion!: number;

  @IsInt()
  @Min(1)
  planVersion!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  planItemRef!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  reworkOfInspectionId?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  system?: string;

  @IsInt()
  @Min(1)
  technicianEmployeeId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  safetyNotes?: string;
}

export class UpdateRepairTaskStatusDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsIn(['pending', 'in_progress', 'blocked', 'completed', 'cancelled'])
  status!: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';

  @IsOptional()
  @IsObject()
  completionEvidence?: Record<string, unknown>;
}

export class CreateRepairLaborItemDto {
  @IsInt()
  @Min(1)
  taskId!: number;

  @IsInt()
  @Min(1)
  technicianEmployeeId!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  laborCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsNumberString()
  standardHours!: string;

  @IsNumberString()
  actualHours!: string;

  @IsNumberString()
  hourlyRate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  quoteLineRef!: string;
}

export class CreateRepairPartLinkDto {
  @IsInt()
  @Min(1)
  taskId!: number;

  @IsInt()
  @Min(1)
  workOrderMaterialId!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  quoteLineRef!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  usageNote?: string;
}

export class CreateRepairQualityInspectionDto {
  @IsInt()
  @Min(1)
  expectedProfileVersion!: number;

  @IsIn(['passed', 'failed'])
  result!: 'passed' | 'failed';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  checklist!: Array<Record<string, unknown>>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  roadTestResult?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reworkReason?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  reworkPlanItemRefs?: string[];

  @IsInt()
  @Min(1)
  inspectedByEmployeeId!: number;
}

export class CreateRepairDeliveryDto {
  @IsInt()
  @Min(1)
  expectedProfileVersion!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  checklist!: Array<Record<string, unknown>>;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  customerAckEvidenceRef!: string;

  @IsInt()
  @Min(0)
  finalOdometerKm!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  repairSummary!: string;

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  unresolvedReminders!: string[];

  @IsInt()
  @Min(1)
  deliveredByEmployeeId!: number;

  @IsDateString()
  deliveredAt!: string;
}

export class CreateRepairWarrantyDto {
  @IsInt()
  @Min(1)
  expectedProfileVersion!: number;

  @IsIn(['coverage', 'claim'])
  warrantyType!: 'coverage' | 'claim';

  @IsObject()
  coverageSnapshot!: Record<string, unknown>;

  @IsDateString()
  startsAt!: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  claimNote?: string;
}

export class CreateRepairKnowledgeReferenceDto {
  @IsIn(['regulation', 'manufacturer_manual', 'service_bulletin', 'case', 'video'])
  referenceType!: 'regulation' | 'manufacturer_manual' | 'service_bulletin' | 'case' | 'video';

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  url!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  sourceAuthority!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  authorityRank!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @IsString({ each: true })
  tags!: string[];

  @IsObject()
  applicability!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  revision?: string;

  @IsOptional()
  @IsDateString()
  effectiveAt?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  riskNotice?: string;
}

export class UpdateRepairKnowledgeReviewDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsIn(['verified', 'review_required', 'withdrawn', 'superseded'])
  reviewStatus!: 'verified' | 'review_required' | 'withdrawn' | 'superseded';

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reviewReason!: string;
}

export class CreateRepairAiDraftDto {
  @IsInt()
  @Min(1)
  expectedProfileVersion!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(96)
  requestIdempotencyKey!: string;

  @IsIn([
    'fault_assessment',
    'repair_plan',
    'customer_explanation',
    'consistency_review',
    'knowledge_recommendation',
  ])
  draftType!:
    | 'fault_assessment'
    | 'repair_plan'
    | 'customer_explanation'
    | 'consistency_review'
    | 'knowledge_recommendation';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  symptoms?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  customerQuestion?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  searchTerms?: string[];

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}

export class TransitionRepairLifecycleDto {
  @IsInt()
  @Min(1)
  expectedProfileVersion!: number;

  @IsIn(['suspended', 'cancelled', 'closed', 'resume'])
  targetStatus!: 'suspended' | 'cancelled' | 'closed' | 'resume';

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class QueryRepairKnowledgeDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  query?: string;

  @IsOptional()
  @IsIn(['regulation', 'manufacturer_manual', 'service_bulletin', 'case', 'video'])
  referenceType?: 'regulation' | 'manufacturer_manual' | 'service_bulletin' | 'case' | 'video';
}
