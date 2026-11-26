import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { CreatePlatformConnectorConfigDto } from './dto/create-platform-connector-config.dto';
import { CreatePlatformImportBatchDto } from './dto/create-platform-import-batch.dto';
import { CreatePlatformLeadDto } from './dto/create-platform-lead.dto';
import { QueryPlatformConnectorConfigsDto } from './dto/query-platform-connector-configs.dto';
import { QueryPlatformImportBatchesDto } from './dto/query-platform-import-batches.dto';
import { QueryPlatformImportRecordsDto } from './dto/query-platform-import-records.dto';
import { QueryPlatformLeadsDto } from './dto/query-platform-leads.dto';
import { UpdatePlatformConnectorConfigDto } from './dto/update-platform-connector-config.dto';
import { EngagementImportService } from './engagement-import.service';

@Controller('engagement')
export class EngagementImportController {
  constructor(private readonly engagementImportService: EngagementImportService) {}

  @Post('import-batches')
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  async createImportBatch(
    @Body() dto: CreatePlatformImportBatchDto,
    @UploadedFile() file: { originalname?: string; buffer?: Buffer } | undefined,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '平台导入批次创建成功',
      data: await this.engagementImportService.createImportBatch(dto, file, currentUser),
    };
  }

  @Get('import-batches')
  @Roles('admin', 'finance', 'approver')
  async findImportBatches(@Query() query: QueryPlatformImportBatchesDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementImportService.findImportBatches(query),
    };
  }

  @Get('import-batches/:id')
  @Roles('admin', 'finance', 'approver')
  async findImportBatchById(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementImportService.findImportBatchById(id),
    };
  }

  @Get('import-records')
  @Roles('admin', 'finance', 'approver')
  async findImportRecords(@Query() query: QueryPlatformImportRecordsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementImportService.findImportRecords(query),
    };
  }

  @Get('import-records/:id')
  @Roles('admin', 'finance', 'approver')
  async findImportRecordById(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementImportService.findImportRecordById(id),
    };
  }

  @Post('platform-leads')
  @Roles('admin')
  async createPlatformLead(
    @Body() dto: CreatePlatformLeadDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '平台线索创建成功',
      data: await this.engagementImportService.createPlatformLead(dto, currentUser),
    };
  }

  @Get('platform-leads')
  @Roles('admin', 'finance')
  async findPlatformLeads(@Query() query: QueryPlatformLeadsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementImportService.findPlatformLeads(query),
    };
  }

  @Get('platform-leads/:id')
  @Roles('admin', 'finance')
  async findPlatformLeadById(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementImportService.findPlatformLeadById(id),
    };
  }

  @Get('connector-configs')
  @Roles('admin', 'finance')
  async findConnectorConfigs(@Query() query: QueryPlatformConnectorConfigsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.engagementImportService.findConnectorConfigs(query),
    };
  }

  @Post('connector-configs')
  @Roles('admin')
  async createConnectorConfig(
    @Body() dto: CreatePlatformConnectorConfigDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '连接器配置创建成功',
      data: await this.engagementImportService.createConnectorConfig(dto, currentUser),
    };
  }

  @Patch('connector-configs/:id')
  @Roles('admin')
  async updateConnectorConfig(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlatformConnectorConfigDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '连接器配置更新成功',
      data: await this.engagementImportService.updateConnectorConfig(id, dto, currentUser),
    };
  }
}
