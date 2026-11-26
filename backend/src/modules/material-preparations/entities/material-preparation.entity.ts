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
import { PreparationBindStatus } from '../../../shared/enums/preparation-bind-status.enum';
import { InventoryTransaction } from '../../inventory-transactions/entities/inventory-transaction.entity';
import { Material } from '../../materials/entities/material.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { User } from '../../users/entities/user.entity';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';
import { WorkOrderMaterial } from '../../work-order-materials/entities/work-order-material.entity';
import { WorkOrder } from '../../work-orders/entities/work-order.entity';

@Entity('material_preparations')
export class MaterialPreparation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'preparation_no', type: 'varchar', length: 20, unique: true })
  preparationNo!: string;

  @Column({ name: 'material_id' })
  materialId!: number;

  @Column({ name: 'supplier_id', nullable: true })
  supplierId!: number | null;

  @Column({ name: 'warehouse_id', nullable: true })
  warehouseId!: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantity!: string;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2 })
  unitPrice!: string;

  @Column({ name: 'total_price', type: 'decimal', precision: 12, scale: 2 })
  totalPrice!: string;

  @Column({ name: 'linked_work_order_id', nullable: true })
  linkedWorkOrderId!: number | null;

  @Column({ name: 'responsible_user_id', nullable: true })
  responsibleUserId!: number | null;

  @Column({
    name: 'bind_status',
    type: 'enum',
    enum: PreparationBindStatus,
    default: PreparationBindStatus.UNBOUND,
  })
  bindStatus!: PreparationBindStatus;

  @Column({ name: 'prepared_at', type: 'datetime', nullable: true })
  preparedAt!: Date | null;

  @Column({ name: 'bind_deadline_at', type: 'datetime', nullable: true })
  bindDeadlineAt!: Date | null;

  @Column({ name: 'consumed_work_order_material_id', nullable: true })
  consumedWorkOrderMaterialId!: number | null;

  @Column({ name: 'consumed_at', type: 'datetime', nullable: true })
  consumedAt!: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'created_by' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Material, (material) => material.materialPreparations)
  @JoinColumn({ name: 'material_id' })
  material!: Material;

  @ManyToOne(() => Supplier, (supplier) => supplier.materialPreparations, { nullable: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier!: Supplier | null;

  @ManyToOne(() => Warehouse, (warehouse) => warehouse.materialPreparations, { nullable: true })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: Warehouse | null;

  @ManyToOne(() => WorkOrder, { nullable: true })
  @JoinColumn({ name: 'linked_work_order_id' })
  linkedWorkOrder!: WorkOrder | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'responsible_user_id' })
  responsibleUser!: User | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User;

  @ManyToOne(() => WorkOrderMaterial, { nullable: true })
  @JoinColumn({ name: 'consumed_work_order_material_id' })
  consumedByWorkOrderMaterial!: WorkOrderMaterial | null;

  @OneToMany(() => InventoryTransaction, (inventoryTransaction) => inventoryTransaction.relatedPreparation)
  inventoryTransactions!: InventoryTransaction[];

  @OneToMany(() => WorkOrderMaterial, (workOrderMaterial) => workOrderMaterial.preparation)
  workOrderMaterials!: WorkOrderMaterial[];
}
