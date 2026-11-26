import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { SmsMessageClassification } from '../message-hub/entities/sms-message-classification.entity';
import { SmsMessageRaw } from '../message-hub/entities/sms-message-raw.entity';
import { VerificationCodeDispatchLog } from './entities/verification-code-dispatch-log.entity';
import { VerificationForwardController } from './verification-forward.controller';
import { VerificationForwardService } from './verification-forward.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VerificationCodeDispatchLog,
      SmsMessageRaw,
      SmsMessageClassification,
    ]),
    OperationLogsModule,
  ],
  controllers: [VerificationForwardController],
  providers: [VerificationForwardService],
  exports: [VerificationForwardService],
})
export class VerificationForwardModule {}
