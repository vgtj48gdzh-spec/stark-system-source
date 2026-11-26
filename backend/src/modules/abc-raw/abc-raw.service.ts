import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbcRawGroup } from '../../shared/enums/abc-raw-group.enum';
import { AbcRawCard } from './entities/abc-raw-card.entity';
import { AbcRawInventory } from './entities/abc-raw-inventory.entity';
import { AbcRawOrder } from './entities/abc-raw-order.entity';
import { AbcRawTransaction } from './entities/abc-raw-transaction.entity';

export interface SaveRawRecordInput {
  sourceSystem: string;
  sourceTable: string;
  sourceId: string;
  sourceOrderNo?: string | null;
  sourceUpdatedAt?: Date | null;
  syncedAt: Date;
  syncBatchNo: string;
  rawPayload: Record<string, unknown>;
}

const ORDER_TABLES = new Set([
  'order',
  'repair_order',
  'supermarket_order',
  'top_up_order',
  'goods_group_order',
]);
const TRANSACTION_TABLES = new Set(['transaction']);
const CARD_TABLES = new Set([
  'shopping_card',
  'shopping_card_recharge_precept',
  'user_shopping_card',
  'user_shopping_card_money',
  'user_shopping_card_recharge',
  'goods_group',
]);
const INVENTORY_TABLES = new Set([
  'merchant_material',
  'merchant_supplier',
  'merchant_warehouse',
  'merchant_warehouse_out',
  'merchant_storeroom',
  'merchant_account',
]);

@Injectable()
export class AbcRawService {
  constructor(
    @InjectRepository(AbcRawOrder)
    private readonly abcRawOrderRepository: Repository<AbcRawOrder>,
    @InjectRepository(AbcRawTransaction)
    private readonly abcRawTransactionRepository: Repository<AbcRawTransaction>,
    @InjectRepository(AbcRawCard)
    private readonly abcRawCardRepository: Repository<AbcRawCard>,
    @InjectRepository(AbcRawInventory)
    private readonly abcRawInventoryRepository: Repository<AbcRawInventory>,
  ) {}

  resolveRawGroup(sourceTable: string) {
    if (ORDER_TABLES.has(sourceTable)) {
      return AbcRawGroup.ORDERS;
    }

    if (TRANSACTION_TABLES.has(sourceTable)) {
      return AbcRawGroup.TRANSACTIONS;
    }

    if (CARD_TABLES.has(sourceTable)) {
      return AbcRawGroup.CARDS;
    }

    if (INVENTORY_TABLES.has(sourceTable)) {
      return AbcRawGroup.INVENTORY;
    }

    throw new BadRequestException(`暂不支持导入来源表：${sourceTable}`);
  }

  getRawTableName(sourceGroup: AbcRawGroup) {
    if (sourceGroup === AbcRawGroup.ORDERS) {
      return 'abc_raw_orders';
    }

    if (sourceGroup === AbcRawGroup.TRANSACTIONS) {
      return 'abc_raw_transactions';
    }

    if (sourceGroup === AbcRawGroup.CARDS) {
      return 'abc_raw_cards';
    }

    return 'abc_raw_inventory';
  }

  async upsertRecords(sourceTable: string, records: SaveRawRecordInput[]) {
    if (!records.length) {
      return {
        rawGroup: this.resolveRawGroup(sourceTable),
        createdRecords: 0,
        updatedRecords: 0,
        totalRecords: 0,
      };
    }

    const sourceGroup = this.resolveRawGroup(sourceTable);
    const repository = this.resolveRepository(sourceGroup);
    const existingRecords = await repository.find({
      where: {
        sourceSystem: records[0].sourceSystem,
        sourceTable,
      },
    });

    const existingKeySet = new Set(existingRecords.map((record) => record.sourceId));
    const createdRecords = records.filter((record) => !existingKeySet.has(record.sourceId)).length;
    const updatedRecords = records.length - createdRecords;

    for (const record of records) {
      const existing = existingRecords.find(
        (item) =>
          item.sourceSystem === record.sourceSystem &&
          item.sourceTable === record.sourceTable &&
          item.sourceId === record.sourceId,
      );

      if (existing) {
        existing.sourceOrderNo = record.sourceOrderNo ?? null;
        existing.sourceUpdatedAt = record.sourceUpdatedAt ?? null;
        existing.syncedAt = record.syncedAt;
        existing.syncBatchNo = record.syncBatchNo;
        existing.rawPayload = record.rawPayload;
        existing.normalizedFlag = false;
        await repository.save(existing);
        continue;
      }

      const entity = repository.create({
        sourceSystem: record.sourceSystem,
        sourceTable: record.sourceTable,
        sourceId: record.sourceId,
        sourceOrderNo: record.sourceOrderNo ?? null,
        sourceUpdatedAt: record.sourceUpdatedAt ?? null,
        syncedAt: record.syncedAt,
        syncBatchNo: record.syncBatchNo,
        rawPayload: record.rawPayload,
        normalizedFlag: false,
      });

      await repository.save(entity);
    }

    return {
      rawGroup: sourceGroup,
      createdRecords,
      updatedRecords,
      totalRecords: records.length,
    };
  }

  private resolveRepository(sourceGroup: AbcRawGroup) {
    if (sourceGroup === AbcRawGroup.ORDERS) {
      return this.abcRawOrderRepository;
    }

    if (sourceGroup === AbcRawGroup.TRANSACTIONS) {
      return this.abcRawTransactionRepository;
    }

    if (sourceGroup === AbcRawGroup.CARDS) {
      return this.abcRawCardRepository;
    }

    return this.abcRawInventoryRepository;
  }
}
