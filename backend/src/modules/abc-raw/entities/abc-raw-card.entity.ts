import { Entity, Index } from 'typeorm';
import { AbcRawBaseEntity } from './abc-raw-base.entity';

@Entity('abc_raw_cards')
@Index('uniq_abc_raw_cards_source_key', ['sourceSystem', 'sourceTable', 'sourceId'], {
  unique: true,
})
@Index('idx_abc_raw_cards_batch_no', ['syncBatchNo'])
@Index('idx_abc_raw_cards_normalized_flag', ['normalizedFlag'])
export class AbcRawCard extends AbcRawBaseEntity {}
