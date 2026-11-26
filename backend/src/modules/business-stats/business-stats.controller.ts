import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { BusinessStatsService } from './business-stats.service';
import { ConfirmBusinessStatSummaryDto } from './dto/confirm-business-stat-summary.dto';
import { ConfirmRewardEventDto } from './dto/confirm-reward-event.dto';
import { CreateRewardEventRuleDto } from './dto/create-reward-event-rule.dto';
import { GenerateBusinessStatSummariesDto } from './dto/generate-business-stat-summaries.dto';
import { GenerateRewardEventsDto } from './dto/generate-reward-events.dto';
import { GenerateStatTagsDto } from './dto/generate-stat-tags.dto';
import { IgnoreRewardEventDto } from './dto/ignore-reward-event.dto';
import { QueryBusinessStatSummariesDto } from './dto/query-business-stat-summaries.dto';
import { QueryBusinessStatSummaryDetailDto } from './dto/query-business-stat-summary-detail.dto';
import { QueryRewardEventRulesDto } from './dto/query-reward-event-rules.dto';
import { QueryRewardEventsDto } from './dto/query-reward-events.dto';
import { QueryStatPendingItemsDto } from './dto/query-stat-pending-items.dto';
import { QueryStatTagsDto } from './dto/query-stat-tags.dto';
import { ReassignRewardEventDto } from './dto/reassign-reward-event.dto';
import { ToggleRewardEventRuleDto } from './dto/toggle-reward-event-rule.dto';
import { UpdateRewardEventRuleDto } from './dto/update-reward-event-rule.dto';
import { UpdateStatTagDto } from './dto/update-stat-tag.dto';

@Controller()
export class BusinessStatsController {
  constructor(private readonly businessStatsService: BusinessStatsService) {}

  @Post('stat-tags/generate')
  @Roles('admin')
  async generateStatTags(
    @Body() dto: GenerateStatTagsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '统计标签生成完成',
      data: await this.businessStatsService.generateStatTags(dto, currentUser),
    };
  }

  @Get('stat-tags')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async findStatTags(
    @Query() query: QueryStatTagsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.businessStatsService.findStatTags(query, currentUser),
    };
  }

  @Get('stat-tags/:id')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async findStatTagById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.businessStatsService.findStatTagById(id, currentUser),
    };
  }

  @Patch('stat-tags/:id')
  @Roles('admin', 'finance')
  async updateStatTag(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStatTagDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '统计标签更新成功',
      data: await this.businessStatsService.updateStatTag(id, dto, currentUser),
    };
  }

  @Post('reward-events/generate')
  @Roles('admin')
  async generateRewardEvents(
    @Body() dto: GenerateRewardEventsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '奖励事件生成完成',
      data: await this.businessStatsService.generateRewardEvents(dto, currentUser),
    };
  }

  @Get('reward-events')
  @Roles('admin', 'finance', 'approver', 'founder', 'super_admin', 'owner')
  async findRewardEvents(
    @Query() query: QueryRewardEventsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.businessStatsService.findRewardEvents(query, currentUser),
    };
  }

  @Get('reward-events/:id')
  @Roles('admin', 'finance', 'approver', 'founder', 'super_admin', 'owner')
  async findRewardEventById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.businessStatsService.findRewardEventById(id, currentUser),
    };
  }

  @Post('reward-events/:id/confirm')
  @Roles('admin', 'finance')
  async confirmRewardEvent(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmRewardEventDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '奖励事件已确认',
      data: await this.businessStatsService.confirmRewardEvent(id, dto, currentUser),
    };
  }

  @Post('reward-events/:id/ignore')
  @Roles('admin', 'finance')
  async ignoreRewardEvent(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: IgnoreRewardEventDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '奖励事件已忽略',
      data: await this.businessStatsService.ignoreRewardEvent(id, dto, currentUser),
    };
  }

  @Post('reward-events/:id/reassign')
  @Roles('admin', 'finance')
  async reassignRewardEvent(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReassignRewardEventDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '奖励事件归属已更新',
      data: await this.businessStatsService.reassignRewardEvent(id, dto, currentUser),
    };
  }

  @Get('reward-rules')
  @Roles('admin', 'finance')
  async findRewardRules(@Query() query: QueryRewardEventRulesDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.businessStatsService.findRewardEventRules(query),
    };
  }

  @Post('reward-rules')
  @Roles('admin')
  async createRewardRule(
    @Body() dto: CreateRewardEventRuleDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '奖励规则创建成功',
      data: await this.businessStatsService.createRewardEventRule(dto, currentUser),
    };
  }

  @Patch('reward-rules/:id')
  @Roles('admin')
  async updateRewardRule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRewardEventRuleDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '奖励规则更新成功',
      data: await this.businessStatsService.updateRewardEventRule(id, dto, currentUser),
    };
  }

  @Post('reward-rules/:id/toggle')
  @Roles('admin')
  async toggleRewardRule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ToggleRewardEventRuleDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '奖励规则状态已更新',
      data: await this.businessStatsService.toggleRewardEventRule(id, dto, currentUser),
    };
  }

  @Post('stat-summaries/generate')
  @Roles('admin')
  async generateBusinessStatSummaries(
    @Body() dto: GenerateBusinessStatSummariesDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '统计汇总生成完成',
      data: await this.businessStatsService.generateBusinessStatSummaries(dto, currentUser),
    };
  }

  @Get('stat-summaries')
  @Roles('admin', 'finance', 'approver', 'founder', 'super_admin', 'owner')
  async findBusinessStatSummaries(
    @Query() query: QueryBusinessStatSummariesDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.businessStatsService.findBusinessStatSummaries(query, currentUser),
    };
  }

  @Get('stat-summaries/:id/detail')
  @Roles('admin', 'finance', 'approver', 'founder', 'super_admin', 'owner')
  async findBusinessStatSummaryDetail(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QueryBusinessStatSummaryDetailDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.businessStatsService.findBusinessStatSummaryDetail(id, query, currentUser),
    };
  }

  @Post('stat-summaries/:id/confirm')
  @Roles('admin', 'finance')
  async confirmBusinessStatSummary(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmBusinessStatSummaryDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '统计汇总已确认',
      data: await this.businessStatsService.confirmBusinessStatSummary(id, dto, currentUser),
    };
  }

  @Get('stat-pending-items')
  @Roles('admin', 'finance', 'approver', 'founder', 'super_admin', 'owner')
  async findPendingItems(
    @Query() query: QueryStatPendingItemsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.businessStatsService.findPendingItems(query, currentUser),
    };
  }
}
