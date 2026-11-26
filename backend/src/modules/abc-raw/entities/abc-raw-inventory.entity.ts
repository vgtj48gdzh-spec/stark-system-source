import { Entity, Index } from 'typeorm';
import { AbcRawBaseEntity } from './abc-raw-base.entity';

@Entity('abc_raw_inventory')
@Index('uniq_abc_raw_inventory_source_key', ['sourceSystem', 'sourceTable', 'sourceId'], {
  unique: true,
})
@Index('idx_abc_raw_inventory_batch_no', ['syncBatchNo'])
@Index('idx_abc_raw_inventory_normalized_flag', ['normalizedFlag'])
export class AbcRawInventory extends AbcRawBaseEntity {}
