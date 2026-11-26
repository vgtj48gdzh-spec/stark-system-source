import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { RequireFormalActorIdentity } from '../../common/decorators/require-formal-actor-identity.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { PaginationQuery } from '../../common/utils/pagination.util';
import { AccessWorkOrderCustomerContactDto } from './dto/access-work-order-customer-contact.dto';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { WorkOrdersService } from './work-orders.service';
import { WorkOrderIntakeService } from './work-order-intake.service';
import { CreateWorkOrderIntakeDto } from './dto/create-work-order-intake.dto';
import { UpdateWorkOrderIntakeDetailsDto } from './dto/update-work-order-intake-details.dto';
import { SaveIntakeAssociationDto } from './dto/save-intake-association.dto';
import { SaveIntakeProposalDto } from './dto/save-intake-proposal.dto';

@Controller('work-orders')
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService,
    private readonly intake: WorkOrderIntakeService) {}

  @Get('intake-drafts/stores')
  @RequireFormalActorIdentity()
  @Roles('owner', 'admin', 'operator')
  @Header('Cache-Control', 'no-store')
  async intakeStores(@CurrentUserDecorator() user: CurrentUser) {
    return { success: true, data: await this.intake.stores(user) };
  }

  @Post('intake-drafts')
  @RequireFormalActorIdentity()
  @Roles('owner', 'admin', 'operator')
  @Header('Cache-Control', 'no-store')
  async createIntake(@Body() dto: CreateWorkOrderIntakeDto, @CurrentUserDecorator() user: CurrentUser) {
    return { success: true, message: '待报价接车草稿已保存', data: await this.intake.create(dto, user) };
  }

  @Get('intake-drafts/by-request/:requestId')
  @RequireFormalActorIdentity()
  @Roles('owner', 'admin', 'operator')
  @Header('Cache-Control', 'no-store')
  async findIntakeRequest(@Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
    @CurrentUserDecorator() user: CurrentUser) {
    return { success: true, data: await this.intake.findByRequest(requestId, user) };
  }

  @Get('intake-drafts/:id/capture-summary')
  @RequireFormalActorIdentity()
  @Roles('owner', 'admin', 'operator')
  @Header('Cache-Control', 'no-store')
  async intakeCaptureSummary(@Param('id', ParseIntPipe) id: number, @CurrentUserDecorator() user: CurrentUser) {
    return { success: true, data: await this.intake.captureSummary(id, user) };
  }

  @Get('intake-drafts/:id/association-draft')
  @RequireFormalActorIdentity()
  @Roles('owner', 'admin', 'operator')
  @Header('Cache-Control', 'no-store')
  async findIntakeAssociation(@Param('id', ParseIntPipe) id: number, @CurrentUserDecorator() user: CurrentUser) {
    return { success: true, data: await this.intake.findAssociation(id, user) };
  }

  @Post('intake-drafts/:id/association-draft')
  @RequireFormalActorIdentity()
  @Roles('owner', 'admin', 'operator')
  @Header('Cache-Control', 'no-store')
  async saveIntakeAssociation(@Param('id', ParseIntPipe) id: number, @Body() dto: SaveIntakeAssociationDto,
    @CurrentUserDecorator() user: CurrentUser) {
    return { success: true, data: await this.intake.saveAssociation(id, dto, user) };
  }

  @Get('intake-drafts/:id/proposal-draft')
  @RequireFormalActorIdentity()
  @Roles('owner', 'admin', 'operator')
  @Header('Cache-Control', 'no-store')
  async findIntakeProposal(@Param('id', ParseIntPipe) id: number, @CurrentUserDecorator() user: CurrentUser) {
    return { success: true, data: await this.intake.findProposal(id, user) };
  }

  @Post('intake-drafts/:id/proposal-draft')
  @RequireFormalActorIdentity()
  @Roles('owner', 'admin', 'operator')
  @Header('Cache-Control', 'no-store')
  async saveIntakeProposal(@Param('id', ParseIntPipe) id: number, @Body() dto: SaveIntakeProposalDto,
    @CurrentUserDecorator() user: CurrentUser) {
    return { success: true, data: await this.intake.saveProposal(id, dto, user) };
  }

  @Get('intake-drafts/:id')
  @RequireFormalActorIdentity()
  @Roles('owner', 'admin', 'operator')
  @Header('Cache-Control', 'no-store')
  async findIntake(@Param('id', ParseIntPipe) id: number, @CurrentUserDecorator() user: CurrentUser) {
    return { success: true, data: await this.intake.findOne(id, user) };
  }

  @Patch('intake-drafts/:id/details')
  @RequireFormalActorIdentity()
  @Roles('owner', 'admin', 'operator')
  @Header('Cache-Control', 'no-store')
  async updateIntakeDetails(@Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkOrderIntakeDetailsDto, @CurrentUserDecorator() user: CurrentUser) {
    return { success: true, message: '接车资料已保存，仍待核实', data: await this.intake.updateDetails(id, dto, user) };
  }

  @Post()
  @Roles('operator')
  async create(@Body() dto: CreateWorkOrderDto, @CurrentUserDecorator() currentUser: CurrentUser) {
    return {
      success: true,
      message: '创建工单成功',
      data: await this.workOrdersService.create(dto, currentUser),
    };
  }

  @Get()
  async findAll(
    @Query() query: PaginationQuery,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.workOrdersService.findAll(query, currentUser),
    };
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.workOrdersService.findOne(id, currentUser),
    };
  }

  @Post(':id/customer-contact-access')
  @Roles('owner', 'admin', 'super_admin', 'customer_service')
  @RequireFormalActorIdentity()
  @Header('Cache-Control', 'no-store')
  async accessCustomerContact(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AccessWorkOrderCustomerContactDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '客户联系方式访问已审计',
      data: await this.workOrdersService.accessCustomerContact(id, dto, currentUser),
    };
  }

  @Patch(':id')
  @Roles('operator')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkOrderDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '修改工单成功',
      data: await this.workOrdersService.update(id, dto, currentUser),
    };
  }
}
