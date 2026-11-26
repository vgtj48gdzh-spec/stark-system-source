import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { CancelAbcPointsCommandDto } from './dto/cancel-abc-points-command.dto';
import { ConfirmAbcPointsCommandDto } from './dto/confirm-abc-points-command.dto';
import { CreateAbcPointsCommandDraftDto } from './dto/create-abc-points-command-draft.dto';
import { ExecuteAbcPointsCommandDto } from './dto/execute-abc-points-command.dto';
import { QueryAbcPointsCommandsDto } from './dto/query-abc-points-commands.dto';
import { QueryAbcPointsLedgerDto } from './dto/query-abc-points-ledger.dto';
import { PointsService } from './points.service';

@Controller('abc-points')
export class AbcPointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('overview')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async getOverview() {
    return {
      success: true,
      message: 'ABC 积分总览已生成',
      data: await this.pointsService.getAbcPointsOverview(),
    };
  }

  @Get('ledger')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async getLedger(@Query() query: QueryAbcPointsLedgerDto) {
    return {
      success: true,
      message: 'ABC 积分流水查询成功',
      data: await this.pointsService.findAbcPointsLedger(query),
    };
  }

  @Post('commands/draft')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async createDraft(
    @Body() dto: CreateAbcPointsCommandDraftDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: 'ABC 积分命令草稿已创建',
      data: await this.pointsService.createAbcPointsCommandDraft(dto, currentUser),
    };
  }

  @Post('commands/:id/confirm')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async confirm(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmAbcPointsCommandDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: 'ABC 积分命令已人工确认',
      data: await this.pointsService.confirmAbcPointsCommand(id, dto, currentUser),
    };
  }

  @Post('commands/:id/execute')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async execute(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ExecuteAbcPointsCommandDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: 'ABC 积分命令执行结果已返回',
      data: await this.pointsService.executeAbcPointsCommand(id, dto, currentUser),
    };
  }

  @Post('commands/:id/cancel')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelAbcPointsCommandDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: 'ABC 积分命令已取消',
      data: await this.pointsService.cancelAbcPointsCommand(id, dto, currentUser),
    };
  }

  @Get('commands')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async list(
    @Query() query: QueryAbcPointsCommandsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: 'ABC 积分命令列表查询成功',
      data: await this.pointsService.findAbcPointsCommands(query, currentUser),
    };
  }

  @Get('commands/:id/precheck')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async precheck(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: 'ABC 积分命令写入预检已生成',
      data: await this.pointsService.getAbcPointsCommandPrecheck(id, currentUser),
    };
  }

  @Get('commands/:id')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async detail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: 'ABC 积分命令详情查询成功',
      data: await this.pointsService.getAbcPointsCommandDetail(id, currentUser),
    };
  }
}
