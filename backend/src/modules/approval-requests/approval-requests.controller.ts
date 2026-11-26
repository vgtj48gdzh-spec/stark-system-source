import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { RequireFormalActorIdentity } from '../../common/decorators/require-formal-actor-identity.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { PaginationQuery } from '../../common/utils/pagination.util';
import { ApprovalRequestsService } from './approval-requests.service';
import { ApproveApprovalRequestDto } from './dto/approve-approval-request.dto';
import { CreateApprovalRequestDto } from './dto/create-approval-request.dto';
import { RejectApprovalRequestDto } from './dto/reject-approval-request.dto';

@Controller('approval-requests')
export class ApprovalRequestsController {
  constructor(private readonly approvalRequestsService: ApprovalRequestsService) {}

  @Post()
  @Roles('admin')
  @RequireFormalActorIdentity()
  async create(@Body() dto: CreateApprovalRequestDto, @CurrentUserDecorator() currentUser: CurrentUser) {
    return {
      success: true,
      message: '提交审批成功',
      data: await this.approvalRequestsService.create(dto, currentUser),
    };
  }

  @Get()
  @Roles('finance', 'approver')
  async findAll(@Query() query: PaginationQuery, @CurrentUserDecorator() currentUser: CurrentUser) {
    return {
      success: true,
      message: '查询成功',
      data: await this.approvalRequestsService.findAll(query, currentUser),
    };
  }

  @Get(':id')
  @Roles('finance', 'approver')
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUserDecorator() currentUser: CurrentUser) {
    return {
      success: true,
      message: '查询成功',
      data: await this.approvalRequestsService.findOne(id, currentUser),
    };
  }

  @Get(':id/precheck')
  @Roles('finance', 'approver')
  async getPrecheck(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '预检完成',
      data: await this.approvalRequestsService.getPrecheck(id, currentUser),
    };
  }

  @Post(':id/approve')
  @Roles('approver')
  @RequireFormalActorIdentity()
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveApprovalRequestDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '审批通过成功',
      data: await this.approvalRequestsService.approve(id, dto, currentUser),
    };
  }

  @Post(':id/reject')
  @Roles('approver')
  @RequireFormalActorIdentity()
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectApprovalRequestDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '审批拒绝成功',
      data: await this.approvalRequestsService.reject(id, dto, currentUser),
    };
  }
}
