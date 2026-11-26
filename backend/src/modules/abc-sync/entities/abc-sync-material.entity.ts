import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('abc_sync_materials')
export class AbcSyncMaterial {
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

  @Column({ name: 'material_name', type: 'varchar', length: 255, nullable: true })
  materialName!: string | null;

  @Column({ name: 'material_code', type: 'varchar', length: 100, nullable: true })
  materialCode!: string | null;

  @Column({ name: 'material_status_field', type: 'varchar', length: 100, nullable: true })
  materialStatusField!: string | null;

  @Column({ name: 'material_status_raw', type: 'varchar', length: 100, nullable: true })
  materialStatusRaw!: string | null;

  @Column({ name: 'material_status_standard', type: 'varchar', length: 100, nullable: true })
  materialStatusStandard!: string | null;

  @Column({ name: 'warning_quantity_field', type: 'varchar', length: 100, nullable: true })
  warningQuantityField!: string | null;

  @Column({ name: 'warning_quantity_raw', type: 'varchar', length: 100, nullable: true })
  warningQuantityRaw!: string | null;

  @Column({
    name: 'warning_quantity_standard',
    type: 'decimal',
    precision: 18,
    scale: 2,
    nullable: true,
  })
  warningQuantityStandard!: string | null;

  @Column({ name: 'quantity_unit', type: 'varchar', length: 30, nullable: true })
  quantityUnit!: string | null;

  @Column({ name: 'storage_amount_field', type: 'varchar', length: 100, nullable: true })
  storageAmountField!: string | null;

  @Column({ name: 'storage_amount_raw', type: 'varchar', length: 100, nullable: true })
  storageAmountRaw!: string | null;

  @Column({
    name: 'storage_amount_standard',
    type: 'decimal',
    precision: 18,
    scale: 2,
    nullable: true,
  })
  storageAmountStandard!: string | null;

  @Column({ name: 'storage_amount_unit', type: 'varchar', length: 30, nullable: true })
  storageAmountUnit!: string | null;

  @Column({ name: 'sale_amount_field', type: 'varchar', length: 100, nullable: true })
  saleAmountField!: string | null;

  @Column({ name: 'sale_amount_raw', type: 'varchar', length: 100, nullable: true })
  saleAmountRaw!: string | null;

  @Column({
    name: 'sale_amount_standard',
    type: 'decimal',
    precision: 18,
    scale: 2,
    nullable: true,
  })
  saleAmountStandard!: string | null;

  @Column({ name: 'sale_amount_unit', type: 'varchar', length: 30, nullable: true })
  saleAmountUnit!: string | null;

  @Column({ name: 'supplier_ids_raw', type: 'text', nullable: true })
  supplierIdsRaw!: string | null;

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
