import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { MobileDiagnosticsModule } from '../mobile-diagnostics/mobile-diagnostics.module';
import {
  HomeClimateControlLog,
  HomeClimateDevice,
  HomeClimatePreset,
} from './entities/home-climate.entities';
import { HomeClimateController } from './home-climate.controller';
import { HomeClimateService } from './home-climate.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([HomeClimateDevice, HomeClimatePreset, HomeClimateControlLog]),
    OperationLogsModule,
    MobileDiagnosticsModule,
  ],
  controllers: [HomeClimateController],
  providers: [HomeClimateService],
  exports: [HomeClimateService],
})
export class HomeClimateModule {}
