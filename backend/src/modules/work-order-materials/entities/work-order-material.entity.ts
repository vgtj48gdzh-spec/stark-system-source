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
import { WorkOrderMaterialSource } from '../../../shared/enums/work-order-material-source.enum';
import { InventoryTransaction } from '../../inventory-transactions/entities/inventory-transaction.entity';
import { MaterialPreparation } from '../../material-preparations/entities/material-preparation.entity';
import { Material } from '../../materials/entities/material.entity';
import { User } from '../../users/entities/user.entity';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';
import { WorkOrder } from '../../work-orders/entities/work-order.entity';

@Entity('work_order_materials')
export class WorkOrderMaterial {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'work_order_id' })
  workOrderId!: number;

  @Column({ name: 'request_idempotency_key', type: 'varchar', length: 96, nullable: true })
  requestIdempotencyKey!: string | null;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64, nullable: true })
  requestFingerprint!: string | null;

  @Column({ name: 'material_id' })
  materialId!: number;

  @Column({
    name: 'source_type',
    type: 'enum',
    enum: WorkOrderMaterialSource,
    default: WorkOrderMaterialSource.MANUAL,
  })
  sourceType!: WorkOrderMaterialSource;

  @Column({ name: 'warehouse_id', nullable: true })
  warehouseId!: number | null;

  @Column({ name: 'preparation_id', nullable: true })
  preparationId!: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantity!: string;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2 })
  unitPrice!: string;

  @Column({ name: 'total_price', type: 'decimal', precision: 12, scale: 2 })
  totalPrice!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'created_by' })
  createdBy!: number;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy!: number | null;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt!: Date | null;

  @Column({ name: 'deleted_by', nullable: true })
  deletedBy!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => WorkOrder, (workOrder) => workOrder.workOrderMaterials)
  @JoinColumn({ name: 'work_order_id' })
  workOrder!: WorkOrder;

  @ManyToOne(() => Material, (material) => material.workOrderMaterials)
  @JoinColumn({ name: 'material_id' })
  material!: Material;

  @ManyToOne(() => Warehouse, (warehouse) => warehouse.workOrderMaterials, { nullable: true })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: Warehouse | null;

  @ManyToOne(() => MaterialPreparation, (materialPreparation) => materialPreparation.workOrderMaterials, {
    nullable: true,
  })
  @JoinColumn({ name: 'preparation_id' })
  preparation!: MaterialPreparation | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedByUser!: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'deleted_by' })
  deletedByUser!: User | null;

  @OneToMany(
    () => InventoryTransaction,
    (inventoryTransaction) => inventoryTransaction.relatedWorkOrderMaterial,
  )
  inventoryTransactions!: InventoryTransaction[];
}
