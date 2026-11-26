import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sequences')
@Unique('uniq_biz_type_biz_date', ['bizType', 'bizDate'])
export class Sequence {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'biz_type', type: 'varchar', length: 50 })
  bizType!: string;

  @Column({ name: 'biz_date', type: 'date' })
  bizDate!: string;

  @Column({ name: 'current_value', type: 'int', default: 0 })
  currentValue!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
