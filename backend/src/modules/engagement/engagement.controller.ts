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
import { CreateAiRecommendationDto } from './dto/create-ai-recommendation.dto';
import { CreateInteractionLinkDto } from './dto/create-interaction-link.dto';
import { CreateMemoryEntryDto } from './dto/create-memory-entry.dto';
import { CreatePlatformContentDto } from './dto/create-platform-content.dto';
import { CreatePlatformInteractionDto } from './dto/create-platform-interaction.dto';
import { DeactivateMemoryEntryDto } from './dto/deactivate-memory-entry.dto';
import { QueryAiRecommendationsDto } from './dto/query-ai-recommendations.dto';
import { QueryInteractionLinksDto } from './dto/query-interaction-links.dto';
import { QueryMemoryEntriesDto } from './dto/query-memory-entries.dto';
import { QueryPlatformContentsDto } from './dto/query-platform-contents.dto';
import { QueryPlatformInteractionsDto } from './dto/query-platform-interactions.dto';
import { UpdateMemoryEntryDto } from './dto/update-memory-entry.dto';
import { EngagementService } from './engagement.service';

@Controller('engagement')
export class EngagementController {
  constructor(private readonly engagementService: EngagementService) {}

  @Post('platform-contents')
  @Roles('admin')
  async createPlatformContent(
    @Body() dto: CreatePlatformContentDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '平台内容创建成功',
      data: await this.engagementService.createPlatformContent(dto, currentUser),
    };
  }

  @Get('platform-contents')
  @Roles('admin', 'finance', 'approver')
  async findPlatformContents(@Query() query: QueryPlatformContentsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementService.findPlatformContents(query),
    };
  }

  @Get('platform-contents/:id')
  @Roles('admin', 'finance', 'approver')
  async findPlatformContentById(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementService.findPlatformContentById(id),
    };
  }

  @Post('platform-interactions')
  @Roles('admin')
  async createPlatformInteraction(
    @Body() dto: CreatePlatformInteractionDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '平台互动创建成功',
      data: await this.engagementService.createPlatformInteraction(dto, currentUser),
    };
  }

  @Get('platform-interactions')
  @Roles('admin', 'finance', 'approver')
  async findPlatformInteractions(@Query() query: QueryPlatformInteractionsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementService.findPlatformInteractions(query),
    };
  }

  @Get('platform-interactions/:id')
  @Roles('admin', 'finance', 'approver')
  async findPlatformInteractionById(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementService.findPlatformInteractionById(id),
    };
  }

  @Post('memories')
  @Roles('admin')
  async createMemoryEntry(
    @Body() dto: CreateMemoryEntryDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '记忆条目创建成功',
      data: await this.engagementService.createMemoryEntry(dto, currentUser),
    };
  }

  @Get('memories')
  @Roles('admin', 'finance', 'approver')
  async findMemoryEntries(@Query() query: QueryMemoryEntriesDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementService.findMemoryEntries(query),
    };
  }

  @Get('memories/:id')
  @Roles('admin', 'finance', 'approver')
  async findMemoryEntryById(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementService.findMemoryEntryById(id),
    };
  }

  @Patch('memories/:id')
  @Roles('admin')
  async updateMemoryEntry(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMemoryEntryDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '记忆条目更新成功',
      data: await this.engagementService.updateMemoryEntry(id, dto, currentUser),
    };
  }

  @Post('memories/:id/deactivate')
  @Roles('admin')
  async deactivateMemoryEntry(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeactivateMemoryEntryDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '记忆条目已停用',
      data: await this.engagementService.deactivateMemoryEntry(id, dto, currentUser),
    };
  }

  @Post('interaction-links')
  @Roles('admin')
  async createInteractionLink(
    @Body() dto: CreateInteractionLinkDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '互动关联创建成功',
      data: await this.engagementService.createInteractionLink(dto, currentUser),
    };
  }

  @Get('interaction-links')
  @Roles('admin', 'finance', 'approver')
  async findInteractionLinks(@Query() query: QueryInteractionLinksDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementService.findInteractionLinks(query),
    };
  }

  @Post('ai-recommendations')
  @Roles('admin')
  async createAiRecommendation(
    @Body() dto: CreateAiRecommendationDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: 'AI推荐创建成功',
      data: await this.engagementService.createAiRecommendation(dto, currentUser),
    };
  }

  @Get('ai-recommendations')
  @Roles('admin', 'finance', 'approver')
  async findAiRecommendations(@Query() query: QueryAiRecommendationsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementService.findAiRecommendations(query),
    };
  }

  @Get('ai-recommendations/:id')
  @Roles('admin', 'finance', 'approver')
  async findAiRecommendationById(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementService.findAiRecommendationById(id),
    };
  }
}
