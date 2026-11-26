import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FinanceReconciliationLink } from '../../finance-reconciliation/entities/finance-reconciliation-link.entity';
import { SmsMessageRaw } from '../../message-hub/entities/sms-message-raw.entity';

@Entity('bank_sms_transaction')
export class BankSmsTransaction {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'raw_sms_id', unique: true })
  rawSmsId!: number;

  @Column({ name: 'bank_name', type: 'varchar', length: 100 })
  bankName!: string;

  @Column({ type: 'varchar', length: 100 })
  sender!: string;

  @Column({ name: 'account_tail', type: 'varchar', length: 8 })
  accountTail!: string;

  @Column({ name: 'company_id', type: 'int', nullable: true })
  companyId!: number | null;

  @Column({ name: 'bank_business_date', type: 'datetime' })
  bankBusinessDate!: Date;

  @Column({ name: 'sms_received_at', type: 'datetime' })
  smsReceivedAt!: Date;

  @Column({ type: 'enum', enum: ['income', 'expense'] })
  direction!: 'income' | 'expense';

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({ name: 'balance_after', type: 'decimal', precision: 14, scale: 2 })
  balanceAfter!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  counterparty!: string | null;

  @Column({ type: 'varchar', length: 64, unique: true })
  fingerprint!: string;

  @Column({ name: 'parse_confidence', type: 'decimal', precision: 5, scale: 2, default: '0.00' })
  parseConfidence!: string;

  @Column({ name: 'parser_policy_version', type: 'varchar', length: 64, nullable: true })
  parserPolicyVersion!: string | null;

  @Column({ name: 'promotion_policy_version', type: 'varchar', length: 64, nullable: true })
  promotionPolicyVersion!: string | null;

  @Column({ name: 'promotion_admission_key', type: 'varchar', length: 64, nullable: true, unique: true })
  promotionAdmissionKey!: string | null;

  @Column({ name: 'promotion_evidence_fingerprint', type: 'char', length: 64, nullable: true })
  promotionEvidenceFingerprint!: string | null;

  @Column({
    name: 'promotion_decision_fingerprint',
    type: 'char',
    length: 64,
    nullable: true,
    unique: true,
  })
  promotionDecisionFingerprint!: string | null;

  @Column({ name: 'reconcile_status', type: 'varchar', length: 32, default: 'pending' })
  reconcileStatus!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => SmsMessageRaw)
  @JoinColumn({ name: 'raw_sms_id' })
  rawSms!: SmsMessageRaw;

  @OneToMany(
    () => FinanceReconciliationLink,
    (financeReconciliationLink) => financeReconciliationLink.bankSmsTransaction,
  )
  reconciliationLinks!: FinanceReconciliationLink[];
}
