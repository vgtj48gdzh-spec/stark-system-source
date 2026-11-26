import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { BIZ_SEQUENCE_CONFIG } from '../../shared/constants/biz-sequence.constant';
import { OperationLogAction } from '../../shared/enums/operation-log-action.enum';
import { WarehouseStatus } from '../../shared/enums/warehouse-status.enum';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { SequenceService } from '../sequence/sequence.service';
import { User } from '../users/entities/user.entity';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { Warehouse } from './entities/warehouse.entity';

@Injectable()
export class WarehousesService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly sequenceService: SequenceService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async create(dto: CreateWarehouseDto, currentUser: CurrentUser) {
    await this.ensureManagerUserExists(dto.managerUserId);
    await this.ensureWarehouseCodeAvailable(dto.code);

    return this.dataSource.transaction(async (manager) => {
      const warehouseNo = await this.sequenceService.generateBizNo(
        BIZ_SEQUENCE_CONFIG.WAREHOUSE.bizType,
        BIZ_SEQUENCE_CONFIG.WAREHOUSE.prefix,
        manager,
      );
      const repo = manager.getRepository(Warehouse);
      const warehouse = repo.create({
        warehouseNo,
        name: dto.name,
        code: dto.code,
        managerUserId: dto.managerUserId ?? null,
        address: dto.address ?? null,
        status: dto.status ?? WarehouseStatus.ACTIVE,
        remark: dto.remark ?? null,
        createdBy: currentUser.id,
      });

      const saved = await repo.save(warehouse);
      await this.operationLogsService.create(
        {
          module: 'warehouse',
          targetId: saved.id,
          action: OperationLogAction.CREATE_WAREHOUSE,
          operatorId: currentUser.id,
          detail: `创建库房 ${saved.warehouseNo}`,
        },
        manager,
      );

      return saved;
    });
  }

  async findAll() {
    return this.warehouseRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number) {
    const warehouse = await this.warehouseRepository.findOne({ where: { id } });

    if (!warehouse) {
      throw new NotFoundException('库房不存在');
    }

    return warehouse;
  }

  async update(id: number, dto: UpdateWarehouseDto, currentUser: CurrentUser) {
    const warehouse = await this.findOne(id);
    await this.ensureManagerUserExists(dto.managerUserId);

    if (dto.code && dto.code !== warehouse.code) {
      await this.ensureWarehouseCodeAvailable(dto.code, id);
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Warehouse);
      const merged = repo.merge(warehouse, {
        ...dto,
        managerUserId:
          dto.managerUserId === undefined ? warehouse.managerUserId : dto.managerUserId,
      });
      const saved = await repo.save(merged);

      await this.operationLogsService.create(
        {
          module: 'warehouse',
          targetId: saved.id,
          action: OperationLogAction.UPDATE_WAREHOUSE,
          operatorId: currentUser.id,
          detail: `更新库房 ${saved.warehouseNo}`,
        },
        manager,
      );

      return saved;
    });
  }

  private async ensureManagerUserExists(userId?: number) {
    if (!userId) {
      return;
    }

    const user = await this.userRepository.findOne({
      where: { id: userId, status: 1 },
    });

    if (!user) {
      throw new NotFoundException('库房负责人不存在或已禁用');
    }
  }

  private async ensureWarehouseCodeAvailable(code: string, ignoreId?: number) {
    const existing = await this.warehouseRepository.findOne({ where: { code } });

    if (existing && existing.id !== ignoreId) {
      throw new BadRequestException('库房编码已存在');
    }
  }
}
