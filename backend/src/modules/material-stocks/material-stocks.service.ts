import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaterialStock } from './entities/material-stock.entity';

@Injectable()
export class MaterialStocksService {
  constructor(
    @InjectRepository(MaterialStock)
    private readonly materialStockRepository: Repository<MaterialStock>,
  ) {}

  async findAll(warehouseId?: number, materialId?: number) {
    return this.materialStockRepository.find({
      where: {
        ...(warehouseId ? { warehouseId } : {}),
        ...(materialId ? { materialId } : {}),
      },
      order: { updatedAt: 'DESC' },
    });
  }
}
