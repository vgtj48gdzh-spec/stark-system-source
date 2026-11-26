import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { PaginationQuery } from '../../common/utils/pagination.util';
import { CreatePaymentRecordDto } from './dto/create-payment-record.dto';
import { PaymentRecordsService } from './payment-records.service';

@Controller('payment-records')
export class PaymentRecordsController {
  constructor(private readonly paymentRecordsService: PaymentRecordsService) {}

  @Post()
  @Roles('finance')
  async create(@Body() dto: CreatePaymentRecordDto, @CurrentUserDecorator() currentUser: CurrentUser) {
    return {
      success: true,
      message: '创建收款记录成功',
      data: await this.paymentRecordsService.create(dto, currentUser),
    };
  }

  @Get()
  @Roles('admin', 'finance', 'approver', 'founder', 'super_admin', 'owner')
  async findAll(
    @Query() query: PaginationQuery,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ): Promise<any> {
    return {
      success: true,
      message: '查询成功',
      data: await this.paymentRecordsService.findAll(query, currentUser),
    };
  }

  @Get(':id/precheck')
  @Roles('admin', 'finance', 'approver', 'founder', 'super_admin', 'owner')
  async getPrecheck(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ): Promise<any> {
    return {
      success: true,
      message: '查询成功',
      data: await this.paymentRecordsService.getPrecheck(id, currentUser),
    };
  }

  @Get(':id')
  @Roles('admin', 'finance', 'approver', 'founder', 'super_admin', 'owner')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ): Promise<any> {
    return {
      success: true,
      message: '查询成功',
      data: await this.paymentRecordsService.findOne(id, currentUser),
    };
  }
}
