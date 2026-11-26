import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { RequireFormalActorIdentity } from '../../common/decorators/require-formal-actor-identity.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { BusinessFoundationService } from './business-foundation.service';
import {
  CreateBusinessCompanyRefDto,
  CreateBusinessScopeGrantDto,
  CreateBusinessSectorDto,
  CreateBusinessStoreDto,
  CreateCompanySectorAssignmentDto,
  CreateCustomerMasterDto,
  CreateCustomerOrganizationRelationshipDto,
  CreateStoreSectorAssignmentDto,
  QueryBusinessCustomersDto,
  UpdateBusinessScopeGrantDto,
} from './dto/business-foundation.dto';

@Controller('business-foundation')
export class BusinessFoundationController {
  constructor(private readonly businessFoundationService: BusinessFoundationService) {}

  @Post('company-refs')
  @Roles('admin')
  @RequireFormalActorIdentity()
  createCompanyRef(
    @Body() dto: CreateBusinessCompanyRefDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('共享公司稳定引用已创建', this.businessFoundationService.createCompanyRef(dto, currentUser));
  }

  @Post('business-sectors')
  @Roles('admin')
  @RequireFormalActorIdentity()
  createSector(
    @Body() dto: CreateBusinessSectorDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('共享业务板块已创建', this.businessFoundationService.createSector(dto, currentUser));
  }

  @Post('company-sector-assignments')
  @Roles('admin')
  @RequireFormalActorIdentity()
  assignCompanySector(
    @Body() dto: CreateCompanySectorAssignmentDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '公司—业务板块关系已创建',
      this.businessFoundationService.assignCompanySector(dto, currentUser),
    );
  }

  @Post('stores')
  @Roles('admin')
  @RequireFormalActorIdentity()
  createStore(
    @Body() dto: CreateBusinessStoreDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('共享门店已创建', this.businessFoundationService.createStore(dto, currentUser));
  }

  @Post('store-sector-assignments')
  @Roles('admin')
  @RequireFormalActorIdentity()
  assignStoreSector(
    @Body() dto: CreateStoreSectorAssignmentDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '门店—业务板块关系已创建',
      this.businessFoundationService.assignStoreSector(dto, currentUser),
    );
  }

  @Post('customers')
  @Roles('admin')
  @RequireFormalActorIdentity()
  createCustomer(
    @Body() dto: CreateCustomerMasterDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('共享客户主档已创建', this.businessFoundationService.createCustomer(dto, currentUser));
  }

  @Post('customer-organization-relationships')
  @Roles('admin')
  @RequireFormalActorIdentity()
  createCustomerRelationship(
    @Body() dto: CreateCustomerOrganizationRelationshipDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '客户—组织业务关系已创建',
      this.businessFoundationService.createCustomerRelationship(dto, currentUser),
    );
  }

  @Post('scope-grants')
  @Roles('admin')
  @RequireFormalActorIdentity()
  createScopeGrant(
    @Body() dto: CreateBusinessScopeGrantDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('共享业务作用域授权已创建', this.businessFoundationService.createScopeGrant(dto, currentUser));
  }

  @Patch('scope-grants/:id')
  @Roles('admin')
  @RequireFormalActorIdentity()
  updateScopeGrant(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBusinessScopeGrantDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('共享业务作用域授权已更新', this.businessFoundationService.updateScopeGrant(id, dto, currentUser));
  }

  @Get('available-scopes')
  @Roles('operator', 'admin')
  listAvailableScopes(@CurrentUserDecorator() currentUser: CurrentUser) {
    return this.wrap('查询成功', this.businessFoundationService.listAvailableScopes(currentUser));
  }

  @Get('customers')
  @Roles('operator', 'admin')
  listSafeCustomers(
    @Query() query: QueryBusinessCustomersDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('查询成功', this.businessFoundationService.listSafeCustomers(query, currentUser));
  }

  private async wrap(message: string, dataPromise: Promise<unknown>) {
    return { success: true, message, data: await dataPromise };
  }
}
