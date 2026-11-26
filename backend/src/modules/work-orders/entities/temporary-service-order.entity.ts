import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { WorkOrder } from './work-order.entity';

export type TemporaryServiceType = 'wash_single' | 'inspection' | 'simple_repair' | 'other';

export type TemporaryServiceSourceChannel =
  | 'enterprise_wechat'
  | 'wechat'
  | 'mini_program'
  | 'manual'
  | 'other';

export type TemporaryServiceOrderStatus =
  | 'created'
  | 'waiting_payment'
  | 'paid'
  | 'service_done'
  | 'converted_to_work_order'
  | 'cancelled';

export type TemporaryServicePaymentStatus =
  | 'created'
  | 'payment_pending'
  | 'paid_by_channel'
  | 'bank_settlement_pending'
  | 'bank_matched'
  | 'completed_candidate'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type TemporaryServiceEvidenceStatus =
  | 'missing_payment_receipt'
  | 'missing_customer_phone'
  | 'receipt_only'
  | 'bank_only'
  | 'matched_pending_confirmation'
  | 'confirmed';

@Entity('temporary_service_order')
export class TemporaryServiceOrder {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'temporary_service_no', type: 'varchar', length: 32, unique: true })
  temporaryServiceNo!: string;

  @Column({ name: 'company_id', type: 'int' })
  companyId!: number;

  @Column({
    name: 'service_type',
    type: 'enum',
    enum: ['wash_single', 'inspection', 'simple_repair', 'other'],
  })
  serviceType!: TemporaryServiceType;

  @Column({ name: 'service_title', type: 'varchar', length: 120 })
  serviceTitle!: string;

  @Column({ name: 'service_amount', type: 'decimal', precision: 12, scale: 2 })
  serviceAmount!: string;

  @Column({ name: 'customer_id', type: 'varchar', length: 100, nullable: true })
  customerId!: string | null;

  @Column({ name: 'customer_phone', type: 'varchar', length: 20, nullable: true })
  customerPhone!: string | null;

  @Column({ name: 'customer_name', type: 'varchar', length: 120, nullable: true })
  customerName!: string | null;

  @Column({ name: 'temporary_customer_flag', type: 'tinyint', width: 1, default: 0 })
  temporaryCustomerFlag!: boolean;

  @Column({ name: 'missing_customer_phone_flag', type: 'tinyint', width: 1, default: 0 })
  missingCustomerPhoneFlag!: boolean;

  @Column({ name: 'vehicle_plate', type: 'varchar', length: 30, nullable: true })
  vehiclePlate!: string | null;

  @Column({
    name: 'source_channel',
    type: 'enum',
    enum: ['enterprise_wechat', 'wechat', 'mini_program', 'manual', 'other'],
    nullable: true,
  })
  sourceChannel!: TemporaryServiceSourceChannel | null;

  @Column({ name: 'responsible_employee_id', type: 'int', nullable: true })
  responsibleEmployeeId!: number | null;

  @Column({ name: 'related_work_order_id', type: 'int', nullable: true })
  relatedWorkOrderId!: number | null;

  @Column({ name: 'collection_order_id', type: 'int', nullable: true })
  collectionOrderId!: number | null;

  @Column({
    type: 'enum',
    enum: [
      'created',
      'waiting_payment',
      'paid',
      'service_done',
      'converted_to_work_order',
      'cancelled',
    ],
    default: 'created',
  })
  status!: TemporaryServiceOrderStatus;

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: [
      'created',
      'payment_pending',
      'paid_by_channel',
      'bank_settlement_pending',
      'bank_matched',
      'completed_candidate',
      'completed',
      'cancelled',
      'refunded',
    ],
    default: 'created',
  })
  paymentStatus!: TemporaryServicePaymentStatus;

  @Column({
    name: 'evidence_status',
    type: 'enum',
    enum: [
      'missing_payment_receipt',
      'missing_customer_phone',
      'receipt_only',
      'bank_only',
      'matched_pending_confirmation',
      'confirmed',
    ],
    default: 'missing_payment_receipt',
  })
  evidenceStatus!: TemporaryServiceEvidenceStatus;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'evidence_payload', type: 'json', nullable: true })
  evidencePayload!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @ManyToOne(() => WorkOrder, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'related_work_order_id' })
  relatedWorkOrder!: WorkOrder | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'responsible_employee_id' })
  responsibleEmployee!: User | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User;
}
