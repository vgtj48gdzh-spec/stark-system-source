import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Employee } from '../../performance/entities/employee.entity';
import { EmployeeBenefitIssueItem } from './employee-benefit-issue-item.entity';
import { EmployeeBenefitIssue } from './employee-benefit-issue.entity';

@Entity('employee_benefit_fund_links')
export class EmployeeBenefitFundLink {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'issue_id', type: 'int' })
  issueId!: number;

  @Column({ name: 'issue_item_id', type: 'int' })
  issueItemId!: number;

  @Column({ name: 'employee_id', type: 'int' })
  employeeId!: number;

  @Column({ name: 'fund_link_type', type: 'varchar', length: 30 })
  fundLinkType!: string;

  @Column({ name: 'amount_standard', type: 'decimal', precision: 18, scale: 2, default: '0.00' })
  amountStandard!: string;

  @Column({ name: 'linked_period_key', type: 'varchar', length: 20, nullable: true })
  linkedPeriodKey!: string | null;

  @Column({ name: 'linked_summary_type', type: 'varchar', length: 50, nullable: true })
  linkedSummaryType!: string | null;

  @Column({ name: 'linked_summary_id', type: 'varchar', length: 100, nullable: true })
  linkedSummaryId!: string | null;

  @Column({ name: 'source_system', type: 'varchar', length: 50, nullable: true })
  sourceSystem!: string | null;

  @Column({ name: 'source_table', type: 'varchar', length: 100, nullable: true })
  sourceTable!: string | null;

  @Column({ name: 'source_id', type: 'varchar', length: 100, nullable: true })
  sourceId!: string | null;

  @Column({ name: 'source_order_no', type: 'varchar', length: 100, nullable: true })
  sourceOrderNo!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'linked' })
  status!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'normalized_payload', type: 'json' })
  normalizedPayload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => EmployeeBenefitIssue, (issue) => issue.fundLinks, { nullable: false })
  @JoinColumn({ name: 'issue_id' })
  issue!: EmployeeBenefitIssue;

  @ManyToOne(() => EmployeeBenefitIssueItem, (issueItem) => issueItem.fundLinks, {
    nullable: false,
  })
  @JoinColumn({ name: 'issue_item_id' })
  issueItem!: EmployeeBenefitIssueItem;

  @ManyToOne(() => Employee, { nullable: false })
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;
}
