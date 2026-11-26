import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { ManualNormalizeAbcSyncDto } from '../abc-integration/dto/manual-normalize-abc-sync.dto';
import { AbcSyncService } from './abc-sync.service';
import { CreateAbcAmountRuleDto } from './dto/create-abc-amount-rule.dto';
import { CreateAbcStatusMappingDto } from './dto/create-abc-status-mapping.dto';
import { QueryAbcAmountRulesDto } from './dto/query-abc-amount-rules.dto';
import { QueryAbcStatusMappingsDto } from './dto/query-abc-status-mappings.dto';
import { QueryAbcSyncCardLedgerDto } from './dto/query-abc-sync-card-ledger.dto';
import { QueryAbcSyncCardMappingExceptionsDto } from './dto/query-abc-sync-card-mapping-exceptions.dto';
import { QueryAbcSyncCardsDto } from './dto/query-abc-sync-cards.dto';
import { QueryAbcSyncCheckpointsDto } from './dto/query-abc-sync-checkpoints.dto';
import { QueryAbcSyncDashboardDto } from './dto/query-abc-sync-dashboard.dto';
import { QueryAbcSyncFundsDto } from './dto/query-abc-sync-funds.dto';
import { QueryAbcSyncInventoryLedgerDto } from './dto/query-abc-sync-inventory-ledger.dto';
import { QueryAbcSyncInventoryMappingExceptionsDto } from './dto/query-abc-sync-inventory-mapping-exceptions.dto';
import { QueryAbcSyncJobRunsDto } from './dto/query-abc-sync-job-runs.dto';
import { QueryAbcSyncMaterialsDto } from './dto/query-abc-sync-materials.dto';
import { QueryAbcSyncMappingExceptionsDto } from './dto/query-abc-sync-mapping-exceptions.dto';
import { QueryAbcSyncOrdersDto } from './dto/query-abc-sync-orders.dto';
import { QueryAbcSyncSuppliersDto } from './dto/query-abc-sync-suppliers.dto';
import { QueryAbcSyncWarehousesDto } from './dto/query-abc-sync-warehouses.dto';
import { ToggleAbcRuleDto } from './dto/toggle-abc-rule.dto';
import { UpdateAbcAmountRuleDto } from './dto/update-abc-amount-rule.dto';
import { UpdateAbcStatusMappingDto } from './dto/update-abc-status-mapping.dto';

@Controller('abc-sync')
export class AbcSyncController {
  constructor(private readonly abcSyncService: AbcSyncService) {}

  @Get('dashboard')
  @Roles('finance', 'approver')
  async getDashboard(
    @Query() query: QueryAbcSyncDashboardDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.abcSyncService.getDashboard(query, currentUser),
    };
  }

  @Get('orders')
  @Roles('finance')
  async findOrders(@Query() query: QueryAbcSyncOrdersDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.abcSyncService.findOrders(query),
    };
  }

  @Get('funds')
  @Roles('finance')
  async findFunds(@Query() query: QueryAbcSyncFundsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.abcSyncService.findFunds(query),
    };
  }

  @Get('cards')
  @Roles('finance')
  async findCards(@Query() query: QueryAbcSyncCardsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.abcSyncService.findCards(query),
    };
  }

  @Get('card-ledger')
  @Roles('finance')
  async findCardLedger(@Query() query: QueryAbcSyncCardLedgerDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.abcSyncService.findCardLedger(query),
    };
  }

  @Get('materials')
  @Roles('finance')
  async findMaterials(@Query() query: QueryAbcSyncMaterialsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.abcSyncService.findMaterials(query),
    };
  }

  @Get('suppliers')
  @Roles('finance')
  async findSuppliers(@Query() query: QueryAbcSyncSuppliersDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.abcSyncService.findSuppliers(query),
    };
  }

  @Get('warehouses')
  @Roles('finance')
  async findWarehouses(@Query() query: QueryAbcSyncWarehousesDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.abcSyncService.findWarehouses(query),
    };
  }

  @Get('inventory-ledger')
  @Roles('finance')
  async findInventoryLedger(@Query() query: QueryAbcSyncInventoryLedgerDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.abcSyncService.findInventoryLedger(query),
    };
  }

  @Get('job-runs')
  @Roles('finance', 'approver')
  async findJobRuns(@Query() query: QueryAbcSyncJobRunsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.abcSyncService.findJobRuns(query),
    };
  }

  @Get('checkpoints')
  @Roles('finance', 'approver')
  async findCheckpoints(@Query() query: QueryAbcSyncCheckpointsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.abcSyncService.findCheckpoints(query),
    };
  }

  @Get('mapping-exceptions')
  @Roles('finance', 'approver')
  async findMappingExceptions(@Query() query: QueryAbcSyncMappingExceptionsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.abcSyncService.findMappingExceptions(query),
    };
  }

  @Get('card-mapping-exceptions')
  @Roles('finance')
  async findCardMappingExceptions(@Query() query: QueryAbcSyncCardMappingExceptionsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.abcSyncService.findCardMappingExceptions(query),
    };
  }

  @Get('inventory-mapping-exceptions')
  @Roles('finance')
  async findInventoryMappingExceptions(
    @Query() query: QueryAbcSyncInventoryMappingExceptionsDto,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.abcSyncService.findInventoryMappingExceptions(query),
    };
  }

  @Get('status-mappings')
  @Roles('admin')
  async findStatusMappings(@Query() query: QueryAbcStatusMappingsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.abcSyncService.findStatusMappings(query),
    };
  }

  @Post('status-mappings')
  @Roles('admin')
  async createStatusMapping(
    @Body() dto: CreateAbcStatusMappingDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '状态映射已创建',
      data: await this.abcSyncService.createStatusMapping(dto, currentUser),
    };
  }

  @Patch('status-mappings/:id')
  @Roles('admin')
  async updateStatusMapping(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAbcStatusMappingDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '状态映射已更新',
      data: await this.abcSyncService.updateStatusMapping(id, dto, currentUser),
    };
  }

  @Post('status-mappings/:id/toggle')
  @Roles('admin')
  async toggleStatusMapping(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ToggleAbcRuleDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '状态映射状态已更新',
      data: await this.abcSyncService.toggleStatusMapping(id, dto, currentUser),
    };
  }

  @Get('amount-rules')
  @Roles('admin')
  async findAmountRules(@Query() query: QueryAbcAmountRulesDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.abcSyncService.findAmountRules(query),
    };
  }

  @Post('amount-rules')
  @Roles('admin')
  async createAmountRule(
    @Body() dto: CreateAbcAmountRuleDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '金额规则已创建',
      data: await this.abcSyncService.createAmountRule(dto, currentUser),
    };
  }

  @Patch('amount-rules/:id')
  @Roles('admin')
  async updateAmountRule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAbcAmountRuleDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '金额规则已更新',
      data: await this.abcSyncService.updateAmountRule(id, dto, currentUser),
    };
  }

  @Post('amount-rules/:id/toggle')
  @Roles('admin')
  async toggleAmountRule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ToggleAbcRuleDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '金额规则状态已更新',
      data: await this.abcSyncService.toggleAmountRule(id, dto, currentUser),
    };
  }

  @Post('normalizations/re-run')
  @Roles('admin')
  async rerunNormalization(
    @Body() dto: ManualNormalizeAbcSyncDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '标准化重跑任务已提交',
      data: await this.abcSyncService.runManualNormalization(dto, currentUser),
    };
  }
}
