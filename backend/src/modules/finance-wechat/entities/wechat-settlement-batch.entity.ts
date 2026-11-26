import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('wechat_settlement_batch')
export class WechatSettlementBatch {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId!: number;

  @Column({ name: 'merchant_id', type: 'varchar', length: 100 })
  merchantId!: string;

  @Column({ name: 'settlement_date', type: 'date' })
  settlementDate!: string;

  @Column({ name: 'batch_no', type: 'varchar', length: 100, nullable: true })
  batchNo!: string | null;

  @Column({ name: 'gross_amount', type: 'decimal', precision: 12, scale: 2 })
  grossAmount!: string;

  @Column({ name: 'fee_amount', type: 'decimal', precision: 12, scale: 2 })
  feeAmount!: string;

  @Column({ name: 'net_amount', type: 'decimal', precision: 12, scale: 2 })
  netAmount!: string;

  @Column({ name: 'receipt_count', type: 'int' })
  receiptCount!: number;

  @Column({ name: 'bank_account_registry_id', type: 'int', nullable: true })
  bankAccountRegistryId!: number | null;

  @Column({ name: 'bank_sms_transaction_id', type: 'int', nullable: true })
  bankSmsTransactionId!: number | null;

  @Column({ name: 'bank_match_suggestion_version', type: 'int', unsigned: true, default: 0 })
  bankMatchSuggestionVersion!: number;

  @Column({ name: 'bank_match_suggestion_bank_sms_transaction_id', type: 'int', nullable: true })
  bankMatchSuggestionBankSmsTransactionId!: number | null;

  @Column({ name: 'bank_match_suggestion_registry_id', type: 'int', nullable: true })
  bankMatchSuggestionRegistryId!: number | null;

  @Column({ name: 'bank_match_suggestion_registry_updated_at', type: 'datetime', precision: 6, nullable: true })
  bankMatchSuggestionRegistryUpdatedAt!: Date | null;

  @Column({ name: 'bank_match_suggestion_snapshot_hash', type: 'char', length: 64, nullable: true })
  bankMatchSuggestionSnapshotHash!: string | null;

  @Column({ name: 'bank_match_suggested_at', type: 'datetime', precision: 6, nullable: true })
  bankMatchSuggestedAt!: Date | null;

  @Column({
    name: 'match_status',
    type: 'enum',
    enum: ['pending_bank_match', 'suggested', 'confirmed', 'exception'],
    default: 'pending_bank_match',
  })
  matchStatus!: 'pending_bank_match' | 'suggested' | 'confirmed' | 'exception';

  @Column({
    name: 'source_type',
    type: 'enum',
    enum: ['api', 'manual_import'],
    default: 'manual_import',
  })
  sourceType!: 'api' | 'manual_import';

  @Column({ name: 'raw_payload', type: 'json', nullable: true })
  rawPayload!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
