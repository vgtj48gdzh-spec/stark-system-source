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
import { SupplierStatus } from '../../../shared/enums/supplier-status.enum';
import { Material } from '../../materials/entities/material.entity';
import { MaterialPreparation } from '../../material-preparations/entities/material-preparation.entity';
import { User } from '../../users/entities/user.entity';

@Entity('suppliers')
export class Supplier {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'supplier_no', type: 'varchar', length: 20, unique: true })
  supplierNo!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'contact_name', type: 'varchar', length: 50, nullable: true })
  contactName!: string | null;

  @Column({ name: 'contact_mobile', type: 'varchar', length: 20, nullable: true })
  contactMobile!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address!: string | null;

  @Column({
    type: 'enum',
    enum: SupplierStatus,
    default: SupplierStatus.ACTIVE,
  })
  status!: SupplierStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  score!: string | null;

  @Column({ name: 'created_by' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User;

  @OneToMany(() => Material, (material) => material.defaultSupplier)
  materials!: Material[];

  @OneToMany(() => MaterialPreparation, (materialPreparation) => materialPreparation.supplier)
  materialPreparations!: MaterialPreparation[];
}
