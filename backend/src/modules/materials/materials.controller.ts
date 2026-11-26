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
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { MaterialsService } from './materials.service';

@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Post()
  @Roles('admin')
  @RequireFormalActorIdentity()
  async create(@Body() dto: CreateMaterialDto, @CurrentUserDecorator() currentUser: CurrentUser) {
    return {
      success: true,
      message: '创建材料成功',
      data: await this.materialsService.create(dto, currentUser),
    };
  }

  @Get()
  async findAll() {
    return {
      success: true,
      message: '查询成功',
      data: await this.materialsService.findAll(),
    };
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: '查询成功',
      data: await this.materialsService.findOne(id),
    };
  }

  @Patch(':id')
  @Roles('admin')
  @RequireFormalActorIdentity()
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMaterialDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '更新材料成功',
      data: await this.materialsService.update(id, dto, currentUser),
    };
  }
}
