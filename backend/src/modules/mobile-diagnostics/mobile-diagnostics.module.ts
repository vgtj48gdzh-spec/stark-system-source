import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankSmsTransaction } from '../finance-bank-sms/entities/bank-sms-transaction.entity';
import { SmsMessageClassification } from '../message-hub/entities/sms-message-classification.entity';
import { SmsMessageRaw } from '../message-hub/entities/sms-message-raw.entity';
import { MobileSmsEvent } from '../mobile-bridge/entities/mobile-sms-event.entity';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { MobileDeviceCommand } from './entities/mobile-device-command.entity';
import { MobileDeviceDiagnostic } from './entities/mobile-device-diagnostic.entity';
import { MobileDiagnosticsController } from './mobile-diagnostics.controller';
import { MobileDiagnosticsService } from './mobile-diagnostics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MobileDeviceDiagnostic,
      MobileDeviceCommand,
      MobileSmsEvent,
      SmsMessageRaw,
      SmsMessageClassification,
      BankSmsTransaction,
    ]),
    OperationLogsModule,
  ],
  controllers: [MobileDiagnosticsController],
  providers: [MobileDiagnosticsService],
  exports: [MobileDiagnosticsService],
})
export class MobileDiagnosticsModule {}
