import { Module } from '@nestjs/common';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { BusinessFoundationController } from './business-foundation.controller';
import { BusinessFoundationService } from './business-foundation.service';

@Module({
  imports: [OperationLogsModule],
  controllers: [BusinessFoundationController],
  providers: [BusinessFoundationService],
  exports: [BusinessFoundationService],
})
export class BusinessFoundationModule {}
