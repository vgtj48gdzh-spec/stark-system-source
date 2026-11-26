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
import { Employee } from '../../performance/entities/employee.entity';
import { EmployeeBenefitFundLink } from './employee-benefit-fund-link.entity';
import { EmployeeBenefitIssueItem } from './employee-benefit-issue-item.entity';

@Entity('employee_benefit_issues')
export class EmployeeBenefitIssue {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'issue_no', type: 'varchar', length: 50 })
  issueNo!: string;

  @Column({ name: 'employee_id', type: 'int' })
  employeeId!: number;

  @Column({ name: 'period_key', type: 'varchar', length: 20 })
  periodKey!: string;

  @Column({ name: 'issue_type', type: 'varchar', length: 30, default: 'monthly_benefit' })
  issueType!: string;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 18, scale: 2, default: '0.00' })
  totalAmount!: string;

  @Column({ name: 'total_item_count', type: 'int', default: 0 })
  totalItemCount!: number;

  @Column({ name: 'confirmed_flag', type: 'tinyint', width: 1, default: 0 })
  confirmedFlag!: boolean;

  @Column({ name: 'confirmed_by', type: 'int', nullable: true })
  confirmedBy!: number | null;

  @Column({ name: 'confirmed_at', type: 'datetime', nullable: true })
  confirmedAt!: Date | null;

  @Column({ name: 'issued_by', type: 'int', nullable: true })
  issuedBy!: number | null;

  @Column({ name: 'issued_at', type: 'datetime', nullable: true })
  issuedAt!: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'normalized_payload', type: 'json' })
  normalizedPayload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Employee, { nullable: false })
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @OneToMany(() => EmployeeBenefitIssueItem, (item) => item.issue)
  items!: EmployeeBenefitIssueItem[];

  @OneToMany(() => EmployeeBenefitFundLink, (fundLink) => fundLink.issue)
  fundLinks!: EmployeeBenefitFundLink[];
}
