import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type RepairEvidenceReviewStatus =
  | 'review_pending'
  | 'confirmed'
  | 'rejected'
  | 'superseded';

@Entity('repair_vehicle_identity_evidence')
@Index('uq_repair_vehicle_identity_idempotency', ['requestIdempotencyKey'], { unique: true })
@Index('idx_repair_vehicle_identity_vehicle', ['vehicleId', 'reviewStatus'])
export class RepairVehicleIdentityEvidence {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'vehicle_id', type: 'int' })
  vehicleId!: number;

  @Column({ name: 'company_ref', type: 'varchar', length: 100 })
  companyRef!: string;

  @Column({ name: 'business_sector_ref', type: 'varchar', length: 100 })
  businessSectorRef!: string;

  @Column({ name: 'store_ref', type: 'varchar', length: 100 })
  storeRef!: string;

  @Column({ name: 'customer_ref', type: 'varchar', length: 100 })
  customerRef!: string;

  @Column({ name: 'evidence_type', type: 'varchar', length: 32 })
  evidenceType!: 'vin_photo_ocr' | 'manual_entry' | 'licensed_decoder';

  @Column({ name: 'provider_code', type: 'varchar', length: 80 })
  providerCode!: string;

  @Column({ name: 'provider_version', type: 'varchar', length: 80, nullable: true })
  providerVersion!: string | null;

  @Column({ name: 'evidence_ref', type: 'varchar', length: 255 })
  evidenceRef!: string;

  @Column({ name: 'image_sha256', type: 'char', length: 64, nullable: true })
  imageSha256!: string | null;

  @Column({ name: 'vin_candidate', type: 'char', length: 17 })
  vinCandidate!: string;

  @Column({ name: 'checksum_status', type: 'varchar', length: 24 })
  checksumStatus!: 'valid' | 'invalid' | 'not_applicable';

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  confidence!: string;

  @Column({ name: 'decode_snapshot', type: 'json', nullable: true })
  decodeSnapshot!: Record<string, unknown> | null;

  @Column({ name: 'request_idempotency_key', type: 'varchar', length: 96 })
  requestIdempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64 })
  requestFingerprint!: string;

  @Column({ name: 'review_status', type: 'varchar', length: 24, default: 'review_pending' })
  reviewStatus!: RepairEvidenceReviewStatus;

  @Column({ name: 'review_note', type: 'varchar', length: 500, nullable: true })
  reviewNote!: string | null;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'reviewed_by', type: 'int', nullable: true })
  reviewedBy!: number | null;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true })
  reviewedAt!: Date | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('repair_part_fitment_evidence')
@Index('uq_repair_part_fitment_idempotency', ['requestIdempotencyKey'], { unique: true })
@Index('idx_repair_part_fitment_work_order', ['workOrderId', 'fitmentStatus'])
export class RepairPartFitmentEvidence {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'work_order_id', type: 'int' })
  workOrderId!: number;

  @Column({ name: 'vehicle_id', type: 'int' })
  vehicleId!: number;

  @Column({ name: 'company_ref', type: 'varchar', length: 100 })
  companyRef!: string;

  @Column({ name: 'business_sector_ref', type: 'varchar', length: 100 })
  businessSectorRef!: string;

  @Column({ name: 'store_ref', type: 'varchar', length: 100 })
  storeRef!: string;

  @Column({ name: 'customer_ref', type: 'varchar', length: 100 })
  customerRef!: string;

  @Column({ name: 'source_type', type: 'varchar', length: 32 })
  sourceType!: 'manufacturer_epc' | 'licensed_catalog' | 'supplier' | 'manual' | 'ai_candidate';

  @Column({ name: 'provider_code', type: 'varchar', length: 80 })
  providerCode!: string;

  @Column({ name: 'provider_version', type: 'varchar', length: 80, nullable: true })
  providerVersion!: string | null;

  @Column({ name: 'source_ref', type: 'varchar', length: 255 })
  sourceRef!: string;

  @Column({ name: 'oe_number', type: 'varchar', length: 100 })
  oeNumber!: string;

  @Column({ name: 'part_name', type: 'varchar', length: 160 })
  partName!: string;

  @Column({ name: 'diagram_ref', type: 'varchar', length: 255, nullable: true })
  diagramRef!: string | null;

  @Column({ name: 'applicability_snapshot', type: 'json' })
  applicabilitySnapshot!: Record<string, unknown>;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  confidence!: string;

  @Column({ name: 'request_idempotency_key', type: 'varchar', length: 96 })
  requestIdempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64 })
  requestFingerprint!: string;

  @Column({ name: 'fitment_status', type: 'varchar', length: 24, default: 'candidate' })
  fitmentStatus!: 'candidate' | 'confirmed' | 'rejected' | 'stale' | 'superseded';

  @Column({ name: 'review_note', type: 'varchar', length: 500, nullable: true })
  reviewNote!: string | null;

  @Column({ name: 'valid_until', type: 'datetime', nullable: true })
  validUntil!: Date | null;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'reviewed_by', type: 'int', nullable: true })
  reviewedBy!: number | null;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true })
  reviewedAt!: Date | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('repair_procurement_demands')
@Index('uq_repair_procurement_demand_idempotency', ['requestIdempotencyKey'], { unique: true })
@Index('idx_repair_procurement_demand_work_order', ['workOrderId', 'status'])
export class RepairProcurementDemand {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'work_order_id', type: 'int' })
  workOrderId!: number;

  @Column({ name: 'vehicle_id', type: 'int' })
  vehicleId!: number;

  @Column({ name: 'company_ref', type: 'varchar', length: 100 })
  companyRef!: string;

  @Column({ name: 'business_sector_ref', type: 'varchar', length: 100 })
  businessSectorRef!: string;

  @Column({ name: 'store_ref', type: 'varchar', length: 100 })
  storeRef!: string;

  @Column({ name: 'customer_ref', type: 'varchar', length: 100 })
  customerRef!: string;

  @Column({ name: 'plan_version', type: 'int' })
  planVersion!: number;

  @Column({ name: 'quote_version', type: 'int' })
  quoteVersion!: number;

  @Column({ name: 'plan_item_ref', type: 'varchar', length: 100 })
  planItemRef!: string;

  @Column({ name: 'quote_line_ref', type: 'varchar', length: 100 })
  quoteLineRef!: string;

  @Column({ name: 'fitment_evidence_id', type: 'int' })
  fitmentEvidenceId!: number;

  @Column({ name: 'material_id', type: 'int', nullable: true })
  materialId!: number | null;

  @Column({ name: 'oe_number', type: 'varchar', length: 100 })
  oeNumber!: string;

  @Column({ name: 'part_name', type: 'varchar', length: 160 })
  partName!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  specification!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantity!: string;

  @Column({ type: 'varchar', length: 30 })
  unit!: string;

  @Column({ name: 'fulfillment_mode', type: 'varchar', length: 32 })
  fulfillmentMode!: 'stock_first' | 'procure' | 'direct_delivery';

  @Column({ name: 'special_flag', type: 'varchar', length: 80, nullable: true })
  specialFlag!: string | null;

  @Column({ name: 'inventory_snapshot', type: 'json', nullable: true })
  inventorySnapshot!: Record<string, unknown> | null;

  @Column({ name: 'request_idempotency_key', type: 'varchar', length: 96 })
  requestIdempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64 })
  requestFingerprint!: string;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status!:
    | 'draft'
    | 'inventory_checked'
    | 'inquiry_open'
    | 'decision_pending'
    | 'approved'
    | 'order_prepared'
    | 'ordered'
    | 'fulfilled'
    | 'cancelled';

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'updated_by', type: 'int', nullable: true })
  updatedBy!: number | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('repair_supplier_inquiries')
@Index('uq_repair_supplier_inquiry_idempotency', ['requestIdempotencyKey'], { unique: true })
@Index('idx_repair_supplier_inquiry_demand', ['demandId', 'status'])
export class RepairSupplierInquiry {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'demand_id', type: 'int' })
  demandId!: number;

  @Column({ name: 'work_order_id', type: 'int' })
  workOrderId!: number;

  @Column({ name: 'supplier_id', type: 'int' })
  supplierId!: number;

  @Column({ name: 'supplier_name_snapshot', type: 'varchar', length: 100 })
  supplierNameSnapshot!: string;

  @Column({ name: 'supplier_score_snapshot', type: 'decimal', precision: 5, scale: 2, nullable: true })
  supplierScoreSnapshot!: string | null;

  @Column({ name: 'inquiry_no', type: 'varchar', length: 48, unique: true })
  inquiryNo!: string;

  @Column({ name: 'request_snapshot', type: 'json' })
  requestSnapshot!: Record<string, unknown>;

  @Column({ name: 'request_idempotency_key', type: 'varchar', length: 96 })
  requestIdempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64 })
  requestFingerprint!: string;

  @Column({ type: 'varchar', length: 24, default: 'draft' })
  status!: 'draft' | 'requested' | 'responded' | 'expired' | 'cancelled';

  @Column({ name: 'requested_at', type: 'datetime', nullable: true })
  requestedAt!: Date | null;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('repair_supplier_quotes')
@Index('uq_repair_supplier_quote_idempotency', ['requestIdempotencyKey'], { unique: true })
@Index('uq_repair_supplier_quote_version', ['inquiryId', 'quoteVersion'], { unique: true })
@Index('idx_repair_supplier_quote_demand', ['demandId', 'status'])
export class RepairSupplierQuote {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'inquiry_id', type: 'int' })
  inquiryId!: number;

  @Column({ name: 'demand_id', type: 'int' })
  demandId!: number;

  @Column({ name: 'work_order_id', type: 'int' })
  workOrderId!: number;

  @Column({ name: 'supplier_id', type: 'int' })
  supplierId!: number;

  @Column({ name: 'quote_version', type: 'int' })
  quoteVersion!: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2 })
  unitPrice!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantity!: string;

  @Column({ name: 'freight_amount', type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  freightAmount!: string;

  @Column({ name: 'tax_included', type: 'boolean', default: false })
  taxIncluded!: boolean;

  @Column({ name: 'lead_time_days', type: 'int' })
  leadTimeDays!: number;

  @Column({ type: 'boolean', default: false })
  returnable!: boolean;

  @Column({ name: 'warranty_months', type: 'int', nullable: true })
  warrantyMonths!: number | null;

  @Column({ name: 'payment_terms', type: 'varchar', length: 120 })
  paymentTerms!: string;

  @Column({ name: 'valid_until', type: 'datetime' })
  validUntil!: Date;

  @Column({ name: 'source_ref', type: 'varchar', length: 255 })
  sourceRef!: string;

  @Column({ name: 'response_snapshot', type: 'json', nullable: true })
  responseSnapshot!: Record<string, unknown> | null;

  @Column({ name: 'fitment_evidence_id', type: 'int' })
  fitmentEvidenceId!: number;

  @Column({ name: 'request_idempotency_key', type: 'varchar', length: 96 })
  requestIdempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64 })
  requestFingerprint!: string;

  @Column({ type: 'varchar', length: 24, default: 'candidate' })
  status!: 'candidate' | 'shortlisted' | 'rejected' | 'superseded';

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

@Entity('repair_procurement_decisions')
@Index('uq_repair_procurement_decision_idempotency', ['requestIdempotencyKey'], { unique: true })
@Index('uq_repair_procurement_decision_version', ['demandId', 'decisionVersion'], { unique: true })
@Index('uq_repair_procurement_decision_approval', ['approvalRequestId'], { unique: true })
@Index('idx_repair_procurement_decision_work_order', ['workOrderId', 'decisionStatus'])
export class RepairProcurementDecision {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'demand_id', type: 'int' })
  demandId!: number;

  @Column({ name: 'work_order_id', type: 'int' })
  workOrderId!: number;

  @Column({ name: 'decision_version', type: 'int' })
  decisionVersion!: number;

  @Column({ name: 'selected_quote_id', type: 'int' })
  selectedQuoteId!: number;

  @Column({ name: 'approval_mode', type: 'varchar', length: 24 })
  approvalMode!: 'customer' | 'leader' | 'both';

  @Column({ name: 'customer_confirmation_request_id', type: 'int', nullable: true })
  customerConfirmationRequestId!: number | null;

  @Column({ name: 'approval_request_id', type: 'int', nullable: true })
  approvalRequestId!: number | null;

  @Column({ name: 'ai_analysis_snapshot', type: 'json' })
  aiAnalysisSnapshot!: Record<string, unknown>;

  @Column({ name: 'override_reason', type: 'varchar', length: 500, nullable: true })
  overrideReason!: string | null;

  @Column({ name: 'request_idempotency_key', type: 'varchar', length: 96 })
  requestIdempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64 })
  requestFingerprint!: string;

  @Column({ name: 'decision_status', type: 'varchar', length: 40 })
  decisionStatus!:
    | 'customer_confirmation_pending'
    | 'leader_approval_pending'
    | 'both_pending'
    | 'approved'
    | 'rejected'
    | 'superseded';

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'updated_by', type: 'int', nullable: true })
  updatedBy!: number | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('repair_purchase_orders')
@Index('uq_repair_purchase_order_idempotency', ['requestIdempotencyKey'], { unique: true })
@Index('uq_repair_purchase_order_payment_approval', ['paymentApprovalRequestId'], { unique: true })
@Index('idx_repair_purchase_order_work_order', ['workOrderId', 'status'])
export class RepairPurchaseOrder {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'order_no', type: 'varchar', length: 48, unique: true })
  orderNo!: string;

  @Column({ name: 'work_order_id', type: 'int' })
  workOrderId!: number;

  @Column({ name: 'vehicle_id', type: 'int' })
  vehicleId!: number;

  @Column({ name: 'company_ref', type: 'varchar', length: 100 })
  companyRef!: string;

  @Column({ name: 'business_sector_ref', type: 'varchar', length: 100 })
  businessSectorRef!: string;

  @Column({ name: 'store_ref', type: 'varchar', length: 100 })
  storeRef!: string;

  @Column({ name: 'customer_ref', type: 'varchar', length: 100 })
  customerRef!: string;

  @Column({ name: 'supplier_id', type: 'int' })
  supplierId!: number;

  @Column({ name: 'supplier_name_snapshot', type: 'varchar', length: 100 })
  supplierNameSnapshot!: string;

  @Column({ name: 'decision_ids', type: 'json' })
  decisionIds!: number[];

  @Column({ name: 'line_snapshot', type: 'json' })
  lineSnapshot!: Array<Record<string, unknown>>;

  @Column({ name: 'approval_request_ids', type: 'json' })
  approvalRequestIds!: number[];

  @Column({ name: 'payment_approval_request_id', type: 'int' })
  paymentApprovalRequestId!: number;

  @Column({ name: 'payment_intent_id', type: 'int', nullable: true })
  paymentIntentId!: number | null;

  @Column({ name: 'payment_state', type: 'varchar', length: 32, default: 'not_bound' })
  paymentState!:
    | 'not_bound'
    | 'approval_pending'
    | 'payment_planned'
    | 'reconciliation_pending'
    | 'confirmed_external_evidence';

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2 })
  totalAmount!: string;

  @Column({ name: 'expected_arrival_at', type: 'datetime', nullable: true })
  expectedArrivalAt!: Date | null;

  @Column({ name: 'issue_evidence_ref', type: 'varchar', length: 255, nullable: true })
  issueEvidenceRef!: string | null;

  @Column({ name: 'request_idempotency_key', type: 'varchar', length: 96 })
  requestIdempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64 })
  requestFingerprint!: string;

  @Column({ type: 'varchar', length: 32, default: 'approval_complete' })
  status!: 'approval_complete' | 'issued' | 'partially_received' | 'received' | 'cancelled';

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'updated_by', type: 'int', nullable: true })
  updatedBy!: number | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('repair_supplier_shipments')
@Index('uq_repair_supplier_shipment_idempotency', ['requestIdempotencyKey'], { unique: true })
@Index('idx_repair_supplier_shipment_order', ['purchaseOrderId', 'status'])
export class RepairSupplierShipment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'purchase_order_id', type: 'int' })
  purchaseOrderId!: number;

  @Column({ name: 'work_order_id', type: 'int' })
  workOrderId!: number;

  @Column({ name: 'carrier_name', type: 'varchar', length: 100 })
  carrierName!: string;

  @Column({ name: 'tracking_no', type: 'varchar', length: 100 })
  trackingNo!: string;

  @Column({ name: 'shipment_evidence_ref', type: 'varchar', length: 255 })
  shipmentEvidenceRef!: string;

  @Column({ name: 'request_idempotency_key', type: 'varchar', length: 96 })
  requestIdempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64 })
  requestFingerprint!: string;

  @Column({ name: 'shipped_at', type: 'datetime' })
  shippedAt!: Date;

  @Column({ name: 'expected_at', type: 'datetime', nullable: true })
  expectedAt!: Date | null;

  @Column({ name: 'delivered_at', type: 'datetime', nullable: true })
  deliveredAt!: Date | null;

  @Column({ type: 'varchar', length: 24, default: 'shipped' })
  status!: 'shipped' | 'in_transit' | 'delivered' | 'exception';

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('repair_goods_receipts')
@Index('uq_repair_goods_receipt_idempotency', ['requestIdempotencyKey'], { unique: true })
@Index('idx_repair_goods_receipt_order', ['purchaseOrderId', 'status'])
export class RepairGoodsReceipt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'receipt_no', type: 'varchar', length: 48, unique: true })
  receiptNo!: string;

  @Column({ name: 'purchase_order_id', type: 'int' })
  purchaseOrderId!: number;

  @Column({ name: 'shipment_id', type: 'int' })
  shipmentId!: number;

  @Column({ name: 'work_order_id', type: 'int' })
  workOrderId!: number;

  @Column({ name: 'receipt_mode', type: 'varchar', length: 32 })
  receiptMode!: 'stock' | 'direct_work_order';

  @Column({ name: 'warehouse_id', type: 'int', nullable: true })
  warehouseId!: number | null;

  @Column({ name: 'inspection_snapshot', type: 'json' })
  inspectionSnapshot!: Record<string, unknown>;

  @Column({ name: 'received_at', type: 'datetime' })
  receivedAt!: Date;

  @Column({ name: 'request_idempotency_key', type: 'varchar', length: 96 })
  requestIdempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64 })
  requestFingerprint!: string;

  @Column({ type: 'varchar', length: 24 })
  status!: 'accepted' | 'partial' | 'rejected';

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

@Entity('repair_procurement_allocations')
@Index('uq_repair_procurement_allocation_idempotency', ['requestIdempotencyKey'], { unique: true })
@Index('idx_repair_procurement_allocation_receipt', ['receiptId', 'status'])
@Index('idx_repair_procurement_allocation_demand', ['demandId', 'status'])
@Index('idx_repair_procurement_allocation_inventory', ['inventoryTransactionId', 'status'])
@Index('idx_repair_procurement_allocation_work_order', ['workOrderId', 'status'])
export class RepairProcurementAllocation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'receipt_id', type: 'int' })
  receiptId!: number;

  @Column({ name: 'demand_id', type: 'int' })
  demandId!: number;

  @Column({ name: 'work_order_id', type: 'int' })
  workOrderId!: number;

  @Column({ name: 'material_id', type: 'int', nullable: true })
  materialId!: number | null;

  @Column({ name: 'work_order_material_id', type: 'int', nullable: true })
  workOrderMaterialId!: number | null;

  @Column({ name: 'inventory_transaction_id', type: 'int', nullable: true })
  inventoryTransactionId!: number | null;

  @Column({ name: 'repair_task_id', type: 'int', nullable: true })
  repairTaskId!: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantity!: string;

  @Column({ name: 'link_evidence_ref', type: 'varchar', length: 255 })
  linkEvidenceRef!: string;

  @Column({ name: 'request_idempotency_key', type: 'varchar', length: 96 })
  requestIdempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64 })
  requestFingerprint!: string;

  @Column({ type: 'varchar', length: 24, default: 'linked' })
  status!: 'linked' | 'installed' | 'returned' | 'cancelled';

  @Column({ name: 'installed_at', type: 'datetime', nullable: true })
  installedAt!: Date | null;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'updated_by', type: 'int', nullable: true })
  updatedBy!: number | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('repair_supplier_warranty_claims')
@Index('uq_repair_supplier_claim_idempotency', ['requestIdempotencyKey'], { unique: true })
@Index('idx_repair_supplier_claim_work_order', ['workOrderId', 'status'])
export class RepairSupplierWarrantyClaim {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'claim_no', type: 'varchar', length: 48, unique: true })
  claimNo!: string;

  @Column({ name: 'purchase_order_id', type: 'int' })
  purchaseOrderId!: number;

  @Column({ name: 'receipt_id', type: 'int' })
  receiptId!: number;

  @Column({ name: 'allocation_id', type: 'int' })
  allocationId!: number;

  @Column({ name: 'work_order_id', type: 'int' })
  workOrderId!: number;

  @Column({ name: 'supplier_id', type: 'int' })
  supplierId!: number;

  @Column({ name: 'repair_warranty_record_id', type: 'int', nullable: true })
  repairWarrantyRecordId!: number | null;

  @Column({ name: 'issue_snapshot', type: 'json' })
  issueSnapshot!: Record<string, unknown>;

  @Column({ name: 'evidence_refs', type: 'json' })
  evidenceRefs!: string[];

  @Column({ name: 'request_idempotency_key', type: 'varchar', length: 96 })
  requestIdempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64 })
  requestFingerprint!: string;

  @Column({ type: 'varchar', length: 24, default: 'draft' })
  status!: 'draft' | 'submitted' | 'accepted' | 'rejected' | 'closed';

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

export const REPAIR_SHOP_PROCUREMENT_ENTITIES = [
  RepairVehicleIdentityEvidence,
  RepairPartFitmentEvidence,
  RepairProcurementDemand,
  RepairSupplierInquiry,
  RepairSupplierQuote,
  RepairProcurementDecision,
  RepairPurchaseOrder,
  RepairSupplierShipment,
  RepairGoodsReceipt,
  RepairProcurementAllocation,
  RepairSupplierWarrantyClaim,
] as const;
