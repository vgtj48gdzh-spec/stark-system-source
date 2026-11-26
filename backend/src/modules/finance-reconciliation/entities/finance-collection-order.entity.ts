import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BankSmsTransaction } from '../../finance-bank-sms/entities/bank-sms-transaction.entity';
import { WechatPaymentReceipt } from '../../finance-wechat/entities/wechat-payment-receipt.entity';
import { WechatSettlementBatch } from '../../finance-wechat/entities/wechat-settlement-batch.entity';
import { User } from '../../users/entities/user.entity';
import { WorkOrder } from '../../work-orders/entities/work-order.entity';
import { TemporaryServiceOrder } from '../../work-orders/entities/temporary-service-order.entity';
import { FinanceReconciliationLink } from './finance-reconciliation-link.entity';
import { FinanceCollectionConfirmationAuthority } from './finance-collection-confirmation-authority.entity';

export type FinanceCollectionOrderSourceType =
  | 'temporary_service'
  | 'work_order'
  | 'mini_program'
  | 'enterprise_wechat'
  | 'manual';

export type FinanceCollectionOrderBusinessType =
  | 'wash_single'
  | 'maintenance'
  | 'deposit'
  | 'other';

export type FinanceCollectionOrderPaymentChannel =
  | 'enterprise_wechat'
  | 'wechat'
  | 'alipay'
  | 'mini_program'
  | 'old_qr'
  | 'bank_transfer'
  | 'other';

export type FinanceCollectionOrderStatus =
  | 'created'
  | 'payment_pending'
  | 'paid_by_channel'
  | 'bank_settlement_pending'
  | 'bank_matched'
  | 'completed_candidate'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type FinanceCollectionOrderEvidenceStatus =
  | 'missing_payment_receipt'
  | 'missing_collection_order'
  | 'missing_customer_phone'
  | 'missing_bank_settlement'
  | 'unmatched_payment_candidate'
  | 'receipt_only'
  | 'bank_only'
  | 'matched_pending_confirmation'
  | 'confirmed';

export type FinanceCollectionOrderReconcileStatus =
  | 'pending'
  | 'partially_matched'
  | 'matched'
  | 'mismatch'
  | 'confirmed'
  | 'rejected';

@Entity('finance_collection_order')
export class FinanceCollectionOrder {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'collection_no', type: 'varchar', length: 32, unique: true })
  collectionNo!: string;

  @Column({ name: 'company_id', type: 'int' })
  companyId!: number;

  @Column({
    name: 'source_type',
    type: 'enum',
    enum: ['temporary_service', 'work_order', 'mini_program', 'enterprise_wechat', 'manual'],
  })
  sourceType!: FinanceCollectionOrderSourceType;

  @Column({ name: 'source_id', type: 'varchar', length: 100, nullable: true })
  sourceId!: string | null;

  @Column({
    name: 'business_type',
    type: 'enum',
    enum: ['wash_single', 'maintenance', 'deposit', 'other'],
  })
  businessType!: FinanceCollectionOrderBusinessType;

  @Column({ name: 'business_amount', type: 'decimal', precision: 12, scale: 2 })
  businessAmount!: string;

  @Column({ name: 'receipt_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  receiptAmount!: string | null;

  @Column({
    name: 'bank_received_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  bankReceivedAmount!: string | null;

  @Column({
    name: 'channel_fee_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  channelFeeAmount!: string | null;

  @Column({
    name: 'payment_channel',
    type: 'enum',
    // Keep the pre-0065 order byte-for-byte and append bank_transfer so the
    // migration and TypeORM metadata describe the same MySQL enum.
    enum: ['enterprise_wechat', 'wechat', 'alipay', 'mini_program', 'old_qr', 'other', 'bank_transfer'],
    nullable: true,
  })
  paymentChannel!: FinanceCollectionOrderPaymentChannel | null;

  @Column({ name: 'channel_trade_no', type: 'varchar', length: 100, nullable: true })
  channelTradeNo!: string | null;

  @Column({ name: 'payment_receipt_id', type: 'int', nullable: true })
  paymentReceiptId!: number | null;

  @Column({ name: 'settlement_batch_id', type: 'int', nullable: true })
  settlementBatchId!: number | null;

  @Column({ name: 'bank_transaction_id', type: 'int', nullable: true })
  bankTransactionId!: number | null;

  @Column({ name: 'reconciliation_link_id', type: 'int', nullable: true })
  reconciliationLinkId!: number | null;

  @Column({ name: 'work_order_id', type: 'int', nullable: true })
  workOrderId!: number | null;

  @Column({ name: 'temporary_service_order_id', type: 'int', nullable: true })
  temporaryServiceOrderId!: number | null;

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

  @Column({ name: 'responsible_employee_id', type: 'int', nullable: true })
  responsibleEmployeeId!: number | null;

  @Column({ name: 'source_employee_id', type: 'int', nullable: true })
  sourceEmployeeId!: number | null;

  @Column({
    name: 'evidence_status',
    type: 'enum',
    enum: [
      'missing_payment_receipt',
      'missing_collection_order',
      'missing_customer_phone',
      'missing_bank_settlement',
      'unmatched_payment_candidate',
      'receipt_only',
      'bank_only',
      'matched_pending_confirmation',
      'confirmed',
    ],
    default: 'missing_payment_receipt',
  })
  evidenceStatus!: FinanceCollectionOrderEvidenceStatus;

  @Column({
    name: 'reconcile_status',
    type: 'enum',
    enum: ['pending', 'partially_matched', 'matched', 'mismatch', 'confirmed', 'rejected'],
    default: 'pending',
  })
  reconcileStatus!: FinanceCollectionOrderReconcileStatus;

  @Column({
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
  status!: FinanceCollectionOrderStatus;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'confirmed_by', type: 'int', nullable: true })
  confirmedBy!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'confirmed_at', type: 'datetime', nullable: true })
  confirmedAt!: Date | null;

  @Column({ name: 'formal_confirmation_authority_id', type: 'int', nullable: true, unique: true })
  formalConfirmationAuthorityId!: number | null;

  @Column({ name: 'evidence_payload', type: 'json', nullable: true })
  evidencePayload!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @ManyToOne(() => WorkOrder, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'work_order_id' })
  workOrder!: WorkOrder | null;

  @ManyToOne(() => TemporaryServiceOrder, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'temporary_service_order_id' })
  temporaryServiceOrder!: TemporaryServiceOrder | null;

  @ManyToOne(() => WechatPaymentReceipt, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'payment_receipt_id' })
  paymentReceipt!: WechatPaymentReceipt | null;

  @ManyToOne(() => WechatSettlementBatch, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'settlement_batch_id' })
  settlementBatch!: WechatSettlementBatch | null;

  @ManyToOne(() => BankSmsTransaction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bank_transaction_id' })
  bankTransaction!: BankSmsTransaction | null;

  @ManyToOne(() => FinanceReconciliationLink, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reconciliation_link_id' })
  reconciliationLink!: FinanceReconciliationLink | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'confirmed_by' })
  confirmedByUser!: User | null;

  @OneToOne(
    () => FinanceCollectionConfirmationAuthority,
    (authority) => authority.collectionOrder,
    { nullable: true },
  )
  @JoinColumn({ name: 'formal_confirmation_authority_id' })
  formalConfirmationAuthority!: FinanceCollectionConfirmationAuthority | null;
}
