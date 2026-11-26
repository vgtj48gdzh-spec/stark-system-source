import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { RequireFormalActorIdentity } from '../../common/decorators/require-formal-actor-identity.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { BusinessContributionService } from './business-contribution.service';
import {
  ConfirmBusinessContributionDto,
  CreateBusinessContributionCorrectionDto,
  CreateBusinessContributionDto,
  PublishContributionSourceAuthorityDto,
  QueryBusinessContributionsDto,
  QueryContributionAnomaliesDto,
  QueryContributionSourceAuthoritiesDto,
  ResolveBusinessContributionAnomalyDto,
  ReverseBusinessContributionDto,
} from './dto/business-contribution.dto';

const READ_ROLES = [
  'operator',
  'group_leader',
  'business_owner',
  'admin',
  'finance',
  'founder',
  'super_admin',
  'owner',
];
const DRAFT_ROLES = ['group_leader', 'business_owner', 'admin', 'finance', 'founder', 'super_admin', 'owner'];
const CONTROL_ROLES = ['admin', 'finance', 'founder', 'super_admin', 'owner'];

@Controller('group-operations/contributions')
export class BusinessContributionController {
  constructor(private readonly contributionService: BusinessContributionService) {}

  @Get('adapter-contracts')
  @Roles(...READ_ROLES)
  listAdapterContracts() {
    return this.wrap('查询成功', this.contributionService.listAdapterContracts());
  }

  @Post('source-authorities')
  @Roles(...CONTROL_ROLES)
  @RequireFormalActorIdentity()
  publishSourceAuthority(
    @Body() dto: PublishContributionSourceAuthorityDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '贡献来源授权版本已发布',
      this.contributionService.publishSourceAuthority(dto, currentUser),
    );
  }

  @Get('source-authorities')
  @Roles(...READ_ROLES)
  listSourceAuthorities(
    @Query() query: QueryContributionSourceAuthoritiesDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '查询成功',
      this.contributionService.listSourceAuthorities(query, currentUser),
    );
  }

  @Post()
  @Roles(...DRAFT_ROLES)
  @RequireFormalActorIdentity()
  createContribution(
    @Body() dto: CreateBusinessContributionDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '有效贡献草稿已创建，尚未进入经营成绩',
      this.contributionService.createContribution(dto, currentUser),
    );
  }

  @Get()
  @Roles(...READ_ROLES)
  listContributions(
    @Query() query: QueryBusinessContributionsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('查询成功', this.contributionService.listContributions(query, currentUser));
  }

  @Get('groups/:groupId/periods/:recognitionPeriod/summary')
  @Roles(...READ_ROLES)
  getGroupPeriodSummary(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('recognitionPeriod') recognitionPeriod: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '查询成功',
      this.contributionService.getGroupPeriodSummary(groupId, recognitionPeriod, currentUser),
    );
  }

  @Get('anomalies')
  @Roles(...READ_ROLES)
  listAnomalies(
    @Query() query: QueryContributionAnomaliesDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('查询成功', this.contributionService.listAnomalies(query, currentUser));
  }

  @Post('anomalies/:anomalyId/resolve')
  @Roles(...CONTROL_ROLES)
  @RequireFormalActorIdentity()
  resolveAnomaly(
    @Param('anomalyId', ParseIntPipe) anomalyId: number,
    @Body() dto: ResolveBusinessContributionAnomalyDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '贡献重复风险已人工处理',
      this.contributionService.resolveAnomaly(anomalyId, dto, currentUser),
    );
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  getContribution(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('查询成功', this.contributionService.getContribution(id, currentUser));
  }

  @Post(':id/confirm')
  @Roles(...CONTROL_ROLES)
  @RequireFormalActorIdentity()
  confirmContribution(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmBusinessContributionDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '有效贡献已确认并进入经营成绩',
      this.contributionService.confirmContribution(id, dto, currentUser),
    );
  }

  @Post(':id/reverse')
  @Roles(...CONTROL_ROLES)
  @RequireFormalActorIdentity()
  reverseContribution(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReverseBusinessContributionDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '有效贡献冲销记录已确认',
      this.contributionService.reverseContribution(id, dto, currentUser),
    );
  }

  @Post(':id/corrections')
  @Roles(...CONTROL_ROLES)
  @RequireFormalActorIdentity()
  createCorrection(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateBusinessContributionCorrectionDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '贡献更正已按权威发生时间追加到开放期间',
      this.contributionService.createCorrection(id, dto, currentUser),
    );
  }

  private async wrap(message: string, data: unknown) {
    return { success: true, message, data: await data };
  }
}
