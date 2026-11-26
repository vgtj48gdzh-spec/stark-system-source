import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessFoundationModule } from '../business-foundation/business-foundation.module';
import { BankSmsTransaction } from '../finance-bank-sms/entities/bank-sms-transaction.entity';
import { SmsMessageRaw } from '../message-hub/entities/sms-message-raw.entity';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { BankAccountRegistry } from './entities/bank-account-registry.entity';
import { BankAccountRegistryReviewAuthority } from './entities/bank-account-registry-review-authority.entity';
import { FinanceBankAccountController } from './finance-bank-account.controller';
import { FinanceBankAccountService } from './finance-bank-account.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BankAccountRegistry,
      BankAccountRegistryReviewAuthority,
      BankSmsTransaction,
      SmsMessageRaw,
    ]),
    BusinessFoundationModule,
    OperationLogsModule,
  ],
  controllers: [FinanceBankAccountController],
  providers: [FinanceBankAccountService],
  exports: [FinanceBankAccountService],
})
export class FinanceBankAccountModule {}
