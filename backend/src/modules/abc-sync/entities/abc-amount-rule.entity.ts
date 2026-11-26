import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AbcMappingConfidence } from '../../../shared/enums/abc-mapping-confidence.enum';

@Entity('abc_amount_rules')
export class AbcAmountRule {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'source_system', type: 'varchar', length: 50 })
  sourceSystem!: string;

  @Column({ name: 'source_table', type: 'varchar', length: 100 })
  sourceTable!: string;

  @Column({ name: 'amount_field', type: 'varchar', length: 100 })
  amountField!: string;

  @Column({ name: 'amount_unit_raw', type: 'varchar', length: 30 })
  amountUnitRaw!: string;

  @Column({ name: 'standard_unit', type: 'varchar', length: 30, default: 'yuan' })
  standardUnit!: string;

  @Column({ name: 'conversion_rate', type: 'decimal', precision: 18, scale: 6, default: 1 })
  conversionRate!: string;

  @Column({ name: 'standard_scale', type: 'int', default: 2 })
  standardScale!: number;

  @Column({
    name: 'confidence_level',
    type: 'varchar',
    length: 30,
    default: AbcMappingConfidence.INFERRED,
  })
  confidenceLevel!: AbcMappingConfidence;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
