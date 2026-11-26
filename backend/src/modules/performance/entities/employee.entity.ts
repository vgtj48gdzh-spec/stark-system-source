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
import { User } from '../../users/entities/user.entity';
import { EmployeeSourceBinding } from './employee-source-binding.entity';
import { PerformanceEvent } from './performance-event.entity';
import { PerformanceSummary } from './performance-summary.entity';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'name_remark', type: 'varchar', length: 120, nullable: true })
  nameRemark!: string | null;

  @Column({ name: 'linked_user_id', type: 'int', nullable: true })
  linkedUserId!: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  mobile!: string | null;

  @Column({ name: 'source_company_name', type: 'varchar', length: 120, nullable: true })
  sourceCompanyName!: string | null;

  @Column({ name: 'position_name', type: 'varchar', length: 120, nullable: true })
  positionName!: string | null;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'source_file_name', type: 'varchar', length: 255, nullable: true })
  sourceFileName!: string | null;

  @Column({ name: 'source_row_index', type: 'int', nullable: true })
  sourceRowIndex!: number | null;

  @Column({ name: 'imported_at', type: 'datetime', nullable: true })
  importedAt!: Date | null;

  @Column({ name: 'import_batch_no', type: 'varchar', length: 100, nullable: true })
  importBatchNo!: string | null;

  @Column({ name: 'import_conflict_note', type: 'varchar', length: 500, nullable: true })
  importConflictNote!: string | null;

  @Column({ name: 'referral_code', type: 'varchar', length: 64, nullable: true })
  referralCode!: string | null;

  @Column({ name: 'referred_by_employee_id', type: 'int', nullable: true })
  referredByEmployeeId!: number | null;

  @Column({ name: 'referred_by_employee_mobile', type: 'varchar', length: 20, nullable: true })
  referredByEmployeeMobile!: string | null;

  @Column({ name: 'referral_source_type', type: 'varchar', length: 50, nullable: true })
  referralSourceType!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'linked_user_id' })
  linkedUser!: User | null;

  @OneToMany(() => EmployeeSourceBinding, (binding) => binding.employee)
  sourceBindings!: EmployeeSourceBinding[];

  @OneToMany(() => PerformanceEvent, (event) => event.employee)
  performanceEvents!: PerformanceEvent[];

  @OneToMany(() => PerformanceSummary, (summary) => summary.employee)
  performanceSummaries!: PerformanceSummary[];
}
