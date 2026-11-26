import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type PointsRedeemableType = 'abc_shopping_card';

@Entity('points_redeemables')
@Index('idx_points_redeemable_type_enabled', ['redeemableType', 'enabledFlag'])
@Index('uq_points_redeemable_code', ['redeemableCode'], { unique: true })
export class PointsRedeemable {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'redeemable_type', type: 'varchar', length: 64 })
  redeemableType!: PointsRedeemableType;

  @Column({ name: 'redeemable_code', type: 'varchar', length: 100 })
  redeemableCode!: string;

  @Column({ name: 'redeemable_name', type: 'varchar', length: 150 })
  redeemableName!: string;

  @Column({ name: 'provider_system', type: 'varchar', length: 64 })
  providerSystem!: string;

  @Column({ name: 'provider_entity_id', type: 'varchar', length: 100, nullable: true })
  providerEntityId!: string | null;

  @Column({ name: 'points_cost', type: 'decimal', precision: 18, scale: 2, nullable: true })
  pointsCost!: string | null;

  @Column({ name: 'face_value', type: 'decimal', precision: 18, scale: 2, nullable: true })
  faceValue!: string | null;

  @Column({ name: 'enabled_flag', type: 'boolean', default: true })
  enabledFlag!: boolean;

  @Column({ name: 'scene_scope', type: 'varchar', length: 100, nullable: true })
  sceneScope!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  @Column({ name: 'normalized_payload', type: 'json', nullable: true })
  normalizedPayload!: Record<string, unknown> | null;
}
