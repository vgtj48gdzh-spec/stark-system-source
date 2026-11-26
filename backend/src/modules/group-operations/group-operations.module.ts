import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BUSINESS_FOUNDATION_ENTITIES } from '../business-foundation/entities/business-foundation.entities';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { Employee } from '../performance/entities/employee.entity';
import { GROUP_OPERATIONS_ENTITIES } from './entities/group-operations.entities';
import { GroupOperationsController } from './group-operations.controller';
import { GroupOperationsService } from './group-operations.service';
import { BusinessContributionController } from './business-contribution.controller';
import { BusinessContributionService } from './business-contribution.service';
import { BusinessContributionSourceAuthorityResolver } from './business-contribution-source-authority';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ...GROUP_OPERATIONS_ENTITIES,
      ...BUSINESS_FOUNDATION_ENTITIES,
      Employee,
    ]),
    OperationLogsModule,
  ],
  controllers: [GroupOperationsController, BusinessContributionController],
  providers: [
    GroupOperationsService,
    BusinessContributionSourceAuthorityResolver,
    BusinessContributionService,
  ],
  exports: [GroupOperationsService, BusinessContributionService],
})
export class GroupOperationsModule {}
