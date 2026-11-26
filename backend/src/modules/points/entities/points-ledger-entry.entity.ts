import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type PointsLedgerOwnerType = 'customer' | 'employee';
export type PointsLedgerChangeType = 'issue' | 'adjust' | 'revoke' | 'consume';

@Entity('points_ledger_entries')
@Index('idx_points_ledger_owner_lookup', ['ownerType', 'ownerId', 'ownerMobile'])
export class PointsLedgerEntry {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'owner_type', type: 'varchar', length: 32 })
  ownerType!: PointsLedgerOwnerType;

  @Column({ name: 'owner_id', type: 'int', nullable: true })
  ownerId!: number | null;

  @Column({ name: 'owner_mobile', type: 'varchar', length: 32, nullable: true })
  ownerMobile!: string | null;

  @Column({ name: 'merchant_id', type: 'int', nullable: true })
  merchantId!: number | null;

  @Column({ name: 'change_type', type: 'varchar', length: 32 })
  changeType!: PointsLedgerChangeType;

  @Column({ name: 'change_amount', type: 'decimal', precision: 18, scale: 2 })
  changeAmount!: string;

  @Column({ name: 'balance_after', type: 'decimal', precision: 18, scale: 2, nullable: true })
  balanceAfter!: string | null;

  @Column({ name: 'source_type', type: 'varchar', length: 64 })
  sourceType!: string;

  @Column({ name: 'source_id', type: 'varchar', length: 100, nullable: true })
  sourceId!: string | null;

  @Column({ name: 'source_no', type: 'varchar', length: 100, nullable: true })
  sourceNo!: string | null;

  @Column({ name: 'request_source', type: 'varchar', length: 32, nullable: true })
  requestSource!: string | null;

  @Column({ name: 'reason_code', type: 'varchar', length: 100, nullable: true })
  reasonCode!: string | null;

  @Column({ name: 'remark', type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'executed_by', type: 'int', nullable: true })
  executedBy!: number | null;

  @Column({ name: 'executed_by_name', type: 'varchar', length: 100, nullable: true })
  executedByName!: string | null;

  @Column({ name: 'executed_at', type: 'datetime', nullable: true })
  executedAt!: Date | null;

  @Column({ name: 'approved_by', type: 'int', nullable: true })
  approvedBy!: number | null;

  @Column({ name: 'approved_by_name', type: 'varchar', length: 100, nullable: true })
  approvedByName!: string | null;

  @Column({ name: 'approved_at', type: 'datetime', nullable: true })
  approvedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @Column({ name: 'normalized_payload', type: 'json', nullable: true })
  normalizedPayload!: Record<string, unknown> | null;
}
