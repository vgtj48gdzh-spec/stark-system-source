import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { RequireFormalActorIdentity } from '../../common/decorators/require-formal-actor-identity.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { CreateWorkOrderMaterialDto } from './dto/create-work-order-material.dto';
import { QueryWorkOrderMaterialsDto } from './dto/query-work-order-materials.dto';
import { UpdateWorkOrderMaterialDto } from './dto/update-work-order-material.dto';
import { WorkOrderMaterialsService } from './work-order-materials.service';

@Controller('work-orders/:workOrderId/materials')
export class WorkOrderMaterialsController {
  constructor(private readonly workOrderMaterialsService: WorkOrderMaterialsService) {}

  @Get()
  @Roles('operator', 'finance')
  async findByWorkOrder(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Query() query: QueryWorkOrderMaterialsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    if (query.includeDeleted && !currentUser.roleCodes.includes('admin')) {
      throw new ForbiddenException('仅管理员可查看已删除工单材料');
    }

    return {
      success: true,
      message: '查询成功',
      data: await this.workOrderMaterialsService.findByWorkOrder(workOrderId, query.includeDeleted),
    };
  }

  @Post()
  @Roles('operator')
  @RequireFormalActorIdentity()
  async create(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Body() dto: CreateWorkOrderMaterialDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '工单添加材料成功',
      data: await this.workOrderMaterialsService.create(workOrderId, dto, currentUser),
    };
  }

  @Patch(':id')
  @Roles('operator')
  @RequireFormalActorIdentity()
  async update(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkOrderMaterialDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '工单材料更新成功',
      data: await this.workOrderMaterialsService.update(workOrderId, id, dto, currentUser),
    };
  }

  @Get(':id/audit')
  @Roles('admin')
  async findAudit(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.workOrderMaterialsService.findAuditTrail(workOrderId, id),
    };
  }

  @Delete(':id')
  @Roles('admin')
  @RequireFormalActorIdentity()
  async remove(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '工单材料删除成功',
      data: await this.workOrderMaterialsService.remove(workOrderId, id, currentUser),
    };
  }
}
