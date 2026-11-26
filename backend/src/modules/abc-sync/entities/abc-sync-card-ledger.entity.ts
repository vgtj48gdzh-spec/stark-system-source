import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('abc_sync_card_ledger')
export class AbcSyncCardLedger {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'source_system', type: 'varchar', length: 50 })
  sourceSystem!: string;

  @Column({ name: 'source_table', type: 'varchar', length: 100 })
  sourceTable!: string;

  @Column({ name: 'source_id', type: 'varchar', length: 100 })
  sourceId!: string;

  @Column({ name: 'source_order_no', type: 'varchar', length: 100, nullable: true })
  sourceOrderNo!: string | null;

  @Column({ name: 'source_updated_at', type: 'datetime', nullable: true })
  sourceUpdatedAt!: Date | null;

  @Column({ name: 'raw_record_id', type: 'int' })
  rawRecordId!: number;

  @Column({ name: 'raw_table_name', type: 'varchar', length: 100 })
  rawTableName!: string;

  @Column({ name: 'ledger_type_standard', type: 'varchar', length: 100, nullable: true })
  ledgerTypeStandard!: string | null;

  @Column({ name: 'status_field', type: 'varchar', length: 100, nullable: true })
  statusField!: string | null;

  @Column({ name: 'status_raw', type: 'varchar', length: 100, nullable: true })
  statusRaw!: string | null;

  @Column({ name: 'status_standard', type: 'varchar', length: 100, nullable: true })
  statusStandard!: string | null;

  @Column({ name: 'amount_field', type: 'varchar', length: 100, nullable: true })
  amountField!: string | null;

  @Column({ name: 'amount_raw', type: 'varchar', length: 100, nullable: true })
  amountRaw!: string | null;

  @Column({ name: 'amount_standard', type: 'decimal', precision: 18, scale: 2, nullable: true })
  amountStandard!: string | null;

  @Column({ name: 'amount_unit', type: 'varchar', length: 30, nullable: true })
  amountUnit!: string | null;

  @Column({ name: 'balance_field', type: 'varchar', length: 100, nullable: true })
  balanceField!: string | null;

  @Column({ name: 'balance_raw', type: 'varchar', length: 100, nullable: true })
  balanceRaw!: string | null;

  @Column({ name: 'balance_standard', type: 'decimal', precision: 18, scale: 2, nullable: true })
  balanceStandard!: string | null;

  @Column({ name: 'balance_unit', type: 'varchar', length: 30, nullable: true })
  balanceUnit!: string | null;

  @Column({ name: 'related_card_source_id', type: 'varchar', length: 100, nullable: true })
  relatedCardSourceId!: string | null;

  @Column({ name: 'related_order_no', type: 'varchar', length: 100, nullable: true })
  relatedOrderNo!: string | null;

  @Column({ name: 'source_user_id', type: 'varchar', length: 100, nullable: true })
  sourceUserId!: string | null;

  @Column({ name: 'source_merchant_id', type: 'varchar', length: 100, nullable: true })
  sourceMerchantId!: string | null;

  @Column({ name: 'mapping_confirmed', type: 'boolean', default: false })
  mappingConfirmed!: boolean;

  @Column({ name: 'mapping_notes', type: 'text', nullable: true })
  mappingNotes!: string | null;

  @Column({ name: 'normalized_payload', type: 'json' })
  normalizedPayload!: Record<string, unknown>;

  @Column({ name: 'synced_at', type: 'datetime' })
  syncedAt!: Date;

  @Column({ name: 'sync_batch_no', type: 'varchar', length: 64 })
  syncBatchNo!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
