import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { BankAccountRegistry } from '../../finance-bank-account/entities/bank-account-registry.entity';
import { BankSmsTransaction } from '../../finance-bank-sms/entities/bank-sms-transaction.entity';

export const FINANCE_INTERNAL_FUND_FLOW_TYPES = [
  'loan_interest_expense',
  'internal_transfer_in',
  'internal_transfer_out',
  'loan_in',
  'loan_out',
  'repayment_in',
  'repayment_out',
] as const;

export type FinanceInternalFundFlowType = (typeof FINANCE_INTERNAL_FUND_FLOW_TYPES)[number];
export type FinanceInternalFundFlowStatus = 'draft' | 'approved' | 'confirmed' | 'cancelled';

@Entity('finance_internal_fund_flow')
export class FinanceInternalFundFlow {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId!: number;

  @Column({ name: 'bank_account_registry_id', type: 'int' })
  bankAccountRegistryId!: number;

  @Column({
    name: 'flow_type',
    type: 'enum',
    enum: FINANCE_INTERNAL_FUND_FLOW_TYPES,
  })
  flowType!: FinanceInternalFundFlowType;

  @Column({
    name: 'current_status',
    type: 'enum',
    enum: ['draft', 'approved', 'confirmed', 'cancelled'],
    default: 'draft',
  })
  currentStatus!: FinanceInternalFundFlowStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({ name: 'business_date', type: 'date' })
  businessDate!: string;

  @Column({ name: 'counterparty_name', type: 'varchar', length: 200, nullable: true })
  counterpartyName!: string | null;

  @Column({ name: 'normalized_counterparty_name', type: 'varchar', length: 200, nullable: true })
  normalizedCounterpartyName!: string | null;

  @Column({ name: 'evidence_note', type: 'varchar', length: 500, nullable: true })
  evidenceNote!: string | null;

  @Column({ name: 'linked_bank_sms_transaction_id', type: 'int', nullable: true })
  linkedBankSmsTransactionId!: number | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy!: number | null;

  @Column({ name: 'approved_by', type: 'int', nullable: true })
  approvedBy!: number | null;

  @Column({ name: 'approved_at', type: 'datetime', nullable: true })
  approvedAt!: Date | null;

  @Column({ name: 'confirmed_by', type: 'int', nullable: true })
  confirmedBy!: number | null;

  @Column({ name: 'confirmed_at', type: 'datetime', nullable: true })
  confirmedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => BankAccountRegistry, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'bank_account_registry_id' })
  bankAccountRegistry!: BankAccountRegistry;

  @ManyToOne(() => BankSmsTransaction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'linked_bank_sms_transaction_id' })
  linkedBankSmsTransaction!: BankSmsTransaction | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedByUser!: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'confirmed_by' })
  confirmedByUser!: User | null;
}
