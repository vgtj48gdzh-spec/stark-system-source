import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { RequireFormalActorIdentity } from '../../common/decorators/require-formal-actor-identity.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehousesService } from './warehouses.service';

@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Post()
  @Roles('admin')
  @RequireFormalActorIdentity()
  async create(@Body() dto: CreateWarehouseDto, @CurrentUserDecorator() currentUser: CurrentUser) {
    return {
      success: true,
      message: '创建库房成功',
      data: await this.warehousesService.create(dto, currentUser),
    };
  }

  @Get()
  async findAll() {
    return {
      success: true,
      message: '查询成功',
      data: await this.warehousesService.findAll(),
    };
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: '查询成功',
      data: await this.warehousesService.findOne(id),
    };
  }

  @Patch(':id')
  @Roles('admin')
  @RequireFormalActorIdentity()
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWarehouseDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '更新库房成功',
      data: await this.warehousesService.update(id, dto, currentUser),
    };
  }
}
