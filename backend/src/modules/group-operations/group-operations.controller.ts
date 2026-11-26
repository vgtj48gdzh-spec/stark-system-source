import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { RequireFormalActorIdentity } from '../../common/decorators/require-formal-actor-identity.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import {
  AddGroupMemberDto,
  CalculateGroupTargetDto,
  CreateCompensationProfileDto,
  CreateGroupTargetPolicyDto,
  CreateOrganizationGroupDto,
  CreatePayrollCalendarRuleDto,
  EndGroupMemberDto,
  GroupHiringImpactPreviewDto,
  GroupTargetCalculationInputPreviewDto,
  MarginalTargetPreviewDto,
  QueryOrganizationGroupsDto,
} from './dto/group-operations.dto';
import { GroupOperationsService } from './group-operations.service';

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
const MANAGE_ROLES = ['admin', 'founder', 'super_admin', 'owner'];
const TARGET_INPUT_ROLES = [
  'group_leader',
  'business_owner',
  'admin',
  'finance',
  'founder',
  'super_admin',
  'owner',
];

@Controller('group-operations')
export class GroupOperationsController {
  constructor(private readonly groupOperationsService: GroupOperationsService) {}

  @Get('groups')
  @Roles(...READ_ROLES)
  listGroups(
    @Query() query: QueryOrganizationGroupsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('查询成功', this.groupOperationsService.listGroups(query, currentUser));
  }

  @Get('groups/:id')
  @Roles(...READ_ROLES)
  getGroup(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('查询成功', this.groupOperationsService.getGroup(id, currentUser));
  }

  @Post('groups')
  @Roles(...MANAGE_ROLES)
  @RequireFormalActorIdentity()
  createGroup(
    @Body() dto: CreateOrganizationGroupDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('经营小组已创建', this.groupOperationsService.createGroup(dto, currentUser));
  }

  @Post('groups/:id/members')
  @Roles(...MANAGE_ROLES)
  @RequireFormalActorIdentity()
  addMember(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddGroupMemberDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('小组成员关系已创建', this.groupOperationsService.addMember(id, dto, currentUser));
  }

  @Patch('members/:id/end')
  @Roles(...MANAGE_ROLES)
  @RequireFormalActorIdentity()
  endMember(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EndGroupMemberDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('小组成员关系已按生效日结束', this.groupOperationsService.endMember(id, dto, currentUser));
  }

  @Post('employees/:employeeId/compensation-profiles')
  @Roles(...MANAGE_ROLES)
  @RequireFormalActorIdentity()
  createCompensationProfile(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Body() dto: CreateCompensationProfileDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '工资结构版本已创建',
      this.groupOperationsService.createCompensationProfile(employeeId, dto, currentUser),
    );
  }

  @Get('employees/:employeeId/compensation-profiles')
  @Roles(...READ_ROLES)
  listCompensationProfiles(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '查询成功',
      this.groupOperationsService.listCompensationProfiles(employeeId, currentUser),
    );
  }

  @Post('groups/:id/target-policies')
  @Roles(...MANAGE_ROLES)
  @RequireFormalActorIdentity()
  createGroupTargetPolicy(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateGroupTargetPolicyDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '小组当期目标政策版本已发布',
      this.groupOperationsService.createGroupTargetPolicy(id, dto, currentUser),
    );
  }

  @Get('groups/:id/target-policies/:settlementPeriod')
  @Roles(...TARGET_INPUT_ROLES)
  listGroupTargetPolicies(
    @Param('id', ParseIntPipe) id: number,
    @Param('settlementPeriod') settlementPeriod: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '查询成功',
      this.groupOperationsService.listGroupTargetPolicies(id, settlementPeriod, currentUser),
    );
  }

  @Post('payroll-calendar-rules')
  @Roles(...MANAGE_ROLES)
  @RequireFormalActorIdentity()
  createPayrollCalendarRule(
    @Body() dto: CreatePayrollCalendarRuleDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '公司计薪日历规则版本已发布',
      this.groupOperationsService.createPayrollCalendarRule(dto, currentUser),
    );
  }

  @Get('groups/:id/payroll-calendar-rules/:settlementPeriod')
  @Roles(...TARGET_INPUT_ROLES)
  listPayrollCalendarRules(
    @Param('id', ParseIntPipe) id: number,
    @Param('settlementPeriod') settlementPeriod: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '查询成功',
      this.groupOperationsService.listPayrollCalendarRules(id, settlementPeriod, currentUser),
    );
  }

  @Post('marginal-target-preview')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  previewMarginalTarget(@Body() dto: MarginalTargetPreviewDto) {
    return this.wrap('边际目标预览已生成', this.groupOperationsService.previewMarginalTarget(dto));
  }

  @Post('groups/:id/targets/:settlementPeriod/hiring-impact-preview')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  previewGroupHiringImpact(
    @Param('id', ParseIntPipe) id: number,
    @Param('settlementPeriod') settlementPeriod: string,
    @Body() dto: GroupHiringImpactPreviewDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '增员成本与目标影响预览已生成',
      this.groupOperationsService.previewGroupHiringImpact(
        id,
        settlementPeriod,
        dto,
        currentUser,
      ),
    );
  }

  @Post('groups/:id/targets')
  @Roles(...MANAGE_ROLES)
  @RequireFormalActorIdentity()
  calculateGroupTarget(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CalculateGroupTargetDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '小组人工成本与经营保底快照已生成',
      this.groupOperationsService.calculateGroupTarget(id, dto, currentUser),
    );
  }

  @Post('groups/:id/targets/:settlementPeriod/calculation-input-preview')
  @Roles(...TARGET_INPUT_ROLES)
  previewGroupTargetCalculationInput(
    @Param('id', ParseIntPipe) id: number,
    @Param('settlementPeriod') settlementPeriod: string,
    @Body() dto: GroupTargetCalculationInputPreviewDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '小组目标确定性计算输入预览已生成',
      this.groupOperationsService.previewGroupTargetCalculationInput(
        id,
        settlementPeriod,
        dto,
        currentUser,
      ),
    );
  }

  @Get('groups/:id/targets/:settlementPeriod')
  @Roles(...READ_ROLES)
  getLatestGroupTarget(
    @Param('id', ParseIntPipe) id: number,
    @Param('settlementPeriod') settlementPeriod: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '查询成功',
      this.groupOperationsService.getLatestGroupTarget(id, settlementPeriod, currentUser),
    );
  }

  private async wrap(message: string, data: unknown) {
    return { success: true, message, data: await data };
  }
}
