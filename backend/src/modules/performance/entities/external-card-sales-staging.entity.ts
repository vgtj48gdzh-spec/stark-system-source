import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('external_card_sales_staging')
export class ExternalCardSalesStaging {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'source_file_name', type: 'varchar', length: 255 })
  sourceFileName!: string;

  @Column({ name: 'source_sheet_name', type: 'varchar', length: 120, nullable: true })
  sourceSheetName!: string | null;

  @Column({ name: 'source_row_no', type: 'int' })
  sourceRowNo!: number;

  @Column({ name: 'sale_date', type: 'datetime', nullable: true })
  saleDate!: Date | null;

  @Column({ name: 'period_key', type: 'varchar', length: 7, nullable: true })
  periodKey!: string | null;

  @Column({ name: 'customer_mobile', type: 'varchar', length: 20, nullable: true })
  customerMobile!: string | null;

  @Column({ name: 'customer_name_alias', type: 'varchar', length: 120, nullable: true })
  customerNameAlias!: string | null;

  @Column({ name: 'car_plate', type: 'varchar', length: 30, nullable: true })
  carPlate!: string | null;

  @Column({ name: 'package_or_project_name', type: 'varchar', length: 255, nullable: true })
  packageOrProjectName!: string | null;

  @Column({ name: 'remark1', type: 'varchar', length: 500, nullable: true })
  remark1!: string | null;

  @Column({ name: 'remark2', type: 'varchar', length: 500, nullable: true })
  remark2!: string | null;

  @Column({ name: 'benefit_remark', type: 'varchar', length: 500, nullable: true })
  benefitRemark!: string | null;

  @Column({ name: 'amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  amount!: string | null;

  @Column({ name: 'normalized_mobile', type: 'varchar', length: 20, nullable: true })
  normalizedMobile!: string | null;

  @Column({ name: 'normalized_plate', type: 'varchar', length: 30, nullable: true })
  normalizedPlate!: string | null;

  @Column({ name: 'normalized_project_code', type: 'varchar', length: 120, nullable: true })
  normalizedProjectCode!: string | null;

  @Column({ name: 'import_batch_no', type: 'varchar', length: 40 })
  importBatchNo!: string;

  @Column({ name: 'imported_at', type: 'datetime', nullable: true })
  importedAt!: Date | null;

  @Column({ name: 'normalized_payload', type: 'json', nullable: true })
  normalizedPayload!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
