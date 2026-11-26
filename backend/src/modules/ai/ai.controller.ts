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
import { AiAssistantReplyDto } from './dto/ai-assistant-reply.dto';
import { CreateAiMemoryEntryDto } from './dto/create-ai-memory-entry.dto';
import { MarkAiActionStateDto } from './dto/mark-ai-action-state.dto';
import { QueryAiConsoleOverviewDto } from './dto/query-ai-console-overview.dto';
import { QueryAiMemoryEntriesDto } from './dto/query-ai-memory-entries.dto';
import { QueryAiNextActionsDto } from './dto/query-ai-next-actions.dto';
import { QueryAiOwnerMemoryProjectionDto } from './dto/query-ai-owner-memory-projection.dto';
import { QueryAiPageContextDto } from './dto/query-ai-page-context.dto';
import { QueryAiSummaryContextDto } from './dto/query-ai-summary-context.dto';
import { ToggleAiMemoryEntryDto } from './dto/toggle-ai-memory-entry.dto';
import { UpdateAiMemoryEntryDto } from './dto/update-ai-memory-entry.dto';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('next-actions')
  @Roles('admin', 'finance', 'approver', 'founder', 'super_admin', 'owner')
  async getNextActions(
    @Query() query: QueryAiNextActionsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ): Promise<any> {
    return {
      success: true,
      message: '查询成功',
      data: await this.aiService.getNextActions(query, currentUser),
    };
  }

  @Get('console/overview')
  @Roles('admin', 'finance', 'approver', 'founder', 'super_admin', 'owner')
  async getConsoleOverview(
    @Query() query: QueryAiConsoleOverviewDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ): Promise<any> {
    return {
      success: true,
      message: '查询成功',
      data: await this.aiService.getConsoleOverview(query, currentUser),
    };
  }

  @Get('context/summary/:id')
  @Roles('admin', 'finance', 'approver', 'founder', 'super_admin', 'owner')
  async getSummaryContext(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QueryAiSummaryContextDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ): Promise<any> {
    return {
      success: true,
      message: '查询成功',
      data: await this.aiService.getSummaryContext(id, query, currentUser),
    };
  }

  @Get('context/task/:actionId')
  @Roles('admin', 'finance', 'approver', 'founder', 'super_admin', 'owner')
  async getTaskContext(
    @Param('actionId') actionId: string,
    @Query() query: QueryAiConsoleOverviewDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ): Promise<any> {
    return {
      success: true,
      message: '查询成功',
      data: await this.aiService.getTaskContext(actionId, query, currentUser),
    };
  }

  @Get('context/points-command/:id')
  @Roles('admin', 'finance', 'approver', 'founder', 'super_admin', 'owner')
  async getPointsCommandContext(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QueryAiConsoleOverviewDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ): Promise<any> {
    return {
      success: true,
      message: '查询成功',
      data: await this.aiService.getPointsCommandContext(id, query, currentUser),
    };
  }

  @Get('context/points-redemption/:id')
  @Roles('admin', 'finance', 'approver', 'founder', 'super_admin', 'owner')
  async getPointsRedemptionContext(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QueryAiConsoleOverviewDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ): Promise<any> {
    return {
      success: true,
      message: '查询成功',
      data: await this.aiService.getPointsRedemptionContext(id, query, currentUser),
    };
  }

  @Get('context/page')
  @Roles('admin', 'finance', 'approver', 'founder', 'super_admin', 'owner')
  async getPageContext(
    @Query() query: QueryAiPageContextDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ): Promise<any> {
    return {
      success: true,
      message: '页面 AI 上下文已生成',
      data: await this.aiService.getPageContext(query, currentUser),
    };
  }

  @Post('assistant/reply')
  @Roles('admin', 'finance', 'approver', 'founder', 'super_admin', 'owner')
  async replyAssistant(
    @Body() dto: AiAssistantReplyDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ): Promise<any> {
    return {
      success: true,
      message: 'AI 助手已生成分析建议',
      data: await this.aiService.replyAssistant(dto, currentUser),
    };
  }

  @Get('memory')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async getMemoryEntries(
    @Query() query: QueryAiMemoryEntriesDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ): Promise<any> {
    return {
      success: true,
      message: '查询成功',
      data: await this.aiService.getMemoryEntries(query, currentUser),
    };
  }

  @Get('memory/owner-profile')
  @Roles('founder', 'super_admin', 'owner')
  async getOwnerMemoryProjection(
    @Query() query: QueryAiOwnerMemoryProjectionDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ): Promise<any> {
    return {
      success: true,
      message: '老板记忆安全投影已生成',
      data: await this.aiService.getOwnerMemoryProjection(query, currentUser),
    };
  }

  @Post('memory')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async createMemoryEntry(
    @Body() dto: CreateAiMemoryEntryDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ): Promise<any> {
    return {
      success: true,
      message: '记忆条目已创建',
      data: await this.aiService.createMemoryEntry(dto, currentUser),
    };
  }

  @Patch('memory/:id')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async updateMemoryEntry(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAiMemoryEntryDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ): Promise<any> {
    return {
      success: true,
      message: '记忆条目已更新',
      data: await this.aiService.updateMemoryEntry(id, dto, currentUser),
    };
  }

  @Post('memory/:id/toggle')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async toggleMemoryEntry(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ToggleAiMemoryEntryDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ): Promise<any> {
    return {
      success: true,
      message: '记忆条目状态已更新',
      data: await this.aiService.toggleMemoryEntry(id, dto, currentUser),
    };
  }

  @Post('action-states')
  @Roles(
    'admin',
    'finance',
    'approver',
    'operator',
    'founder',
    'super_admin',
    'owner',
    'store_manager',
    'customer_service',
  )
  async markActionState(
    @Body() dto: MarkAiActionStateDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ): Promise<any> {
    return {
      success: true,
      message: '操作状态已记录',
      data: await this.aiService.markActionState(dto, currentUser),
    };
  }
}
