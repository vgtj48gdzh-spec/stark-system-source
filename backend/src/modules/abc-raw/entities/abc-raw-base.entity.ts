import { Column, CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export abstract class AbcRawBaseEntity {
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

  @Column({ name: 'synced_at', type: 'datetime' })
  syncedAt!: Date;

  @Column({ name: 'sync_batch_no', type: 'varchar', length: 64 })
  syncBatchNo!: string;

  @Column({ name: 'raw_payload', type: 'json' })
  rawPayload!: Record<string, unknown>;

  @Column({ name: 'normalized_flag', type: 'boolean', default: false })
  normalizedFlag!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
