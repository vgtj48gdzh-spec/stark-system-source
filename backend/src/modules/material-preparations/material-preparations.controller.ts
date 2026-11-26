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
import { BindMaterialPreparationDto } from './dto/bind-material-preparation.dto';
import { CreateMaterialPreparationDto } from './dto/create-material-preparation.dto';
import { QueryMaterialPreparationsDto } from './dto/query-material-preparations.dto';
import { MaterialPreparationsService } from './material-preparations.service';

@Controller('material-preparations')
export class MaterialPreparationsController {
  constructor(private readonly materialPreparationsService: MaterialPreparationsService) {}

  @Post()
  @Roles('operator')
  @RequireFormalActorIdentity()
  async create(
    @Body() dto: CreateMaterialPreparationDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '创建备料记录成功',
      data: await this.materialPreparationsService.create(dto, currentUser),
    };
  }

  @Get()
  @Roles('operator', 'finance', 'approver')
  async findAll(@Query() query: QueryMaterialPreparationsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.materialPreparationsService.findAll(query),
    };
  }

  @Get(':id')
  @Roles('operator', 'finance', 'approver')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: '查询成功',
      data: await this.materialPreparationsService.findOne(id),
    };
  }

  @Get(':id/audit')
  @Roles('finance', 'approver')
  async findAudit(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: '查询成功',
      data: await this.materialPreparationsService.findAudit(id),
    };
  }

  @Post(':id/bind-work-order')
  @Roles('admin')
  @RequireFormalActorIdentity()
  async bindWorkOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BindMaterialPreparationDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '备料绑定工单成功',
      data: await this.materialPreparationsService.bindWorkOrder(id, dto, currentUser),
    };
  }
}
