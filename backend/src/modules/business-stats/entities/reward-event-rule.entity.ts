import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BusinessStatDomain } from '../../../shared/enums/business-stat-domain.enum';
import { BusinessStatTagCode } from '../../../shared/enums/business-stat-tag-code.enum';
import { RewardEventType } from '../../../shared/enums/reward-event-type.enum';

@Entity('reward_event_rules')
export class RewardEventRule {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'rule_code', type: 'varchar', length: 100 })
  ruleCode!: string;

  @Column({ name: 'rule_name', type: 'varchar', length: 100 })
  ruleName!: string;

  @Column({ name: 'event_type', type: 'enum', enum: RewardEventType })
  eventType!: RewardEventType;

  @Column({ name: 'business_domain', type: 'enum', enum: BusinessStatDomain })
  businessDomain!: BusinessStatDomain;

  @Column({ name: 'required_tag_code', type: 'enum', enum: BusinessStatTagCode, nullable: true })
  requiredTagCode!: BusinessStatTagCode | null;

  @Column({ name: 'vehicle_type', type: 'varchar', length: 50, nullable: true })
  vehicleType!: string | null;

  @Column({ name: 'insurance_flag', type: 'tinyint', width: 1, nullable: true })
  insuranceFlag!: boolean | null;

  @Column({ name: 'reward_enabled', type: 'tinyint', width: 1, default: 1 })
  rewardEnabled!: boolean;

  @Column({ name: 'requires_manual_confirmation', type: 'tinyint', width: 1, default: 0 })
  requiresManualConfirmation!: boolean;

  @Column({ name: 'default_weight', type: 'decimal', precision: 10, scale: 2, default: '1.00' })
  defaultWeight!: string;

  @Column({
    name: 'default_coefficient',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: '1.00',
  })
  defaultCoefficient!: string;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
