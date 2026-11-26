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
import { EmployeeBenefitCardRecord } from './employee-benefit-card-record.entity';
import { EmployeeBenefitFundLink } from './employee-benefit-fund-link.entity';
import { EmployeeBenefitIssue } from './employee-benefit-issue.entity';

@Entity('employee_benefit_issue_items')
export class EmployeeBenefitIssueItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'issue_id', type: 'int' })
  issueId!: number;

  @Column({ name: 'item_type', type: 'varchar', length: 30 })
  itemType!: string;

  @Column({ name: 'item_name', type: 'varchar', length: 100 })
  itemName!: string;

  @Column({ name: 'amount_standard', type: 'decimal', precision: 18, scale: 2, default: '0.00' })
  amountStandard!: string;

  @Column({
    name: 'quantity_standard',
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: '0.00',
  })
  quantityStandard!: string;

  @Column({ name: 'validity_days', type: 'int', default: 180 })
  validityDays!: number;

  @Column({ name: 'effective_at', type: 'datetime', nullable: true })
  effectiveAt!: Date | null;

  @Column({ name: 'expires_at', type: 'datetime', nullable: true })
  expiresAt!: Date | null;

  @Column({ name: 'source_system', type: 'varchar', length: 50, nullable: true })
  sourceSystem!: string | null;

  @Column({ name: 'source_table', type: 'varchar', length: 100, nullable: true })
  sourceTable!: string | null;

  @Column({ name: 'source_id', type: 'varchar', length: 100, nullable: true })
  sourceId!: string | null;

  @Column({ name: 'source_order_no', type: 'varchar', length: 100, nullable: true })
  sourceOrderNo!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'normalized_payload', type: 'json' })
  normalizedPayload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => EmployeeBenefitIssue, (issue) => issue.items, { nullable: false })
  @JoinColumn({ name: 'issue_id' })
  issue!: EmployeeBenefitIssue;

  @OneToMany(() => EmployeeBenefitCardRecord, (cardRecord) => cardRecord.issueItem)
  cardRecords!: EmployeeBenefitCardRecord[];

  @OneToMany(() => EmployeeBenefitFundLink, (fundLink) => fundLink.issueItem)
  fundLinks!: EmployeeBenefitFundLink[];
}
