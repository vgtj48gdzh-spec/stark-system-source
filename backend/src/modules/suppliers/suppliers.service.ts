import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { BIZ_SEQUENCE_CONFIG } from '../../shared/constants/biz-sequence.constant';
import { OperationLogAction } from '../../shared/enums/operation-log-action.enum';
import { SupplierStatus } from '../../shared/enums/supplier-status.enum';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { SequenceService } from '../sequence/sequence.service';
import { User } from '../users/entities/user.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Supplier } from './entities/supplier.entity';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    private readonly dataSource: DataSource,
    private readonly sequenceService: SequenceService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async create(dto: CreateSupplierDto, currentUser: CurrentUser) {
    return this.dataSource.transaction(async (manager) => {
      const supplierNo = await this.sequenceService.generateBizNo(
        BIZ_SEQUENCE_CONFIG.SUPPLIER.bizType,
        BIZ_SEQUENCE_CONFIG.SUPPLIER.prefix,
        manager,
      );
      const repo = manager.getRepository(Supplier);
      const supplier = repo.create({
        supplierNo,
        name: dto.name,
        contactName: dto.contactName ?? null,
        contactMobile: dto.contactMobile ?? null,
        address: dto.address ?? null,
        status: dto.status ?? SupplierStatus.ACTIVE,
        remark: dto.remark ?? null,
        score: dto.score ?? null,
        createdBy: currentUser.id,
      });

      const saved = await repo.save(supplier);
      await this.operationLogsService.create(
        {
          module: 'supplier',
          targetId: saved.id,
          action: OperationLogAction.CREATE_SUPPLIER,
          operatorId: currentUser.id,
          detail: `创建供应商 ${saved.supplierNo}`,
        },
        manager,
      );

      return saved;
    });
  }

  async findAll() {
    return this.supplierRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number) {
    const supplier = await this.supplierRepository.findOne({ where: { id } });

    if (!supplier) {
      throw new NotFoundException('供应商不存在');
    }

    return supplier;
  }

  async update(id: number, dto: UpdateSupplierDto, currentUser: CurrentUser) {
    const supplier = await this.findOne(id);

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Supplier);
      const saved = await repo.save(repo.merge(supplier, dto));

      await this.operationLogsService.create(
        {
          module: 'supplier',
          targetId: saved.id,
          action: OperationLogAction.UPDATE_SUPPLIER,
          operatorId: currentUser.id,
          detail: `更新供应商 ${saved.supplierNo}`,
        },
        manager,
      );

      return saved;
    });
  }
}
