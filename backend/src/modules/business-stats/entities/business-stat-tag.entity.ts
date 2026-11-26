import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BusinessStatDomain } from '../../../shared/enums/business-stat-domain.enum';
import { BusinessStatTagCode } from '../../../shared/enums/business-stat-tag-code.enum';
import { Employee } from '../../performance/entities/employee.entity';

@Entity('business_stat_tags')
export class BusinessStatTag {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'tag_code', type: 'enum', enum: BusinessStatTagCode })
  tagCode!: BusinessStatTagCode;

  @Column({ name: 'source_system', type: 'varchar', length: 50 })
  sourceSystem!: string;

  @Column({ name: 'source_table', type: 'varchar', length: 100 })
  sourceTable!: string;

  @Column({ name: 'source_id', type: 'varchar', length: 100 })
  sourceId!: string;

  @Column({ name: 'source_order_no', type: 'varchar', length: 100, nullable: true })
  sourceOrderNo!: string | null;

  @Column({ name: 'business_domain', type: 'enum', enum: BusinessStatDomain })
  businessDomain!: BusinessStatDomain;

  @Column({ name: 'merchant_id', type: 'int', nullable: true })
  merchantId!: number | null;

  @Column({ name: 'store_id', type: 'int', nullable: true })
  storeId!: number | null;

  @Column({ name: 'responsible_employee_id', type: 'int', nullable: true })
  responsibleEmployeeId!: number | null;

  @Column({ name: 'customer_id', type: 'varchar', length: 100, nullable: true })
  customerId!: string | null;

  @Column({ name: 'vehicle_type', type: 'varchar', length: 50, nullable: true })
  vehicleType!: string | null;

  @Column({ name: 'insurance_flag', type: 'tinyint', width: 1, default: 0 })
  insuranceFlag!: boolean;

  @Column({ name: 'occurred_at', type: 'datetime' })
  occurredAt!: Date;

  @Column({ name: 'period_key', type: 'varchar', length: 20 })
  periodKey!: string;

  @Column({ name: 'confirmed_flag', type: 'tinyint', width: 1, default: 0 })
  confirmedFlag!: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'normalized_payload', type: 'json' })
  normalizedPayload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'responsible_employee_id' })
  responsibleEmployee!: Employee | null;
}
