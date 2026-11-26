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
import { MaterialStatus } from '../../../shared/enums/material-status.enum';
import { InventoryTransaction } from '../../inventory-transactions/entities/inventory-transaction.entity';
import { MaterialPreparation } from '../../material-preparations/entities/material-preparation.entity';
import { MaterialStock } from '../../material-stocks/entities/material-stock.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { User } from '../../users/entities/user.entity';
import { WorkOrderMaterial } from '../../work-order-materials/entities/work-order-material.entity';

@Entity('materials')
export class Material {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'material_no', type: 'varchar', length: 20, unique: true })
  materialNo!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  specification!: string | null;

  @Column({ type: 'varchar', length: 30 })
  unit!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category!: string | null;

  @Column({ name: 'default_supplier_id', nullable: true })
  defaultSupplierId!: number | null;

  @Column({
    name: 'default_unit_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: '0.00',
  })
  defaultUnitPrice!: string;

  @Column({
    name: 'warning_quantity',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: '0.00',
  })
  warningQuantity!: string;

  @Column({
    type: 'enum',
    enum: MaterialStatus,
    default: MaterialStatus.ACTIVE,
  })
  status!: MaterialStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'created_by' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Supplier, (supplier) => supplier.materials, { nullable: true })
  @JoinColumn({ name: 'default_supplier_id' })
  defaultSupplier!: Supplier | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User;

  @OneToMany(() => MaterialStock, (materialStock) => materialStock.material)
  materialStocks!: MaterialStock[];

  @OneToMany(() => InventoryTransaction, (inventoryTransaction) => inventoryTransaction.material)
  inventoryTransactions!: InventoryTransaction[];

  @OneToMany(() => MaterialPreparation, (materialPreparation) => materialPreparation.material)
  materialPreparations!: MaterialPreparation[];

  @OneToMany(() => WorkOrderMaterial, (workOrderMaterial) => workOrderMaterial.material)
  workOrderMaterials!: WorkOrderMaterial[];
}
