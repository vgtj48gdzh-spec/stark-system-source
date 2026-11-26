import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type PointsRedemptionStatus =
  | 'drafted'
  | 'confirmed'
  | 'pending_fulfillment'
  | 'fulfilled_in_abc'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type PointsRedemptionOwnerType = 'customer' | 'employee';

@Entity('points_redemption_requests')
@Index('idx_points_redemption_status_owner', ['requestStatus', 'ownerType', 'ownerMobile'])
@Index('idx_points_redemption_redeemable_status', ['redeemableCode', 'requestStatus'])
export class PointsRedemptionRequest {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'request_status', type: 'varchar', length: 32, default: 'drafted' })
  requestStatus!: PointsRedemptionStatus;

  @Column({ name: 'owner_type', type: 'varchar', length: 32 })
  ownerType!: PointsRedemptionOwnerType;

  @Column({ name: 'owner_id', type: 'int', nullable: true })
  ownerId!: number | null;

  @Column({ name: 'owner_mobile', type: 'varchar', length: 32, nullable: true })
  ownerMobile!: string | null;

  @Column({ name: 'redeemable_type', type: 'varchar', length: 64 })
  redeemableType!: string;

  @Column({ name: 'redeemable_code', type: 'varchar', length: 100 })
  redeemableCode!: string;

  @Column({ name: 'redeemable_name', type: 'varchar', length: 150 })
  redeemableName!: string;

  @Column({ name: 'points_cost', type: 'decimal', precision: 18, scale: 2 })
  pointsCost!: string;

  @Column({ name: 'target_value', type: 'decimal', precision: 18, scale: 2, nullable: true })
  targetValue!: string | null;

  @Column({ name: 'provider_system', type: 'varchar', length: 64 })
  providerSystem!: string;

  @Column({ name: 'request_source', type: 'varchar', length: 32, default: 'manual' })
  requestSource!: string;

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

  @Column({ name: 'fulfilled_by', type: 'int', nullable: true })
  fulfilledBy!: number | null;

  @Column({ name: 'fulfilled_by_name', type: 'varchar', length: 100, nullable: true })
  fulfilledByName!: string | null;

  @Column({ name: 'fulfilled_at', type: 'datetime', nullable: true })
  fulfilledAt!: Date | null;

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

  @Column({ name: 'external_entity_id', type: 'varchar', length: 100, nullable: true })
  externalEntityId!: string | null;

  @Column({ name: 'external_no', type: 'varchar', length: 100, nullable: true })
  externalNo!: string | null;

  @Column({ name: 'reason_code', type: 'varchar', length: 100, nullable: true })
  reasonCode!: string | null;

  @Column({ name: 'remark', type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  @Column({ name: 'normalized_payload', type: 'json', nullable: true })
  normalizedPayload!: Record<string, unknown> | null;
}
