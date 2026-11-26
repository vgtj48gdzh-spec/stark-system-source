import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PerformanceEventSourceDomain } from '../../../shared/enums/performance-event-source-domain.enum';
import { User } from '../../users/entities/user.entity';
import { PerformanceEventClassification } from './performance-event-classification.entity';

@Entity('performance_rules')
export class PerformanceRule {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    name: 'source_domain',
    type: 'enum',
    enum: PerformanceEventSourceDomain,
  })
  sourceDomain!: PerformanceEventSourceDomain;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType!: string;

  @Column({ name: 'rule_code', type: 'varchar', length: 100 })
  ruleCode!: string;

  @Column({ name: 'rule_name', type: 'varchar', length: 100 })
  ruleName!: string;

  @Column({ name: 'classification_key', type: 'varchar', length: 100 })
  classificationKey!: string;

  @Column({ name: 'include_in_performance', type: 'boolean', default: true })
  includeInPerformance!: boolean;

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

  @Column({ name: 'requires_manual_confirmation', type: 'boolean', default: false })
  requiresManualConfirmation!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy!: number | null;

  @Column({ name: 'updated_by', type: 'int', nullable: true })
  updatedBy!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedByUser!: User | null;

  @OneToMany(() => PerformanceEventClassification, (classification) => classification.performanceRule)
  eventClassifications!: PerformanceEventClassification[];
}
