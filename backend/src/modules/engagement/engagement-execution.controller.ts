import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { CloseExecutionTaskDto } from './dto/close-execution-task.dto';
import { ConfirmExecutionTaskDto } from './dto/confirm-execution-task.dto';
import { ConfirmExecutionTaskItemDto } from './dto/confirm-execution-task-item.dto';
import { CreateExecutionPlaybookDto } from './dto/create-execution-playbook.dto';
import { CreateExecutionResultDto } from './dto/create-execution-result.dto';
import { CreateExecutionTaskDto } from './dto/create-execution-task.dto';
import { QueryExecutionPlaybooksDto } from './dto/query-execution-playbooks.dto';
import { QueryExecutionResultsDto } from './dto/query-execution-results.dto';
import { QueryExecutionTaskItemsDto } from './dto/query-execution-task-items.dto';
import { QueryExecutionTasksDto } from './dto/query-execution-tasks.dto';
import { SkipExecutionTaskItemDto } from './dto/skip-execution-task-item.dto';
import { ToggleExecutionPlaybookDto } from './dto/toggle-execution-playbook.dto';
import { UpdateExecutionPlaybookDto } from './dto/update-execution-playbook.dto';
import { EngagementExecutionService } from './engagement-execution.service';

@Controller('engagement')
export class EngagementExecutionController {
  constructor(private readonly engagementExecutionService: EngagementExecutionService) {}

  @Get('execution-playbooks')
  @Roles('admin', 'finance', 'approver')
  async findExecutionPlaybooks(@Query() query: QueryExecutionPlaybooksDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementExecutionService.findExecutionPlaybooks(query),
    };
  }

  @Post('execution-playbooks')
  @Roles('admin')
  async createExecutionPlaybook(
    @Body() dto: CreateExecutionPlaybookDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '执行方案创建成功',
      data: await this.engagementExecutionService.createExecutionPlaybook(dto, currentUser),
    };
  }

  @Patch('execution-playbooks/:id')
  @Roles('admin')
  async updateExecutionPlaybook(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExecutionPlaybookDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '执行方案更新成功',
      data: await this.engagementExecutionService.updateExecutionPlaybook(id, dto, currentUser),
    };
  }

  @Post('execution-playbooks/:id/toggle')
  @Roles('admin')
  async toggleExecutionPlaybook(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ToggleExecutionPlaybookDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '执行方案状态更新成功',
      data: await this.engagementExecutionService.toggleExecutionPlaybook(id, dto, currentUser),
    };
  }

  @Get('execution-tasks')
  @Roles('admin', 'finance', 'approver', 'operator')
  async findExecutionTasks(
    @Query() query: QueryExecutionTasksDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementExecutionService.findExecutionTasks(query, currentUser),
    };
  }

  @Post('execution-tasks')
  @Roles('admin')
  async createExecutionTask(
    @Body() dto: CreateExecutionTaskDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '执行任务创建成功',
      data: await this.engagementExecutionService.createExecutionTask(dto, currentUser),
    };
  }

  @Get('execution-tasks/:id')
  @Roles('admin', 'finance', 'approver', 'operator')
  async findExecutionTaskById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementExecutionService.findExecutionTaskById(id, currentUser),
    };
  }

  @Post('execution-tasks/:id/confirm')
  @Roles('admin')
  async confirmExecutionTask(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmExecutionTaskDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '执行任务确认成功',
      data: await this.engagementExecutionService.confirmExecutionTask(id, dto, currentUser),
    };
  }

  @Post('execution-tasks/:id/close')
  @Roles('admin')
  async closeExecutionTask(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CloseExecutionTaskDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '执行任务关闭成功',
      data: await this.engagementExecutionService.closeExecutionTask(id, dto, currentUser),
    };
  }

  @Get('execution-task-items')
  @Roles('admin', 'finance', 'approver', 'operator')
  async findExecutionTaskItems(
    @Query() query: QueryExecutionTaskItemsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementExecutionService.findExecutionTaskItems(query, currentUser),
    };
  }

  @Post('execution-task-items/:id/confirm')
  @Roles('admin')
  async confirmExecutionTaskItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmExecutionTaskItemDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '任务明细确认成功',
      data: await this.engagementExecutionService.confirmExecutionTaskItem(id, dto, currentUser),
    };
  }

  @Post('execution-task-items/:id/skip')
  @Roles('admin')
  async skipExecutionTaskItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SkipExecutionTaskItemDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '任务明细已跳过',
      data: await this.engagementExecutionService.skipExecutionTaskItem(id, dto, currentUser),
    };
  }

  @Get('execution-results')
  @Roles('admin', 'finance', 'approver', 'operator')
  async findExecutionResults(
    @Query() query: QueryExecutionResultsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementExecutionService.findExecutionResults(query, currentUser),
    };
  }

  @Get('execution-results/summary')
  @Roles('admin', 'finance', 'approver', 'operator')
  async findExecutionResultSummary(
    @Query() query: QueryExecutionResultsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementExecutionService.findExecutionResultSummary(query, currentUser),
    };
  }

  @Post('execution-results')
  @Roles('admin', 'operator')
  async createExecutionResult(
    @Body() dto: CreateExecutionResultDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '执行结果记录成功',
      data: await this.engagementExecutionService.createExecutionResult(dto, currentUser),
    };
  }

  @Get('execution-results/:id')
  @Roles('admin', 'finance', 'approver', 'operator')
  async findExecutionResultById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementExecutionService.findExecutionResultById(id, currentUser),
    };
  }
}
