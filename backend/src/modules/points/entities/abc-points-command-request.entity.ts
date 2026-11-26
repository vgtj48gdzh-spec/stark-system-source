import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type AbcPointsCommandType = 'issue_score' | 'adjust_score' | 'revoke_score';
export type AbcPointsCommandStatus =
  | 'drafted'
  | 'confirmed'
  | 'executed'
  | 'cancelled'
  | 'failed'
  | 'blocked';
export type AbcPointsCommandOwnerType = 'customer' | 'employee';

@Entity('abc_points_command_requests')
@Index('idx_abc_points_command_status_owner', ['commandStatus', 'ownerType', 'ownerMobile'])
export class AbcPointsCommandRequest {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'command_type', type: 'varchar', length: 32 })
  commandType!: AbcPointsCommandType;

  @Column({ name: 'command_status', type: 'varchar', length: 32, default: 'drafted' })
  commandStatus!: AbcPointsCommandStatus;

  @Column({ name: 'owner_type', type: 'varchar', length: 32 })
  ownerType!: AbcPointsCommandOwnerType;

  @Column({ name: 'owner_id', type: 'int', nullable: true })
  ownerId!: number | null;

  @Column({ name: 'owner_mobile', type: 'varchar', length: 32, nullable: true })
  ownerMobile!: string | null;

  @Column({ name: 'change_amount', type: 'decimal', precision: 18, scale: 2 })
  changeAmount!: string;

  @Column({ name: 'source_type', type: 'varchar', length: 64 })
  sourceType!: string;

  @Column({ name: 'request_source', type: 'varchar', length: 32, default: 'manual' })
  requestSource!: string;

  @Column({ name: 'reason_code', type: 'varchar', length: 100, nullable: true })
  reasonCode!: string | null;

  @Column({ name: 'remark', type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'requested_by', type: 'int', nullable: true })
  requestedBy!: number | null;

  @Column({ name: 'requested_by_name', type: 'varchar', length: 100, nullable: true })
  requestedByName!: string | null;

  @Column({ name: 'requested_at', type: 'datetime', nullable: true })
  requestedAt!: Date | null;

  @Column({ name: 'confirmed_by', type: 'int', nullable: true })
  confirmedBy!: number | null;

  @Column({ name: 'confirmed_by_name', type: 'varchar', length: 100, nullable: true })
  confirmedByName!: string | null;

  @Column({ name: 'confirmed_at', type: 'datetime', nullable: true })
  confirmedAt!: Date | null;

  @Column({ name: 'executed_by', type: 'int', nullable: true })
  executedBy!: number | null;

  @Column({ name: 'executed_by_name', type: 'varchar', length: 100, nullable: true })
  executedByName!: string | null;

  @Column({ name: 'executed_at', type: 'datetime', nullable: true })
  executedAt!: Date | null;

  @Column({ name: 'cancelled_by', type: 'int', nullable: true })
  cancelledBy!: number | null;

  @Column({ name: 'cancelled_by_name', type: 'varchar', length: 100, nullable: true })
  cancelledByName!: string | null;

  @Column({ name: 'cancelled_at', type: 'datetime', nullable: true })
  cancelledAt!: Date | null;

  @Column({ name: 'provider_key', type: 'varchar', length: 100, nullable: true })
  providerKey!: string | null;

  @Column({ name: 'source_action_id', type: 'varchar', length: 150, nullable: true })
  sourceActionId!: string | null;

  @Column({ name: 'thread_key', type: 'varchar', length: 150, nullable: true })
  threadKey!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  @Column({ name: 'normalized_payload', type: 'json', nullable: true })
  normalizedPayload!: Record<string, unknown> | null;
}
