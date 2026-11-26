import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AbcMappingConfidence } from '../../../shared/enums/abc-mapping-confidence.enum';

@Entity('abc_status_mappings')
export class AbcStatusMapping {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'source_system', type: 'varchar', length: 50 })
  sourceSystem!: string;

  @Column({ name: 'source_table', type: 'varchar', length: 100 })
  sourceTable!: string;

  @Column({ name: 'source_field', type: 'varchar', length: 100 })
  sourceField!: string;

  @Column({ name: 'source_value', type: 'varchar', length: 100 })
  sourceValue!: string;

  @Column({ name: 'target_domain', type: 'varchar', length: 50 })
  targetDomain!: string;

  @Column({ name: 'target_value', type: 'varchar', length: 100 })
  targetValue!: string;

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
