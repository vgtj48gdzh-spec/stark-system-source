import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceBankSmsModule } from '../finance-bank-sms/finance-bank-sms.module';
import { FinanceSafetyModule } from '../finance-safety/finance-safety.module';
import { MobileDiagnosticsModule } from '../mobile-diagnostics/mobile-diagnostics.module';
import { VerificationForwardModule } from '../verification-forward/verification-forward.module';
import { SmsMessageClassification } from './entities/sms-message-classification.entity';
import { SmsMessageRaw } from './entities/sms-message-raw.entity';
import { MessageHubController } from './message-hub.controller';
import { MessageHubService } from './message-hub.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SmsMessageRaw, SmsMessageClassification]),
    VerificationForwardModule,
    FinanceBankSmsModule,
    FinanceSafetyModule,
    MobileDiagnosticsModule,
  ],
  controllers: [MessageHubController],
  providers: [MessageHubService],
  exports: [MessageHubService],
})
export class MessageHubModule {}
