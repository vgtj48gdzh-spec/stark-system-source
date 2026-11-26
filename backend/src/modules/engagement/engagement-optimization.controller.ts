import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { CreateFollowupFeedbackDto } from './dto/create-followup-feedback.dto';
import { CreateRecommendationRuleDto } from './dto/create-recommendation-rule.dto';
import { CreateScriptExperimentDto } from './dto/create-script-experiment.dto';
import { CreateScriptTemplateDto } from './dto/create-script-template.dto';
import { QueryFollowupFeedbackDto } from './dto/query-followup-feedback.dto';
import { QueryRecommendationRulesDto } from './dto/query-recommendation-rules.dto';
import { QueryScriptExperimentsDto } from './dto/query-script-experiments.dto';
import { QueryScriptTemplatesDto } from './dto/query-script-templates.dto';
import { ToggleRecommendationRuleDto } from './dto/toggle-recommendation-rule.dto';
import { ToggleScriptTemplateDto } from './dto/toggle-script-template.dto';
import { UpdateRecommendationRuleDto } from './dto/update-recommendation-rule.dto';
import { UpdateScriptTemplateDto } from './dto/update-script-template.dto';
import { EngagementOptimizationService } from './engagement-optimization.service';

@Controller('engagement')
export class EngagementOptimizationController {
  constructor(private readonly engagementOptimizationService: EngagementOptimizationService) {}

  @Get('recommendation-rules')
  @Roles('admin', 'finance')
  async findRecommendationRules(@Query() query: QueryRecommendationRulesDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementOptimizationService.findRecommendationRules(query),
    };
  }

  @Post('recommendation-rules')
  @Roles('admin')
  async createRecommendationRule(
    @Body() dto: CreateRecommendationRuleDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '推荐规则创建成功',
      data: await this.engagementOptimizationService.createRecommendationRule(dto, currentUser),
    };
  }

  @Patch('recommendation-rules/:id')
  @Roles('admin')
  async updateRecommendationRule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRecommendationRuleDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '推荐规则更新成功',
      data: await this.engagementOptimizationService.updateRecommendationRule(id, dto, currentUser),
    };
  }

  @Post('recommendation-rules/:id/toggle')
  @Roles('admin')
  async toggleRecommendationRule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ToggleRecommendationRuleDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '推荐规则状态更新成功',
      data: await this.engagementOptimizationService.toggleRecommendationRule(id, dto, currentUser),
    };
  }

  @Get('script-templates')
  @Roles('admin', 'finance')
  async findScriptTemplates(@Query() query: QueryScriptTemplatesDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementOptimizationService.findScriptTemplates(query),
    };
  }

  @Post('script-templates')
  @Roles('admin')
  async createScriptTemplate(
    @Body() dto: CreateScriptTemplateDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '话术模板创建成功',
      data: await this.engagementOptimizationService.createScriptTemplate(dto, currentUser),
    };
  }

  @Patch('script-templates/:id')
  @Roles('admin')
  async updateScriptTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateScriptTemplateDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '话术模板更新成功',
      data: await this.engagementOptimizationService.updateScriptTemplate(id, dto, currentUser),
    };
  }

  @Post('script-templates/:id/toggle')
  @Roles('admin')
  async toggleScriptTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ToggleScriptTemplateDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '话术模板状态更新成功',
      data: await this.engagementOptimizationService.toggleScriptTemplate(id, dto, currentUser),
    };
  }

  @Get('script-experiments')
  @Roles('admin', 'finance', 'approver')
  async findScriptExperiments(@Query() query: QueryScriptExperimentsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementOptimizationService.findScriptExperiments(query),
    };
  }

  @Post('script-experiments')
  @Roles('admin')
  async createScriptExperiment(
    @Body() dto: CreateScriptExperimentDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '话术实验创建成功',
      data: await this.engagementOptimizationService.createScriptExperiment(dto, currentUser),
    };
  }

  @Get('script-experiments/:id')
  @Roles('admin', 'finance', 'approver')
  async findScriptExperimentById(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementOptimizationService.findScriptExperimentById(id),
    };
  }

  @Get('followup-feedback')
  @Roles('admin', 'finance', 'approver')
  async findFollowupFeedback(@Query() query: QueryFollowupFeedbackDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementOptimizationService.findFollowupFeedback(query),
    };
  }

  @Post('followup-feedback')
  @Roles('admin')
  async createFollowupFeedback(
    @Body() dto: CreateFollowupFeedbackDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '跟进反馈记录成功',
      data: await this.engagementOptimizationService.createFollowupFeedback(dto, currentUser),
    };
  }

  @Get('followup-feedback/:id')
  @Roles('admin', 'finance', 'approver')
  async findFollowupFeedbackById(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementOptimizationService.findFollowupFeedbackById(id),
    };
  }
}
