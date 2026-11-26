import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Material } from '../../materials/entities/material.entity';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';

@Entity('material_stocks')
export class MaterialStock {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'warehouse_id' })
  warehouseId!: number;

  @Column({ name: 'material_id' })
  materialId!: number;

  @Column({
    name: 'current_quantity',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: '0.00',
  })
  currentQuantity!: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Warehouse, (warehouse) => warehouse.materialStocks)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: Warehouse;

  @ManyToOne(() => Material, (material) => material.materialStocks)
  @JoinColumn({ name: 'material_id' })
  material!: Material;
}
