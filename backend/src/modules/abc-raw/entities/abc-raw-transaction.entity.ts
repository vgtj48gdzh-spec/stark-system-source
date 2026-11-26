import { Entity, Index } from 'typeorm';
import { AbcRawBaseEntity } from './abc-raw-base.entity';

@Entity('abc_raw_transactions')
@Index(
  'uniq_abc_raw_transactions_source_key',
  ['sourceSystem', 'sourceTable', 'sourceId'],
  {
    unique: true,
  },
)
@Index('idx_abc_raw_transactions_batch_no', ['syncBatchNo'])
@Index('idx_abc_raw_transactions_normalized_flag', ['normalizedFlag'])
export class AbcRawTransaction extends AbcRawBaseEntity {}
