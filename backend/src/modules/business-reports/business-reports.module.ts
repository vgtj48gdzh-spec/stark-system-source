import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceBankSmsModule } from '../finance-bank-sms/finance-bank-sms.module';
import { MaterialPreparation } from '../material-preparations/entities/material-preparation.entity';
import { Material } from '../materials/entities/material.entity';
import { MaterialStock } from '../material-stocks/entities/material-stock.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { BusinessReportsController } from './business-reports.controller';
import { BusinessReportsService } from './business-reports.service';
import { OwnerCommandCenterSummaryService } from './owner-command-center-summary.service';

@Module({
  imports: [
    FinanceBankSmsModule,
    TypeOrmModule.forFeature([
      WorkOrder,
      MaterialStock,
      MaterialPreparation,
      Material,
    ]),
  ],
  controllers: [BusinessReportsController],
  providers: [BusinessReportsService, OwnerCommandCenterSummaryService],
})
export class BusinessReportsModule {}
