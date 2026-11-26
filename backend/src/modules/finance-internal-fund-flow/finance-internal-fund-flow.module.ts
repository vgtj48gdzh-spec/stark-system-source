import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankAccountRegistry } from '../finance-bank-account/entities/bank-account-registry.entity';
import { FinanceSafetyModule } from '../finance-safety/finance-safety.module';
import { FinanceInternalFundFlow } from './entities/finance-internal-fund-flow.entity';
import { FinanceInternalFundFlowService } from './finance-internal-fund-flow.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FinanceInternalFundFlow, BankAccountRegistry]),
    FinanceSafetyModule,
  ],
  providers: [FinanceInternalFundFlowService],
  exports: [FinanceInternalFundFlowService],
})
export class FinanceInternalFundFlowModule {}
