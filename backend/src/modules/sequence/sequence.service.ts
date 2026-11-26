import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  BizSequencePrefix,
  BizSequenceType,
} from '../../shared/constants/biz-sequence.constant';
import { Sequence } from './entities/sequence.entity';

@Injectable()
export class SequenceService {
  constructor(
    @InjectRepository(Sequence)
    private readonly sequenceRepository: Repository<Sequence>,
  ) {}

  async generateBizNo(
    bizType: BizSequenceType,
    prefix: BizSequencePrefix,
    manager?: EntityManager,
  ): Promise<string> {
    const executor = manager ?? this.sequenceRepository.manager;
    if (!executor.queryRunner?.isTransactionActive) {
      return executor.transaction((transactionManager) =>
        this.generateBizNo(bizType, prefix, transactionManager),
      );
    }

    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const bizDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    await executor.query(
      `
        INSERT INTO sequences (biz_type, biz_date, current_value, created_at, updated_at)
        VALUES (?, ?, 1, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          current_value = current_value + 1,
          updated_at = NOW()
      `,
      [bizType, bizDate],
    );

    const rows = await executor.query(
      `
        SELECT current_value AS currentValue
          FROM sequences
         WHERE biz_type = ? AND biz_date = ?
         FOR UPDATE
      `,
      [bizType, bizDate],
    );
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Business sequence allocation did not resolve exactly one row');
    }

    const [result] = rows;
    const currentValue = Number(result?.currentValue ?? 0);
    if (!Number.isSafeInteger(currentValue) || currentValue <= 0) {
      throw new Error('Business sequence allocation returned an invalid current value');
    }

    return `${prefix}${datePart}${String(currentValue).padStart(4, '0')}`;
  }

  async lockApprovalRequestDraftCreateMutex(manager: EntityManager): Promise<void> {
    await manager.query(
      `
        INSERT INTO sequences (biz_type, biz_date, current_value, created_at, updated_at)
        VALUES (?, ?, 0, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          current_value = current_value
      `,
      ['approval_draft_create_mutex', '1970-01-01'],
    );
  }
}
