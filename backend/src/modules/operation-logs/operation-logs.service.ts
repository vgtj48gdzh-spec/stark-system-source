import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { buildPaginationResult, getPagination } from '../../common/utils/pagination.util';
import { QueryOperationLogsDto } from './dto/query-operation-logs.dto';
import { OperationLog } from './entities/operation-log.entity';

interface CreateOperationLogBaseInput {
  module: string;
  targetId: number;
  action: string;
  detail?: string;
  detailJson?: Record<string, unknown> | null;
}

type CreateOperationLogInput = CreateOperationLogBaseInput &
  (
    | {
        actorType?: 'human';
        operatorId: number;
        actorRef?: null;
      }
    | {
        actorType: 'system';
        operatorId?: null;
        actorRef: string;
      }
  );

interface FindOperationLogFilters {
  module?: string | string[];
  action?: string | string[];
  targetId?: number;
  targetIds?: number[];
  operatorId?: number;
  actorType?: 'human' | 'system';
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'createdAt' | 'module' | 'action' | 'targetId' | 'operatorId';
  sortOrder?: 'asc' | 'desc' | 'ASC' | 'DESC';
}

const OPERATION_LOG_SORT_COLUMNS: Record<
  NonNullable<FindOperationLogFilters['sortBy']>,
  string
> = {
  createdAt: 'log.created_at',
  module: 'log.module',
  action: 'log.action',
  targetId: 'log.target_id',
  operatorId: 'log.operator_id',
};

@Injectable()
export class OperationLogsService {
  constructor(
    @InjectRepository(OperationLog)
    private readonly operationLogRepository: Repository<OperationLog>,
  ) {}

  async create(input: CreateOperationLogInput, manager?: EntityManager) {
    const actorType = input.actorType ?? 'human';
    if (
      (actorType === 'human' &&
        (!Number.isInteger(input.operatorId) || Number(input.operatorId) <= 0)) ||
      (actorType === 'system' &&
        ((input.operatorId !== null && input.operatorId !== undefined) ||
          !input.actorRef?.trim()))
    ) {
      throw new BadRequestException('Invalid operation log actor contract.');
    }

    const repo = manager ? manager.getRepository(OperationLog) : this.operationLogRepository;
    const record = repo.create({
      module: input.module,
      targetId: input.targetId,
      action: input.action,
      operatorId: actorType === 'human' ? input.operatorId : null,
      actorType,
      actorRef: actorType === 'system' ? input.actorRef?.trim() ?? null : null,
      detail: input.detail ?? null,
      detailJson: input.detailJson ?? null,
    });

    return repo.save(record);
  }

  async findAll(query: QueryOperationLogsDto) {
    const { skip, take } = getPagination(query);
    const qb = this.buildFilteredQuery(this.operationLogRepository, query);
    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        OPERATION_LOG_SORT_COLUMNS[query.sortBy ?? 'createdAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async findAuditLogs(filters: FindOperationLogFilters, manager?: EntityManager) {
    const repo = manager ? manager.getRepository(OperationLog) : this.operationLogRepository;

    return this.buildFilteredQuery(repo, filters)
      .orderBy(
        OPERATION_LOG_SORT_COLUMNS[filters.sortBy ?? 'createdAt'],
        this.normalizeSortOrder(filters.sortOrder, 'ASC'),
      )
      .getMany();
  }

  private buildFilteredQuery(
    repo: Repository<OperationLog>,
    filters: FindOperationLogFilters,
  ): SelectQueryBuilder<OperationLog> {
    const qb = repo.createQueryBuilder('log');

    if (filters.module) {
      if (Array.isArray(filters.module)) {
        qb.andWhere('log.module IN (:...modules)', { modules: filters.module });
      } else {
        qb.andWhere('log.module = :module', { module: filters.module });
      }
    }

    if (filters.action) {
      if (Array.isArray(filters.action)) {
        qb.andWhere('log.action IN (:...actions)', { actions: filters.action });
      } else {
        qb.andWhere('log.action = :action', { action: filters.action });
      }
    }

    if (filters.targetId) {
      qb.andWhere('log.target_id = :targetId', { targetId: filters.targetId });
    }

    if (filters.targetIds?.length) {
      qb.andWhere('log.target_id IN (:...targetIds)', {
        targetIds: filters.targetIds,
      });
    }

    if (filters.operatorId) {
      qb.andWhere('log.operator_id = :operatorId', { operatorId: filters.operatorId });
    }

    if (filters.actorType) {
      qb.andWhere('log.actor_type = :actorType', { actorType: filters.actorType });
    }

    if (filters.dateFrom) {
      qb.andWhere('log.created_at >= :dateFrom', { dateFrom: new Date(filters.dateFrom) });
    }

    if (filters.dateTo) {
      qb.andWhere('log.created_at <= :dateTo', { dateTo: new Date(filters.dateTo) });
    }

    return qb;
  }

  private normalizeSortOrder(
    sortOrder: FindOperationLogFilters['sortOrder'],
    fallback: 'ASC' | 'DESC',
  ) {
    if (!sortOrder) {
      return fallback;
    }

    return sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  }
}
