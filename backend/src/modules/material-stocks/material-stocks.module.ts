import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialStock } from './entities/material-stock.entity';
import { MaterialStocksController } from './material-stocks.controller';
import { MaterialStocksService } from './material-stocks.service';

@Module({
  imports: [TypeOrmModule.forFeature([MaterialStock])],
  controllers: [MaterialStocksController],
  providers: [MaterialStocksService],
  exports: [MaterialStocksService],
})
export class MaterialStocksModule {}
