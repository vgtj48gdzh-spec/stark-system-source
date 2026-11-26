import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiRecommendation } from '../engagement/entities/ai-recommendation.entity';
import { MemoryEntry } from '../engagement/entities/memory-entry.entity';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { Employee } from '../performance/entities/employee.entity';
import { EmployeeBenefitCardRecord } from './entities/employee-benefit-card-record.entity';
import { EmployeeBenefitFundLink } from './entities/employee-benefit-fund-link.entity';
import { EmployeeBenefitIssueItem } from './entities/employee-benefit-issue-item.entity';
import { EmployeeBenefitIssue } from './entities/employee-benefit-issue.entity';
import { EmployeeBenefitNotification } from './entities/employee-benefit-notification.entity';
import { EmployeeBenefitsController } from './employee-benefits.controller';
import { EmployeeBenefitsService } from './employee-benefits.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      MemoryEntry,
      AiRecommendation,
      EmployeeBenefitIssue,
      EmployeeBenefitIssueItem,
      EmployeeBenefitCardRecord,
      EmployeeBenefitFundLink,
      EmployeeBenefitNotification,
    ]),
    OperationLogsModule,
  ],
  controllers: [EmployeeBenefitsController],
  providers: [EmployeeBenefitsService],
  exports: [EmployeeBenefitsService],
})
export class EmployeeBenefitsModule {}
