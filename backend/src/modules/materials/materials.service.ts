import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { normalizeMoney } from '../../common/utils/decimal.util';
import { BIZ_SEQUENCE_CONFIG } from '../../shared/constants/biz-sequence.constant';
import { MaterialStatus } from '../../shared/enums/material-status.enum';
import { OperationLogAction } from '../../shared/enums/operation-log-action.enum';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { SequenceService } from '../sequence/sequence.service';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { Material } from './entities/material.entity';

@Injectable()
export class MaterialsService {
  constructor(
    @InjectRepository(Material)
    private readonly materialRepository: Repository<Material>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    private readonly dataSource: DataSource,
    private readonly sequenceService: SequenceService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async create(dto: CreateMaterialDto, currentUser: CurrentUser) {
    await this.ensureSupplierExists(dto.defaultSupplierId);

    return this.dataSource.transaction(async (manager) => {
      const materialNo = await this.sequenceService.generateBizNo(
        BIZ_SEQUENCE_CONFIG.MATERIAL.bizType,
        BIZ_SEQUENCE_CONFIG.MATERIAL.prefix,
        manager,
      );
      const repo = manager.getRepository(Material);
      const material = repo.create({
        materialNo,
        name: dto.name,
        specification: dto.specification ?? null,
        unit: dto.unit,
        category: dto.category ?? null,
        defaultSupplierId: dto.defaultSupplierId ?? null,
        defaultUnitPrice: normalizeMoney(dto.defaultUnitPrice ?? '0.00'),
        warningQuantity: normalizeMoney(dto.warningQuantity ?? '0.00'),
        status: dto.status ?? MaterialStatus.ACTIVE,
        remark: dto.remark ?? null,
        createdBy: currentUser.id,
      });

      const saved = await repo.save(material);
      await this.operationLogsService.create(
        {
          module: 'material',
          targetId: saved.id,
          action: OperationLogAction.CREATE_MATERIAL,
          operatorId: currentUser.id,
          detail: `创建材料 ${saved.materialNo}`,
        },
        manager,
      );

      return saved;
    });
  }

  async findAll() {
    return this.materialRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number) {
    const material = await this.materialRepository.findOne({ where: { id } });

    if (!material) {
      throw new NotFoundException('材料不存在');
    }

    return material;
  }

  async update(id: number, dto: UpdateMaterialDto, currentUser: CurrentUser) {
    const material = await this.findOne(id);
    await this.ensureSupplierExists(dto.defaultSupplierId);

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Material);
      const saved = await repo.save(
        repo.merge(material, {
          ...dto,
          defaultSupplierId:
            dto.defaultSupplierId === undefined
              ? material.defaultSupplierId
              : dto.defaultSupplierId,
          defaultUnitPrice:
            dto.defaultUnitPrice === undefined
              ? material.defaultUnitPrice
              : normalizeMoney(dto.defaultUnitPrice),
          warningQuantity:
            dto.warningQuantity === undefined
              ? material.warningQuantity
              : normalizeMoney(dto.warningQuantity),
        }),
      );

      await this.operationLogsService.create(
        {
          module: 'material',
          targetId: saved.id,
          action: OperationLogAction.UPDATE_MATERIAL,
          operatorId: currentUser.id,
          detail: `更新材料 ${saved.materialNo}`,
        },
        manager,
      );

      return saved;
    });
  }

  private async ensureSupplierExists(supplierId?: number) {
    if (!supplierId) {
      return;
    }

    const supplier = await this.supplierRepository.findOne({ where: { id: supplierId } });

    if (!supplier) {
      throw new NotFoundException('默认供应商不存在');
    }
  }
}
