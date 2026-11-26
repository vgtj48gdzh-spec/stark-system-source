import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbcRawCard } from './entities/abc-raw-card.entity';
import { AbcRawInventory } from './entities/abc-raw-inventory.entity';
import { AbcRawOrder } from './entities/abc-raw-order.entity';
import { AbcRawTransaction } from './entities/abc-raw-transaction.entity';
import { AbcRawService } from './abc-raw.service';

@Module({
  imports: [TypeOrmModule.forFeature([AbcRawOrder, AbcRawTransaction, AbcRawCard, AbcRawInventory])],
  providers: [AbcRawService],
  exports: [AbcRawService],
})
export class AbcRawModule {}
