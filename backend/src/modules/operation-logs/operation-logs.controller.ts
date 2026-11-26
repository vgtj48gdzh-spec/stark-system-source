import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequireFormalActorIdentity } from '../../common/decorators/require-formal-actor-identity.decorator';
import { buildPaginationResult } from '../../common/utils/pagination.util';
import { projectOperationLogReadonly } from './operation-log-readonly';
import { QueryOperationLogsDto } from './dto/query-operation-logs.dto';
import { OperationLogsService } from './operation-logs.service';

@Controller('operation-logs')
export class OperationLogsController {
  constructor(private readonly operationLogsService: OperationLogsService) {}

  @Get()
  @RequireFormalActorIdentity()
  @Roles('finance', 'approver')
  async findAll(@Query() query: QueryOperationLogsDto) {
    const result = await this.operationLogsService.findAll(query);
    return {
      success: true,
      message: '查询成功',
      data: buildPaginationResult(query, result.list.map(projectOperationLogReadonly), result.total),
    };
  }
}
