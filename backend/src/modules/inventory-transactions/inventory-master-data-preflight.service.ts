import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Material } from '../materials/entities/material.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { InventoryMasterDataImportPreflightDto } from './dto/inventory-master-data-import-preflight.dto';
import { assessInventoryMasterDataImportPreflight } from './utils/inventory-master-data-import-preflight.util';

@Injectable()
export class InventoryMasterDataPreflightService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(Material)
    private readonly materialRepository: Repository<Material>,
  ) {}

  async preflight(input: InventoryMasterDataImportPreflightDto) {
    const [warehouses, suppliers, materials] = await Promise.all([
      this.warehouseRepository.find({
        select: { id: true, code: true, name: true },
        order: { id: 'ASC' },
      }),
      this.supplierRepository.find({
        select: { id: true, name: true },
        order: { id: 'ASC' },
      }),
      this.materialRepository.find({
        select: { id: true, name: true, specification: true, unit: true },
        order: { id: 'ASC' },
      }),
    ]);

    return assessInventoryMasterDataImportPreflight(input, {
      warehouses,
      suppliers,
      materials,
    });
  }
}
