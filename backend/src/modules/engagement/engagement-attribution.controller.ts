import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { ConfirmAttributionDto } from './dto/confirm-attribution.dto';
import { GenerateAttributionsDto } from './dto/generate-attributions.dto';
import { GenerateLeadCandidatesDto } from './dto/generate-lead-candidates.dto';
import { QueryAttributionResultsDto } from './dto/query-attribution-results.dto';
import { QueryFollowupSuggestionsDto } from './dto/query-followup-suggestions.dto';
import { QueryLeadCandidatesDto } from './dto/query-lead-candidates.dto';
import { QueryProfileSnapshotsDto } from './dto/query-profile-snapshots.dto';
import { ReassignAttributionDto } from './dto/reassign-attribution.dto';
import { RejectAttributionDto } from './dto/reject-attribution.dto';
import { EngagementAttributionService } from './engagement-attribution.service';

@Controller('engagement')
export class EngagementAttributionController {
  constructor(private readonly engagementAttributionService: EngagementAttributionService) {}

  @Post('lead-candidates/generate')
  @Roles('admin')
  async generateLeadCandidates(
    @Body() dto: GenerateLeadCandidatesDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '线索候选生成成功',
      data: await this.engagementAttributionService.generateLeadCandidates(dto, currentUser),
    };
  }

  @Get('lead-candidates')
  @Roles('admin', 'finance', 'approver')
  async findLeadCandidates(@Query() query: QueryLeadCandidatesDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementAttributionService.findLeadCandidates(query),
    };
  }

  @Get('lead-candidates/:id')
  @Roles('admin', 'finance', 'approver')
  async findLeadCandidateById(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementAttributionService.findLeadCandidateById(id),
    };
  }

  @Post('attributions/generate')
  @Roles('admin')
  async generateAttributions(
    @Body() dto: GenerateAttributionsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '归因结果生成成功',
      data: await this.engagementAttributionService.generateAttributions(dto, currentUser),
    };
  }

  @Get('attributions')
  @Roles('admin', 'finance', 'approver')
  async findAttributions(@Query() query: QueryAttributionResultsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementAttributionService.findAttributions(query),
    };
  }

  @Get('attributions/:id')
  @Roles('admin', 'finance', 'approver')
  async findAttributionById(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementAttributionService.findAttributionById(id),
    };
  }

  @Post('attributions/:id/confirm')
  @Roles('admin')
  async confirmAttribution(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmAttributionDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '归因确认成功',
      data: await this.engagementAttributionService.confirmAttribution(id, dto, currentUser),
    };
  }

  @Post('attributions/:id/reject')
  @Roles('admin')
  async rejectAttribution(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectAttributionDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '归因已拒绝',
      data: await this.engagementAttributionService.rejectAttribution(id, dto, currentUser),
    };
  }

  @Post('attributions/:id/reassign')
  @Roles('admin')
  async reassignAttribution(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReassignAttributionDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '归属调整成功',
      data: await this.engagementAttributionService.reassignAttribution(id, dto, currentUser),
    };
  }

  @Get('profiles/customers')
  @Roles('admin', 'finance', 'approver')
  async findCustomerProfiles(@Query() query: QueryProfileSnapshotsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementAttributionService.findCustomerProfiles(query),
    };
  }

  @Get('profiles/customers/:id')
  @Roles('admin', 'finance', 'approver')
  async findCustomerProfileById(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementAttributionService.findCustomerProfileById(id),
    };
  }

  @Get('profiles/employees')
  @Roles('admin', 'finance', 'approver')
  async findEmployeeProfiles(@Query() query: QueryProfileSnapshotsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementAttributionService.findEmployeeProfiles(query),
    };
  }

  @Get('profiles/employees/:id')
  @Roles('admin', 'finance', 'approver')
  async findEmployeeProfileById(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementAttributionService.findEmployeeProfileById(id),
    };
  }

  @Get('followup-suggestions')
  @Roles('admin', 'finance', 'approver')
  async findFollowupSuggestions(@Query() query: QueryFollowupSuggestionsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementAttributionService.findFollowupSuggestions(query),
    };
  }

  @Get('followup-suggestions/:id')
  @Roles('admin', 'finance', 'approver')
  async findFollowupSuggestionById(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementAttributionService.findFollowupSuggestionById(id),
    };
  }
}
