import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { BankSmsTransaction } from '../../finance-bank-sms/entities/bank-sms-transaction.entity';

@Entity('finance_reconciliation_link')
export class FinanceReconciliationLink {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'bank_sms_transaction_id' })
  bankSmsTransactionId!: number;

  @Column({
    name: 'link_type',
    type: 'enum',
    enum: [
      'receipt_item',
      'approval_order',
      'manual_fee',
      'wechat_settlement_batch',
      'internal_fund_flow',
      'receivable_tracking',
      'ignore',
    ],
  })
  linkType!:
    | 'receipt_item'
    | 'approval_order'
    | 'manual_fee'
    | 'wechat_settlement_batch'
    | 'internal_fund_flow'
    | 'receivable_tracking'
    | 'ignore';

  @Column({ name: 'link_id', type: 'int', nullable: true })
  linkId!: number | null;

  @Column({ name: 'suggested_amount', type: 'decimal', precision: 12, scale: 2 })
  suggestedAmount!: string;

  @Column({ name: 'confirmed_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  confirmedAmount!: string | null;

  @Column({
    type: 'enum',
    enum: ['suggested', 'confirmed', 'rejected'],
    default: 'suggested',
  })
  status!: 'suggested' | 'confirmed' | 'rejected';

  @Column({ name: 'confirmed_by', type: 'int', nullable: true })
  confirmedBy!: number | null;

  @Column({ name: 'confirmed_at', type: 'datetime', nullable: true })
  confirmedAt!: Date | null;

  @Column({ name: 'verification_code_required', type: 'tinyint', width: 1, default: 0 })
  verificationCodeRequired!: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(
    () => BankSmsTransaction,
    (bankSmsTransaction) => bankSmsTransaction.reconciliationLinks,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'bank_sms_transaction_id' })
  bankSmsTransaction!: BankSmsTransaction;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'confirmed_by' })
  confirmedByUser!: User | null;
}
