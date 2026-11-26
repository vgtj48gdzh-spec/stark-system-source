import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SourceSystem } from './entities/source-system.entity';
import { SourceSystemsService } from './source-systems.service';

@Module({
  imports: [TypeOrmModule.forFeature([SourceSystem])],
  providers: [SourceSystemsService],
  exports: [SourceSystemsService],
})
export class SourceSystemsModule {}
