import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InventoryTransactionType } from '../../../shared/enums/inventory-transaction-type.enum';
import { InventoryTransactionEntryKind } from '../../../shared/enums/inventory-transaction-entry-kind.enum';
import { ApprovalRequest } from '../../approval-requests/entities/approval-request.entity';
import { MaterialPreparation } from '../../material-preparations/entities/material-preparation.entity';
import { Material } from '../../materials/entities/material.entity';
import { User } from '../../users/entities/user.entity';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';
import { WorkOrderMaterial } from '../../work-order-materials/entities/work-order-material.entity';
import { WorkOrder } from '../../work-orders/entities/work-order.entity';

@Entity('inventory_transactions')
export class InventoryTransaction {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'transaction_no', type: 'varchar', length: 20, unique: true })
  transactionNo!: string;

  @Column({
    name: 'transaction_type',
    type: 'enum',
    enum: InventoryTransactionType,
  })
  transactionType!: InventoryTransactionType;

  @Column({
    name: 'entry_kind',
    type: 'enum',
    enum: InventoryTransactionEntryKind,
    default: InventoryTransactionEntryKind.ORIGINAL,
  })
  entryKind!: InventoryTransactionEntryKind;

  @Column({ name: 'request_idempotency_key', type: 'varchar', length: 96, nullable: true })
  requestIdempotencyKey!: string | null;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64, nullable: true })
  requestFingerprint!: string | null;

  @Column({ name: 'warehouse_id' })
  warehouseId!: number;

  @Column({ name: 'material_id' })
  materialId!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantity!: string;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2 })
  unitPrice!: string;

  @Column({ name: 'total_price', type: 'decimal', precision: 12, scale: 2 })
  totalPrice!: string;

  @Column({ name: 'related_work_order_id', nullable: true })
  relatedWorkOrderId!: number | null;

  @Column({ name: 'related_preparation_id', nullable: true })
  relatedPreparationId!: number | null;

  @Column({ name: 'related_work_order_material_id', nullable: true })
  relatedWorkOrderMaterialId!: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'source_transaction_id', nullable: true })
  sourceTransactionId!: number | null;

  @Column({ name: 'approval_request_id', nullable: true })
  approvalRequestId!: number | null;

  @Column({ name: 'adjustment_reason', type: 'varchar', length: 500, nullable: true })
  adjustmentReason!: string | null;

  @Column({ name: 'created_by' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Warehouse, (warehouse) => warehouse.inventoryTransactions)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: Warehouse;

  @ManyToOne(() => Material, (material) => material.inventoryTransactions)
  @JoinColumn({ name: 'material_id' })
  material!: Material;

  @ManyToOne(() => WorkOrder, { nullable: true })
  @JoinColumn({ name: 'related_work_order_id' })
  relatedWorkOrder!: WorkOrder | null;

  @ManyToOne(() => MaterialPreparation, { nullable: true })
  @JoinColumn({ name: 'related_preparation_id' })
  relatedPreparation!: MaterialPreparation | null;

  @ManyToOne(() => WorkOrderMaterial, (workOrderMaterial) => workOrderMaterial.inventoryTransactions, {
    nullable: true,
  })
  @JoinColumn({ name: 'related_work_order_material_id' })
  relatedWorkOrderMaterial!: WorkOrderMaterial | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User;

  @ManyToOne(() => InventoryTransaction, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'source_transaction_id' })
  sourceTransaction!: InventoryTransaction | null;

  @ManyToOne(() => ApprovalRequest, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'approval_request_id' })
  approvalRequest!: ApprovalRequest | null;
}
