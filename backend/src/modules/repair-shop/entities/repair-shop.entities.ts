import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { REPAIR_SHOP_PROCUREMENT_ENTITIES } from './repair-shop-procurement.entities';

export type RepairLifecycleStatus =
  | 'intake_draft'
  | 'intake_checked'
  | 'diagnosed'
  | 'quote_pending_customer'
  | 'authorized'
  | 'repair_scheduled'
  | 'repairing'
  | 'qc_pending'
  | 'rework_required'
  | 'ready_for_delivery'
  | 'delivered'
  | 'after_sales'
  | 'closed'
  | 'cancelled'
  | 'suspended';

export type RepairDocumentType =
  | 'intake_inspection'
  | 'diagnosis'
  | 'repair_plan'
  | 'quote'
  | 'customer_explanation';

/** Existing VARCHAR storage; deliberately outside every formal document DTO. */
export const OWNER_INTAKE_PROPOSAL_TYPE = 'owner_intake_proposal' as const;
export type RepairStoredDocumentType = RepairDocumentType | typeof OWNER_INTAKE_PROPOSAL_TYPE;
export function isFormalRepairDocumentType(type: unknown): type is RepairDocumentType {
  return ['intake_inspection', 'diagnosis', 'repair_plan', 'quote', 'customer_explanation'].includes(type as string);
}

export type RepairPermission =
  | 'repair.read'
  | 'scope.resolve'
  | 'vehicle.manage'
  | 'intake.manage'
  | 'diagnosis.manage'
  | 'quote.manage'
  | 'confirmation.request'
  | 'confirmation.record'
  | 'repair.execute'
  | 'repair.supervise'
  | 'qc.inspect'
  | 'delivery.record'
  | 'warranty.manage'
  | 'ai.draft'
  | 'knowledge.manage'
  | '*';

@Entity('repair_vehicle_profiles')
@Index('uq_repair_vehicle_company_vin', ['companyRef', 'vin'], { unique: true })
@Index('idx_repair_vehicle_company_plate', ['companyRef', 'plateNumber'])
export class RepairVehicleProfile {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'company_ref', type: 'varchar', length: 100 })
  companyRef!: string;

  @Column({ name: 'business_sector_ref', type: 'varchar', length: 100 })
  businessSectorRef!: string;

  @Column({ name: 'initial_service_store_ref', type: 'varchar', length: 100 })
  initialServiceStoreRef!: string;

  @Column({ name: 'company_display_snapshot', type: 'varchar', length: 200 })
  companyDisplaySnapshot!: string;

  @Column({ name: 'business_sector_display_snapshot', type: 'varchar', length: 120 })
  businessSectorDisplaySnapshot!: string;

  @Column({ name: 'initial_service_store_display_snapshot', type: 'varchar', length: 160 })
  initialServiceStoreDisplaySnapshot!: string;

  @Column({ name: 'scope_snapshot_version', type: 'json' })
  scopeSnapshotVersion!: Record<string, number>;

  @Column({ name: 'plate_number', type: 'varchar', length: 32 })
  plateNumber!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  vin!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  brand!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  model!: string | null;

  @Column({ name: 'model_year', type: 'int', nullable: true })
  modelYear!: number | null;

  @Column({ name: 'engine_code', type: 'varchar', length: 64, nullable: true })
  engineCode!: string | null;

  @Column({ name: 'sales_market', type: 'varchar', length: 32, nullable: true })
  salesMarket!: string | null;

  @Column({ name: 'odometer_km', type: 'int', nullable: true })
  odometerKm!: number | null;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status!: 'active' | 'inactive';

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'updated_by', type: 'int', nullable: true })
  updatedBy!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('repair_vehicle_customer_links')
@Index('idx_repair_vehicle_customer_link_customer', ['companyRef', 'customerRef', 'status'])
@Index('idx_repair_vehicle_customer_link_vehicle', ['vehicleId', 'status'])
export class RepairVehicleCustomerLink {
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

  @Column({ name: 'relationship_type', type: 'varchar', length: 24 })
  relationshipType!: 'owner' | 'user' | 'contact';

  @Column({ name: 'confirmation_status', type: 'varchar', length: 24, default: 'confirmed' })
  confirmationStatus!: 'pending' | 'confirmed' | 'rejected';

  @Column({ type: 'varchar', length: 24, default: 'active' })
  status!: 'active' | 'inactive';

  @Column({ name: 'valid_from', type: 'datetime' })
  validFrom!: Date;

  @Column({ name: 'valid_until', type: 'datetime', nullable: true })
  validUntil!: Date | null;

  @Column({ name: 'relationship_source', type: 'varchar', length: 255 })
  relationshipSource!: string;

  @Column({ name: 'reviewed_by', type: 'int' })
  reviewedBy!: number;

  @Column({ name: 'closed_by', type: 'int', nullable: true })
  closedBy!: number | null;

  @Column({ name: 'closure_evidence_ref', type: 'varchar', length: 255, nullable: true })
  closureEvidenceRef!: string | null;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('repair_vehicle_plate_histories')
@Index('idx_repair_vehicle_plate_history_vehicle', ['vehicleId', 'validFrom'])
@Index('idx_repair_vehicle_plate_history_lookup', ['companyRef', 'plateNumber'])
export class RepairVehiclePlateHistory {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'vehicle_id', type: 'int' })
  vehicleId!: number;

  @Column({ name: 'company_ref', type: 'varchar', length: 100 })
  companyRef!: string;

  @Column({ name: 'plate_number', type: 'varchar', length: 32 })
  plateNumber!: string;

  @Column({ name: 'valid_from', type: 'datetime' })
  validFrom!: Date;

  @Column({ name: 'valid_until', type: 'datetime', nullable: true })
  validUntil!: Date | null;

  @Column({ name: 'source_evidence_ref', type: 'varchar', length: 255 })
  sourceEvidenceRef!: string;

  @Column({ name: 'reviewed_by', type: 'int' })
  reviewedBy!: number;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

@Entity('repair_work_order_profiles')
@Index('uq_repair_work_order_profile_work_order', ['workOrderId'], { unique: true })
@Index('idx_repair_work_order_scope', ['companyRef', 'businessSectorRef', 'storeRef'])
export class RepairWorkOrderProfile {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'work_order_id', type: 'int' })
  workOrderId!: number;

  @Column({ name: 'company_ref', type: 'varchar', length: 100 })
  companyRef!: string;

  @Column({ name: 'business_sector_ref', type: 'varchar', length: 100 })
  businessSectorRef!: string;

  @Column({ name: 'store_ref', type: 'varchar', length: 100 })
  storeRef!: string;

  @Column({ name: 'customer_ref', type: 'varchar', length: 100 })
  customerRef!: string;

  @Column({ name: 'company_display_snapshot', type: 'varchar', length: 200 })
  companyDisplaySnapshot!: string;

  @Column({ name: 'business_sector_display_snapshot', type: 'varchar', length: 120 })
  businessSectorDisplaySnapshot!: string;

  @Column({ name: 'store_display_snapshot', type: 'varchar', length: 160 })
  storeDisplaySnapshot!: string;

  @Column({ name: 'customer_display_snapshot', type: 'varchar', length: 120 })
  customerDisplaySnapshot!: string;

  @Column({ name: 'scope_snapshot_version', type: 'json' })
  // Existing JSON column: numeric foundation versions plus a namespaced, versioned
  // admission binding. No new SQL column/index and no change to vehicle snapshots.
  scopeSnapshotVersion!: Record<string, unknown>;

  @Column({ name: 'scope_resolution_evidence_ref', type: 'varchar', length: 255 })
  scopeResolutionEvidenceRef!: string;

  @Column({ name: 'legacy_customer_binding_id', type: 'int' })
  legacyCustomerBindingId!: number;

  @Column({ name: 'scope_resolved_at', type: 'datetime' })
  scopeResolvedAt!: Date;

  @Column({ name: 'vehicle_id', type: 'int' })
  vehicleId!: number;

  @Column({ name: 'lifecycle_status', type: 'varchar', length: 40 })
  lifecycleStatus!: RepairLifecycleStatus;

  @Column({ name: 'suspended_from_status', type: 'varchar', length: 40, nullable: true })
  suspendedFromStatus!: RepairLifecycleStatus | null;

  @Column({ name: 'suspended_at', type: 'datetime', nullable: true })
  suspendedAt!: Date | null;

  @Column({ name: 'suspended_by', type: 'int', nullable: true })
  suspendedBy!: number | null;

  @Column({ name: 'suspension_reason', type: 'varchar', length: 500, nullable: true })
  suspensionReason!: string | null;

  @Column({ name: 'resumed_at', type: 'datetime', nullable: true })
  resumedAt!: Date | null;

  @Column({ name: 'resumed_by', type: 'int', nullable: true })
  resumedBy!: number | null;

  @Column({ name: 'resume_reason', type: 'varchar', length: 500, nullable: true })
  resumeReason!: string | null;

  @Column({ name: 'active_plan_version', type: 'int', nullable: true })
  activePlanVersion!: number | null;

  @Column({ name: 'active_quote_version', type: 'int', nullable: true })
  activeQuoteVersion!: number | null;

  @Column({ name: 'active_explanation_version', type: 'int', nullable: true })
  activeExplanationVersion!: number | null;

  @Column({ name: 'customer_confirmation_state', type: 'varchar', length: 32, default: 'not_requested' })
  customerConfirmationState!: 'not_requested' | 'pending' | 'confirmed' | 'rejected' | 'expired';

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'knowledge_catalog_version', type: 'int', default: 1 })
  knowledgeCatalogVersion!: number;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'updated_by', type: 'int', nullable: true })
  updatedBy!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('repair_document_versions')
@Index('uq_repair_document_version', ['workOrderId', 'documentType', 'version'], { unique: true })
@Index('idx_repair_document_lookup', ['workOrderId', 'documentType', 'status'])
export class RepairDocumentVersion {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'work_order_id', type: 'int' })
  workOrderId!: number;

  @Column({ name: 'document_type', type: 'varchar', length: 40 })
  documentType!: RepairStoredDocumentType;

  @Column({ type: 'int' })
  version!: number;

  @Column({ type: 'varchar', length: 32, default: 'review_pending' })
  status!: 'draft' | 'review_pending' | 'approved' | 'superseded' | 'authorized' | 'rejected';

  @Column({ type: 'varchar', length: 500 })
  summary!: string;

  @Column({ type: 'json' })
  payload!: Record<string, unknown>;

  @Column({ name: 'source_references', type: 'json', nullable: true })
  sourceReferences!: Array<Record<string, unknown>> | null;

  @Column({ name: 'generated_by', type: 'varchar', length: 16, default: 'human' })
  generatedBy!: 'human' | 'ai';

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'reviewed_by', type: 'int', nullable: true })
  reviewedBy!: number | null;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true })
  reviewedAt!: Date | null;

  @Column({ name: 'review_note', type: 'varchar', length: 500, nullable: true })
  reviewNote!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

@Entity('repair_confirmation_requests')
@Index('uq_repair_confirmation_idempotency', ['requestIdempotencyKey'], { unique: true })
@Index('idx_repair_confirmation_work_order', ['workOrderId', 'status'])
export class RepairConfirmationRequest {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'work_order_id', type: 'int' })
  workOrderId!: number;

  @Column({ name: 'plan_version', type: 'int' })
  planVersion!: number;

  @Column({ name: 'quote_version', type: 'int' })
  quoteVersion!: number;

  @Column({ name: 'explanation_version', type: 'int' })
  explanationVersion!: number;

  @Column({ name: 'request_idempotency_key', type: 'varchar', length: 96 })
  requestIdempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64 })
  requestFingerprint!: string;

  @Column({ type: 'varchar', length: 24 })
  channel!: 'in_store' | 'phone' | 'wechat' | 'sms' | 'portal';

  @Column({ name: 'recipient_masked', type: 'varchar', length: 100 })
  recipientMasked!: string;

  @Column({ type: 'varchar', length: 24, default: 'pending' })
  status!: 'pending' | 'confirmed' | 'rejected' | 'expired' | 'cancelled';

  @Column({ type: 'varchar', length: 500, nullable: true })
  message!: string | null;

  @Column({ name: 'decision_evidence_ref', type: 'varchar', length: 255, nullable: true })
  decisionEvidenceRef!: string | null;

  @Column({ name: 'decision_note', type: 'varchar', length: 500, nullable: true })
  decisionNote!: string | null;

  @Column({ name: 'requested_by', type: 'int' })
  requestedBy!: number;

  @Column({ name: 'requested_at', type: 'datetime' })
  requestedAt!: Date;

  @Column({ name: 'decided_by', type: 'int', nullable: true })
  decidedBy!: number | null;

  @Column({ name: 'decided_at', type: 'datetime', nullable: true })
  decidedAt!: Date | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('repair_tasks')
@Index('idx_repair_tasks_work_order', ['workOrderId', 'status'])
export class RepairTask {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'work_order_id', type: 'int' })
  workOrderId!: number;

  @Column({ name: 'plan_version', type: 'int' })
  planVersion!: number;

  @Column({ name: 'plan_item_ref', type: 'varchar', length: 100 })
  planItemRef!: string;

  @Column({ name: 'rework_of_inspection_id', type: 'int', nullable: true })
  reworkOfInspectionId!: number | null;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ name: 'system_name', type: 'varchar', length: 100, nullable: true })
  system!: string | null;

  @Column({ name: 'technician_employee_id', type: 'int' })
  technicianEmployeeId!: number;

  @Column({ type: 'varchar', length: 24, default: 'pending' })
  status!: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';

  @Column({ name: 'safety_notes', type: 'varchar', length: 1000, nullable: true })
  safetyNotes!: string | null;

  @Column({ name: 'completion_evidence', type: 'json', nullable: true })
  completionEvidence!: Record<string, unknown> | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'updated_by', type: 'int', nullable: true })
  updatedBy!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('repair_labor_items')
@Index('idx_repair_labor_work_order', ['workOrderId', 'taskId'])
@Index('uq_repair_labor_task_code', ['workOrderId', 'taskId', 'laborCode'], { unique: true })
export class RepairLaborItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'work_order_id', type: 'int' })
  workOrderId!: number;

  @Column({ name: 'task_id', type: 'int' })
  taskId!: number;

  @Column({ name: 'technician_employee_id', type: 'int' })
  technicianEmployeeId!: number;

  @Column({ name: 'labor_code', type: 'varchar', length: 64 })
  laborCode!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ name: 'standard_hours', type: 'decimal', precision: 8, scale: 2 })
  standardHours!: string;

  @Column({ name: 'actual_hours', type: 'decimal', precision: 8, scale: 2 })
  actualHours!: string;

  @Column({ name: 'hourly_rate', type: 'decimal', precision: 12, scale: 2 })
  hourlyRate!: string;

  @Column({ name: 'quote_line_ref', type: 'varchar', length: 100 })
  quoteLineRef!: string;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

@Entity('repair_part_links')
@Index('uq_repair_part_link_material', ['workOrderId', 'workOrderMaterialId'], { unique: true })
export class RepairPartLink {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'work_order_id', type: 'int' })
  workOrderId!: number;

  @Column({ name: 'task_id', type: 'int' })
  taskId!: number;

  @Column({ name: 'work_order_material_id', type: 'int' })
  workOrderMaterialId!: number;

  @Column({ name: 'quote_line_ref', type: 'varchar', length: 100 })
  quoteLineRef!: string;

  @Column({ name: 'usage_note', type: 'varchar', length: 500, nullable: true })
  usageNote!: string | null;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

@Entity('repair_quality_inspections')
@Index('idx_repair_quality_work_order', ['workOrderId', 'createdAt'])
export class RepairQualityInspection {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'work_order_id', type: 'int' })
  workOrderId!: number;

  @Column({ type: 'varchar', length: 16 })
  result!: 'passed' | 'failed';

  @Column({ type: 'json' })
  checklist!: Array<Record<string, unknown>>;

  @Column({ name: 'road_test_result', type: 'varchar', length: 500, nullable: true })
  roadTestResult!: string | null;

  @Column({ name: 'rework_reason', type: 'varchar', length: 1000, nullable: true })
  reworkReason!: string | null;

  @Column({ name: 'rework_plan_item_refs', type: 'json', nullable: true })
  reworkPlanItemRefs!: string[] | null;

  @Column({ name: 'inspected_by_employee_id', type: 'int' })
  inspectedByEmployeeId!: number;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

@Entity('repair_delivery_records')
@Index('uq_repair_delivery_work_order', ['workOrderId'], { unique: true })
export class RepairDeliveryRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'work_order_id', type: 'int' })
  workOrderId!: number;

  @Column({ type: 'json' })
  checklist!: Array<Record<string, unknown>>;

  @Column({ name: 'plan_version', type: 'int' })
  planVersion!: number;

  @Column({ name: 'quote_version', type: 'int' })
  quoteVersion!: number;

  @Column({ name: 'explanation_version', type: 'int' })
  explanationVersion!: number;

  @Column({ name: 'finance_evidence_refs', type: 'json' })
  financeEvidenceRefs!: string[];

  @Column({ name: 'quote_total_snapshot', type: 'decimal', precision: 12, scale: 2 })
  quoteTotalSnapshot!: string;

  @Column({ name: 'finance_ready_amount_snapshot', type: 'decimal', precision: 12, scale: 2 })
  financeReadyAmountSnapshot!: string;

  @Column({ name: 'final_odometer_km', type: 'int' })
  finalOdometerKm!: number;

  @Column({ name: 'repair_summary', type: 'varchar', length: 1000 })
  repairSummary!: string;

  @Column({ name: 'unresolved_reminders', type: 'json' })
  unresolvedReminders!: string[];

  @Column({ name: 'customer_ack_evidence_ref', type: 'varchar', length: 255 })
  customerAckEvidenceRef!: string;

  @Column({ name: 'delivered_by_employee_id', type: 'int' })
  deliveredByEmployeeId!: number;

  @Column({ name: 'delivered_at', type: 'datetime' })
  deliveredAt!: Date;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

@Entity('repair_warranty_records')
@Index('idx_repair_warranty_work_order', ['workOrderId', 'status'])
export class RepairWarrantyRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'work_order_id', type: 'int' })
  workOrderId!: number;

  @Column({ name: 'warranty_type', type: 'varchar', length: 24 })
  warrantyType!: 'coverage' | 'claim';

  @Column({ name: 'coverage_snapshot', type: 'json' })
  coverageSnapshot!: Record<string, unknown>;

  @Column({ name: 'starts_at', type: 'datetime' })
  startsAt!: Date;

  @Column({ name: 'ends_at', type: 'datetime', nullable: true })
  endsAt!: Date | null;

  @Column({ type: 'varchar', length: 24, default: 'active' })
  status!: 'active' | 'claimed' | 'expired' | 'closed';

  @Column({ name: 'claim_note', type: 'varchar', length: 1000, nullable: true })
  claimNote!: string | null;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

@Entity('repair_knowledge_references')
@Index('idx_repair_knowledge_type_active', ['referenceType', 'active'])
export class RepairKnowledgeReference {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'reference_type', type: 'varchar', length: 24 })
  referenceType!: 'regulation' | 'manufacturer_manual' | 'service_bulletin' | 'case' | 'video';

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 500 })
  url!: string;

  @Column({ name: 'source_authority', type: 'varchar', length: 160 })
  sourceAuthority!: string;

  @Column({ name: 'authority_rank', type: 'int' })
  authorityRank!: number;

  @Column({ type: 'json' })
  tags!: string[];

  @Column({ type: 'json' })
  applicability!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 100, nullable: true })
  revision!: string | null;

  @Column({ name: 'effective_at', type: 'datetime', nullable: true })
  effectiveAt!: Date | null;

  @Column({ name: 'verified_at', type: 'datetime', nullable: true })
  verifiedAt!: Date | null;

  @Column({ name: 'valid_until', type: 'datetime', nullable: true })
  validUntil!: Date | null;

  @Column({ name: 'review_status', type: 'varchar', length: 32, default: 'review_pending' })
  reviewStatus!:
    | 'draft'
    | 'review_pending'
    | 'verified'
    | 'review_required'
    | 'withdrawn'
    | 'superseded';

  @Column({ name: 'review_reason', type: 'varchar', length: 500, nullable: true })
  reviewReason!: string | null;

  @Column({ name: 'risk_notice', type: 'varchar', length: 500, nullable: true })
  riskNotice!: string | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'reviewed_by', type: 'int', nullable: true })
  reviewedBy!: number | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('repair_ai_drafts')
@Index('uq_repair_ai_draft_idempotency', ['requestIdempotencyKey'], { unique: true })
@Index('idx_repair_ai_draft_work_order', ['workOrderId', 'draftType'])
export class RepairAiDraft {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'work_order_id', type: 'int' })
  workOrderId!: number;

  @Column({ name: 'draft_type', type: 'varchar', length: 40 })
  draftType!:
    | 'fault_assessment'
    | 'repair_plan'
    | 'customer_explanation'
    | 'consistency_review'
    | 'knowledge_recommendation';

  @Column({ name: 'request_idempotency_key', type: 'varchar', length: 96 })
  requestIdempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64 })
  requestFingerprint!: string;

  @Column({ name: 'input_snapshot', type: 'json' })
  inputSnapshot!: Record<string, unknown>;

  @Column({ name: 'output_snapshot', type: 'json' })
  outputSnapshot!: Record<string, unknown>;

  @Column({ name: 'knowledge_reference_ids', type: 'json', nullable: true })
  knowledgeReferenceIds!: number[] | null;

  @Column({ type: 'varchar', length: 24, default: 'draft' })
  status!: 'draft' | 'accepted' | 'rejected' | 'stale' | 'blocked' | 'superseded';

  @Column({ name: 'requires_human_review', type: 'boolean', default: true })
  requiresHumanReview!: boolean;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

export const REPAIR_SHOP_ENTITIES = [
  RepairVehicleProfile,
  RepairVehicleCustomerLink,
  RepairVehiclePlateHistory,
  RepairWorkOrderProfile,
  RepairDocumentVersion,
  RepairConfirmationRequest,
  RepairTask,
  RepairLaborItem,
  RepairPartLink,
  RepairQualityInspection,
  RepairDeliveryRecord,
  RepairWarrantyRecord,
  RepairKnowledgeReference,
  RepairAiDraft,
  ...REPAIR_SHOP_PROCUREMENT_ENTITIES,
] as const;
