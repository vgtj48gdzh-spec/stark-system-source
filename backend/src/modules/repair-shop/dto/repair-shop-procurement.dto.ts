import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateRepairVehicleIdentityEvidenceDto {
  @IsIn(['vin_photo_ocr', 'manual_entry', 'licensed_decoder'])
  evidenceType!: 'vin_photo_ocr' | 'manual_entry' | 'licensed_decoder';

  @IsString() @IsNotEmpty() @MaxLength(80)
  providerCode!: string;

  @IsOptional() @IsString() @MaxLength(80)
  providerVersion?: string;

  @IsString() @IsNotEmpty() @MaxLength(255)
  evidenceRef!: string;

  @IsOptional() @Matches(/^[a-f0-9]{64}$/i)
  imageSha256?: string;

  @IsString() @Matches(/^[A-HJ-NPR-Z0-9\s-]{17,32}$/i)
  vinCandidate!: string;

  @Type(() => Number) @IsNumber() @Min(0) @Max(100)
  confidence!: number;

  @IsOptional() @IsObject()
  decodeSnapshot?: Record<string, unknown>;

  @IsString() @IsNotEmpty() @MaxLength(96)
  requestIdempotencyKey!: string;
}

export class ReviewRepairEvidenceDto {
  @IsInt() @Min(1)
  expectedVersion!: number;

  @IsIn(['confirmed', 'rejected'])
  decision!: 'confirmed' | 'rejected';

  @IsString() @IsNotEmpty() @MaxLength(500)
  reviewNote!: string;
}

export class CreateRepairPartFitmentEvidenceDto {
  @IsIn(['manufacturer_epc', 'licensed_catalog', 'supplier', 'manual', 'ai_candidate'])
  sourceType!: 'manufacturer_epc' | 'licensed_catalog' | 'supplier' | 'manual' | 'ai_candidate';

  @IsString() @IsNotEmpty() @MaxLength(80)
  providerCode!: string;

  @IsOptional() @IsString() @MaxLength(80)
  providerVersion?: string;

  @IsString() @IsNotEmpty() @MaxLength(255)
  sourceRef!: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  oeNumber!: string;

  @IsString() @IsNotEmpty() @MaxLength(160)
  partName!: string;

  @IsOptional() @IsString() @MaxLength(255)
  diagramRef?: string;

  @IsObject()
  applicabilitySnapshot!: Record<string, unknown>;

  @Type(() => Number) @IsNumber() @Min(0) @Max(100)
  confidence!: number;

  @IsOptional() @IsDateString()
  validUntil?: string;

  @IsString() @IsNotEmpty() @MaxLength(96)
  requestIdempotencyKey!: string;
}

export class CreateRepairProcurementDemandDto {
  @IsInt() @Min(1)
  planVersion!: number;

  @IsInt() @Min(1)
  quoteVersion!: number;

  @IsString() @IsNotEmpty() @MaxLength(100)
  planItemRef!: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  quoteLineRef!: string;

  @IsInt() @Min(1)
  fitmentEvidenceId!: number;

  @IsOptional() @IsInt() @Min(1)
  materialId?: number;

  @IsString() @IsNotEmpty() @MaxLength(100)
  oeNumber!: string;

  @IsString() @IsNotEmpty() @MaxLength(160)
  partName!: string;

  @IsOptional() @IsString() @MaxLength(200)
  specification?: string;

  @IsNumberString()
  quantity!: string;

  @IsString() @IsNotEmpty() @MaxLength(30)
  unit!: string;

  @IsIn(['stock_first', 'procure', 'direct_delivery'])
  fulfillmentMode!: 'stock_first' | 'procure' | 'direct_delivery';

  @IsOptional() @IsString() @MaxLength(80)
  specialFlag?: string;

  @IsString() @IsNotEmpty() @MaxLength(96)
  requestIdempotencyKey!: string;
}

export class CheckRepairDemandInventoryDto {
  @IsInt() @Min(1)
  expectedVersion!: number;
}

export class CreateRepairSupplierInquiriesDto {
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(10) @IsInt({ each: true })
  supplierIds!: number[];

  @IsString() @IsNotEmpty() @MaxLength(96)
  requestIdempotencyKey!: string;

  @IsOptional() @IsString() @MaxLength(500)
  inquiryNote?: string;
}

export class RecordRepairSupplierQuoteDto {
  @IsNumberString()
  unitPrice!: string;

  @IsNumberString()
  quantity!: string;

  @IsOptional() @IsNumberString()
  freightAmount?: string;

  @IsBoolean()
  taxIncluded!: boolean;

  @IsInt() @Min(0) @Max(365)
  leadTimeDays!: number;

  @IsBoolean()
  returnable!: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(120)
  warrantyMonths?: number;

  @IsString() @IsNotEmpty() @MaxLength(120)
  paymentTerms!: string;

  @IsDateString()
  validUntil!: string;

  @IsString() @IsNotEmpty() @MaxLength(255)
  sourceRef!: string;

  @IsOptional() @IsObject()
  responseSnapshot?: Record<string, unknown>;

  @IsInt() @Min(1)
  fitmentEvidenceId!: number;

  @IsString() @IsNotEmpty() @MaxLength(96)
  requestIdempotencyKey!: string;
}

export class ExternalRepairPriceCandidateDto {
  @IsString() @IsNotEmpty() @MaxLength(255)
  sourceRef!: string;

  @IsString() @IsNotEmpty() @MaxLength(80)
  provider!: string;

  @IsDateString()
  collectedAt!: string;

  @Type(() => Number) @IsNumber() @Min(0)
  unitPrice!: number;

  @IsString() @IsNotEmpty() @MaxLength(12)
  currency!: string;

  @IsString() @IsNotEmpty() @MaxLength(160)
  licenseBasis!: string;
}

export class CreateRepairProcurementDecisionDto {
  @IsInt() @Min(1)
  selectedQuoteId!: number;

  @IsIn(['customer', 'leader', 'both'])
  approvalMode!: 'customer' | 'leader' | 'both';

  @IsOptional() @IsInt() @Min(1)
  customerConfirmationRequestId?: number;

  @IsOptional() @IsInt() @Min(1)
  approvalRequestId?: number;

  @IsOptional() @IsString() @MaxLength(500)
  overrideReason?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(20)
  @ValidateNested({ each: true }) @Type(() => ExternalRepairPriceCandidateDto)
  externalPriceCandidates?: ExternalRepairPriceCandidateDto[];

  @IsString() @IsNotEmpty() @MaxLength(96)
  requestIdempotencyKey!: string;
}

export class RequestRepairProcurementLeaderApprovalDto {
  @IsInt() @Min(1)
  selectedQuoteId!: number;

  @IsString() @IsNotEmpty() @MaxLength(300)
  reason!: string;
}

export class RefreshRepairProcurementDecisionDto {
  @IsInt() @Min(1)
  expectedVersion!: number;
}

export class CreateRepairPurchaseOrderDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @IsInt({ each: true })
  decisionIds!: number[];

  @IsInt() @Min(1)
  approvalRequestId!: number;

  @IsOptional() @IsDateString()
  expectedArrivalAt?: string;

  @IsString() @IsNotEmpty() @MaxLength(96)
  requestIdempotencyKey!: string;
}

export class IssueRepairPurchaseOrderDto {
  @IsInt() @Min(1)
  expectedVersion!: number;

  @IsString() @IsNotEmpty() @MaxLength(255)
  issueEvidenceRef!: string;
}

export class BindRepairPaymentIntentDto {
  @IsInt() @Min(1)
  paymentIntentId!: number;

  @IsInt() @Min(1)
  expectedVersion!: number;
}

export class RefreshRepairPaymentStateDto {
  @IsInt() @Min(1)
  expectedVersion!: number;
}

export class RecordRepairSupplierShipmentDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  carrierName!: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  trackingNo!: string;

  @IsString() @IsNotEmpty() @MaxLength(255)
  shipmentEvidenceRef!: string;

  @IsDateString()
  shippedAt!: string;

  @IsOptional() @IsDateString()
  expectedAt?: string;

  @IsString() @IsNotEmpty() @MaxLength(96)
  requestIdempotencyKey!: string;
}

export class RepairGoodsReceiptLineDto {
  @IsInt() @Min(1)
  demandId!: number;

  @IsNumberString()
  quantity!: string;

  @IsIn(['accepted', 'rejected'])
  status!: 'accepted' | 'rejected';
}

export class RecordRepairGoodsReceiptDto {
  @IsInt() @Min(1)
  shipmentId!: number;

  @IsIn(['stock', 'direct_work_order'])
  receiptMode!: 'stock' | 'direct_work_order';

  @IsOptional() @IsInt() @Min(1)
  warehouseId?: number;

  @IsObject()
  inspectionSnapshot!: Record<string, unknown>;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30)
  @ValidateNested({ each: true }) @Type(() => RepairGoodsReceiptLineDto)
  receivedLines!: RepairGoodsReceiptLineDto[];

  @IsDateString()
  receivedAt!: string;

  @IsIn(['accepted', 'partial', 'rejected'])
  status!: 'accepted' | 'partial' | 'rejected';

  @IsString() @IsNotEmpty() @MaxLength(96)
  requestIdempotencyKey!: string;
}

export class BindRepairProcurementAllocationDto {
  @IsInt() @Min(1)
  demandId!: number;

  @IsOptional() @IsInt() @Min(1)
  materialId?: number;

  @IsOptional() @IsInt() @Min(1)
  workOrderMaterialId?: number;

  @IsOptional() @IsInt() @Min(1)
  inventoryTransactionId?: number;

  @IsNumberString()
  quantity!: string;

  @IsString() @IsNotEmpty() @MaxLength(255)
  linkEvidenceRef!: string;

  @IsString() @IsNotEmpty() @MaxLength(96)
  requestIdempotencyKey!: string;
}

export class MarkRepairProcurementInstalledDto {
  @IsInt() @Min(1)
  expectedVersion!: number;

  @IsInt() @Min(1)
  repairTaskId!: number;
}

export class CreateRepairSupplierWarrantyClaimDto {
  @IsInt() @Min(1)
  purchaseOrderId!: number;

  @IsInt() @Min(1)
  receiptId!: number;

  @IsInt() @Min(1)
  allocationId!: number;

  @IsOptional() @IsInt() @Min(1)
  repairWarrantyRecordId?: number;

  @IsObject()
  issueSnapshot!: Record<string, unknown>;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @IsString({ each: true })
  evidenceRefs!: string[];

  @IsString() @IsNotEmpty() @MaxLength(96)
  requestIdempotencyKey!: string;
}
