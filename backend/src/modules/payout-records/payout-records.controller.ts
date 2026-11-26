import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { RequireFormalActorIdentity } from '../../common/decorators/require-formal-actor-identity.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { PaginationQuery } from '../../common/utils/pagination.util';
import { CreatePayoutRecordDto } from './dto/create-payout-record.dto';
import { PayoutRecordsService } from './payout-records.service';

@Controller('payout-records')
export class PayoutRecordsController {
  constructor(private readonly payoutRecordsService: PayoutRecordsService) {}

  @Post()
  @Roles('finance')
  @RequireFormalActorIdentity()
  async create(@Body() dto: CreatePayoutRecordDto, @CurrentUserDecorator() currentUser: CurrentUser) {
    return {
      success: true,
      message: '创建付款记录成功',
      data: await this.payoutRecordsService.create(dto, currentUser),
    };
  }

  @Get()
  async findAll(@Query() query: PaginationQuery) {
    return {
      success: true,
      message: '查询成功',
      data: await this.payoutRecordsService.findAll(query),
    };
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: '查询成功',
      data: await this.payoutRecordsService.findOne(id),
    };
  }
}
