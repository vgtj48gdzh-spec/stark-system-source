import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('abc_sync_warehouses')
export class AbcSyncWarehouse {
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

  @Column({ name: 'warehouse_source_id', type: 'varchar', length: 100, nullable: true })
  warehouseSourceId!: string | null;

  @Column({ name: 'warehouse_name', type: 'varchar', length: 255, nullable: true })
  warehouseName!: string | null;

  @Column({ name: 'warehouse_status_field', type: 'varchar', length: 100, nullable: true })
  warehouseStatusField!: string | null;

  @Column({ name: 'warehouse_status_raw', type: 'varchar', length: 100, nullable: true })
  warehouseStatusRaw!: string | null;

  @Column({ name: 'warehouse_status_standard', type: 'varchar', length: 100, nullable: true })
  warehouseStatusStandard!: string | null;

  @Column({ name: 'quantity_field', type: 'varchar', length: 100, nullable: true })
  quantityField!: string | null;

  @Column({ name: 'quantity_raw', type: 'varchar', length: 100, nullable: true })
  quantityRaw!: string | null;

  @Column({ name: 'quantity_standard', type: 'decimal', precision: 18, scale: 2, nullable: true })
  quantityStandard!: string | null;

  @Column({ name: 'quantity_unit', type: 'varchar', length: 30, nullable: true })
  quantityUnit!: string | null;

  @Column({ name: 'amount_field', type: 'varchar', length: 100, nullable: true })
  amountField!: string | null;

  @Column({ name: 'amount_raw', type: 'varchar', length: 100, nullable: true })
  amountRaw!: string | null;

  @Column({ name: 'amount_standard', type: 'decimal', precision: 18, scale: 2, nullable: true })
  amountStandard!: string | null;

  @Column({ name: 'amount_unit', type: 'varchar', length: 30, nullable: true })
  amountUnit!: string | null;

  @Column({ name: 'source_merchant_id', type: 'varchar', length: 100, nullable: true })
  sourceMerchantId!: string | null;

  @Column({ name: 'supplier_source_id', type: 'varchar', length: 100, nullable: true })
  supplierSourceId!: string | null;

  @Column({ name: 'material_source_id', type: 'varchar', length: 100, nullable: true })
  materialSourceId!: string | null;

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
