import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlatformInteraction } from './platform-interaction.entity';

@Entity('interaction_links')
export class InteractionLink {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'interaction_id', type: 'int' })
  interactionId!: number;

  @Column({ name: 'linked_subject_type', type: 'varchar', length: 30 })
  linkedSubjectType!: string;

  @Column({ name: 'linked_subject_id', type: 'int' })
  linkedSubjectId!: number;

  @Column({ name: 'linked_business_type', type: 'varchar', length: 50, nullable: true })
  linkedBusinessType!: string | null;

  @Column({ name: 'linked_business_id', type: 'varchar', length: 100, nullable: true })
  linkedBusinessId!: string | null;

  @Column({ name: 'attribution_status', type: 'varchar', length: 20 })
  attributionStatus!: string;

  @Column({ name: 'attribution_confidence', type: 'decimal', precision: 5, scale: 4, default: '0.0000' })
  attributionConfidence!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => PlatformInteraction)
  @JoinColumn({ name: 'interaction_id' })
  interaction!: PlatformInteraction;
}
