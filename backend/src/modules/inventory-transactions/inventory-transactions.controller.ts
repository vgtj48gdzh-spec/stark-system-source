import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { RequireFormalActorIdentity } from '../../common/decorators/require-formal-actor-identity.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { CreateInventoryInboundDto } from './dto/create-inventory-inbound.dto';
import { CreateInventoryOutboundDto } from './dto/create-inventory-outbound.dto';
import { ApplyInventoryAdjustmentDto } from './dto/apply-inventory-adjustment.dto';
import { InventoryMasterDataImportPreflightDto } from './dto/inventory-master-data-import-preflight.dto';
import { QueryInventoryTransactionsDto } from './dto/query-inventory-transactions.dto';
import { RequestInventoryAdjustmentApprovalDto } from './dto/request-inventory-adjustment-approval.dto';
import { InventoryMasterDataPreflightService } from './inventory-master-data-preflight.service';
import { InventoryTransactionsService } from './inventory-transactions.service';

@Controller('inventory-transactions')
export class InventoryTransactionsController {
  constructor(
    private readonly inventoryTransactionsService: InventoryTransactionsService,
    private readonly inventoryMasterDataPreflightService: InventoryMasterDataPreflightService,
  ) {}

  @Post('inbound')
  @Roles('finance')
  @RequireFormalActorIdentity()
  async createInbound(
    @Body() dto: CreateInventoryInboundDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '创建入库记录成功',
      data: await this.inventoryTransactionsService.createInbound(dto, currentUser),
    };
  }

  @Post('outbound')
  @Roles('admin')
  @RequireFormalActorIdentity()
  async createOutbound(
    @Body() dto: CreateInventoryOutboundDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '创建出库记录成功',
      data: await this.inventoryTransactionsService.createOutbound(dto, currentUser),
    };
  }

  @Post('master-data-import-preflight')
  @Roles('admin', 'finance')
  async preflightMasterDataImport(@Body() dto: InventoryMasterDataImportPreflightDto) {
    return {
      success: true,
      message: '主数据导入只读预检完成，未执行任何写入',
      data: await this.inventoryMasterDataPreflightService.preflight(dto),
    };
  }

  @Post(':id/adjustment-approval-requests')
  @Roles('finance')
  @RequireFormalActorIdentity()
  async requestAdjustmentApproval(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RequestInventoryAdjustmentApprovalDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '库存修正审批已提交，库存尚未发生变化',
      data: await this.inventoryTransactionsService.requestAdjustmentApproval(
        id,
        dto,
        currentUser,
      ),
    };
  }

  @Post(':id/adjustments/apply')
  @Roles('admin')
  @RequireFormalActorIdentity()
  async applyApprovedAdjustment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApplyInventoryAdjustmentDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '已按审批生成不可变冲销/调整流水',
      data: await this.inventoryTransactionsService.applyApprovedAdjustment(
        id,
        dto,
        currentUser,
      ),
    };
  }

  @Get()
  @Roles('operator', 'finance')
  async findAll(@Query() query: QueryInventoryTransactionsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.inventoryTransactionsService.findAll(query),
    };
  }

  @Get(':id')
  @Roles('operator', 'finance')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: '查询成功',
      data: await this.inventoryTransactionsService.findOne(id),
    };
  }
}
