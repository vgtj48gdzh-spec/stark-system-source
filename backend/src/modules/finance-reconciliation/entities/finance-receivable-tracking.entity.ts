import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BankSmsTransaction } from '../../finance-bank-sms/entities/bank-sms-transaction.entity';
import { WorkOrder } from '../../work-orders/entities/work-order.entity';

export type FinanceReceivableTrackingStatus =
  | 'invoice_issued'
  | 'receivable_open'
  | 'partial_receipt'
  | 'fully_received'
  | 'cancelled'
  | 'written_off';

export type FinanceReceivableTrackingEvidenceStatus = 'candidate' | 'pending' | 'supported';

export type FinanceReceivableTrackingSourceType =
  | 'manual_invoice'
  | 'manual_receivable_evidence'
  | 'work_order_reference'
  | 'abc_sync_order';

@Entity('finance_receivable_tracking')
export class FinanceReceivableTracking {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId!: number;

  @Column({ name: 'source_type', type: 'varchar', length: 50, nullable: true })
  sourceType!: FinanceReceivableTrackingSourceType | null;

  @Column({ name: 'source_id', type: 'varchar', length: 100, nullable: true })
  sourceId!: string | null;

  @Column({ name: 'source_ref_no', type: 'varchar', length: 100, nullable: true })
  sourceRefNo!: string | null;

  @Column({ name: 'work_order_id', type: 'int', nullable: true })
  workOrderId!: number | null;

  @Column({ name: 'invoice_no', type: 'varchar', length: 100, nullable: true })
  invoiceNo!: string | null;

  @Column({ name: 'counterparty_name', type: 'varchar', length: 200 })
  counterpartyName!: string;

  @Column({ name: 'normalized_counterparty_name', type: 'varchar', length: 200, nullable: true })
  normalizedCounterpartyName!: string | null;

  @Column({ name: 'invoice_amount', type: 'decimal', precision: 12, scale: 2 })
  invoiceAmount!: string;

  @Column({ name: 'received_amount', type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  receivedAmount!: string;

  @Column({ name: 'outstanding_amount', type: 'decimal', precision: 12, scale: 2 })
  outstandingAmount!: string;

  @Column({
    name: 'current_status',
    type: 'enum',
    enum: ['invoice_issued', 'receivable_open', 'partial_receipt', 'fully_received', 'cancelled', 'written_off'],
    default: 'invoice_issued',
  })
  currentStatus!: FinanceReceivableTrackingStatus;

  @Column({
    name: 'evidence_status',
    type: 'enum',
    enum: ['candidate', 'pending', 'supported'],
    default: 'candidate',
  })
  evidenceStatus!: FinanceReceivableTrackingEvidenceStatus;

  @Column({ name: 'invoice_issued_at', type: 'datetime', nullable: true })
  invoiceIssuedAt!: Date | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate!: string | null;

  @Column({ name: 'last_bank_sms_transaction_id', type: 'int', nullable: true })
  lastBankSmsTransactionId!: number | null;

  @Column({ name: 'last_receipt_at', type: 'datetime', nullable: true })
  lastReceiptAt!: Date | null;

  @Column({ name: 'evidence_note', type: 'varchar', length: 500, nullable: true })
  evidenceNote!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => WorkOrder, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'work_order_id' })
  workOrder!: WorkOrder | null;

  @ManyToOne(() => BankSmsTransaction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'last_bank_sms_transaction_id' })
  lastBankSmsTransaction!: BankSmsTransaction | null;
}
