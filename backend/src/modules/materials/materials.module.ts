import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { SequenceModule } from '../sequence/sequence.module';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Material } from './entities/material.entity';
import { MaterialsController } from './materials.controller';
import { MaterialsService } from './materials.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Material, Supplier]),
    SequenceModule,
    OperationLogsModule,
  ],
  controllers: [MaterialsController],
  providers: [MaterialsService],
  exports: [MaterialsService],
})
export class MaterialsModule {}
