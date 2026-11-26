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
import { WarehouseStatus } from '../../../shared/enums/warehouse-status.enum';
import { InventoryTransaction } from '../../inventory-transactions/entities/inventory-transaction.entity';
import { MaterialPreparation } from '../../material-preparations/entities/material-preparation.entity';
import { MaterialStock } from '../../material-stocks/entities/material-stock.entity';
import { User } from '../../users/entities/user.entity';
import { WorkOrderMaterial } from '../../work-order-materials/entities/work-order-material.entity';

@Entity('warehouses')
export class Warehouse {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'warehouse_no', type: 'varchar', length: 20, unique: true })
  warehouseNo!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  code!: string;

  @Column({ name: 'manager_user_id', nullable: true })
  managerUserId!: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address!: string | null;

  @Column({
    type: 'enum',
    enum: WarehouseStatus,
    default: WarehouseStatus.ACTIVE,
  })
  status!: WarehouseStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'created_by' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'manager_user_id' })
  managerUser!: User | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User;

  @OneToMany(() => MaterialStock, (materialStock) => materialStock.warehouse)
  materialStocks!: MaterialStock[];

  @OneToMany(() => InventoryTransaction, (inventoryTransaction) => inventoryTransaction.warehouse)
  inventoryTransactions!: InventoryTransaction[];

  @OneToMany(() => MaterialPreparation, (materialPreparation) => materialPreparation.warehouse)
  materialPreparations!: MaterialPreparation[];

  @OneToMany(() => WorkOrderMaterial, (workOrderMaterial) => workOrderMaterial.warehouse)
  workOrderMaterials!: WorkOrderMaterial[];
}
