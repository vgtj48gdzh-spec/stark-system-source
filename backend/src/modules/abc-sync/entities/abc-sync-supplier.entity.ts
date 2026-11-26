import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('abc_sync_suppliers')
export class AbcSyncSupplier {
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

  @Column({ name: 'supplier_name', type: 'varchar', length: 255, nullable: true })
  supplierName!: string | null;

  @Column({ name: 'supplier_status_field', type: 'varchar', length: 100, nullable: true })
  supplierStatusField!: string | null;

  @Column({ name: 'supplier_status_raw', type: 'varchar', length: 100, nullable: true })
  supplierStatusRaw!: string | null;

  @Column({ name: 'supplier_status_standard', type: 'varchar', length: 100, nullable: true })
  supplierStatusStandard!: string | null;

  @Column({ name: 'contact_name', type: 'varchar', length: 100, nullable: true })
  contactName!: string | null;

  @Column({ name: 'contact_mobile', type: 'varchar', length: 100, nullable: true })
  contactMobile!: string | null;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ name: 'company_site', type: 'varchar', length: 255, nullable: true })
  companySite!: string | null;

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
