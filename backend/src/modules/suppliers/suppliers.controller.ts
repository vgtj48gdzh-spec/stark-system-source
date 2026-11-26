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
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @Roles('admin')
  @RequireFormalActorIdentity()
  async create(@Body() dto: CreateSupplierDto, @CurrentUserDecorator() currentUser: CurrentUser) {
    return {
      success: true,
      message: '创建供应商成功',
      data: await this.suppliersService.create(dto, currentUser),
    };
  }

  @Get()
  async findAll() {
    return {
      success: true,
      message: '查询成功',
      data: await this.suppliersService.findAll(),
    };
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: '查询成功',
      data: await this.suppliersService.findOne(id),
    };
  }

  @Patch(':id')
  @Roles('admin')
  @RequireFormalActorIdentity()
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSupplierDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '更新供应商成功',
      data: await this.suppliersService.update(id, dto, currentUser),
    };
  }
}
