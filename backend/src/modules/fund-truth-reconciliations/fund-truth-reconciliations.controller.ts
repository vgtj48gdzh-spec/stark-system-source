import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { FundTruthReconciliationsService } from './fund-truth-reconciliations.service';
import { QueryFundTruthReconciliationsDto } from './dto/query-fund-truth-reconciliations.dto';

@Controller('fund-truth-reconciliations')
export class FundTruthReconciliationsController {
  constructor(
    private readonly fundTruthReconciliationsService: FundTruthReconciliationsService,
  ) {}

  @Get()
  @Roles('admin', 'finance', 'approver', 'founder', 'super_admin')
  async findAll(
    @Query() query: QueryFundTruthReconciliationsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.fundTruthReconciliationsService.findAll(query, currentUser),
    };
  }

  @Get(':primaryObjectType/:primaryObjectId')
  @Roles('admin', 'finance', 'approver', 'founder', 'super_admin')
  async findOne(
    @Param('primaryObjectType') primaryObjectType: string,
    @Param('primaryObjectId', ParseIntPipe) primaryObjectId: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    if (
      !['approval_request', 'payment_record', 'payout_record', 'abc_sync_fund'].includes(
        primaryObjectType,
      )
    ) {
      throw new BadRequestException('不支持的主对象类型');
    }

    return {
      success: true,
      message: '查询成功',
      data: await this.fundTruthReconciliationsService.findOne(
        primaryObjectType as 'approval_request' | 'payment_record' | 'payout_record' | 'abc_sync_fund',
        primaryObjectId,
        currentUser,
      ),
    };
  }
}
