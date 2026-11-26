import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { RequireFormalActorIdentity } from '../../common/decorators/require-formal-actor-identity.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { QueryBankAccountRegistryDto } from './dto/query-bank-account-registry.dto';
import { ReviewBankAccountRegistryDto } from './dto/review-bank-account-registry.dto';
import { SaveBankAccountRegistryDto } from './dto/save-bank-account-registry.dto';
import { FinanceBankAccountService } from './finance-bank-account.service';

function toPagedResult<T>(result: {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}) {
  return {
    list: result.list,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  };
}

@Controller('finance/bank-accounts')
export class FinanceBankAccountController {
  constructor(private readonly financeBankAccountService: FinanceBankAccountService) {}

  @Get()
  @Roles(
    'admin',
    'finance',
    'super_admin',
    'owner',
    'finance_manager',
    'finance_operator',
    'auditor',
  )
  async findAll(
    @Query() query: QueryBankAccountRegistryDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      data: toPagedResult(await this.financeBankAccountService.findAll(query, currentUser)),
      message: 'Bank accounts retrieved successfully.',
    };
  }

  @Get('pending-messages')
  @Roles(
    'admin',
    'finance',
    'super_admin',
    'owner',
    'finance_manager',
    'finance_operator',
    'auditor',
  )
  async findPendingMessages(
    @Query() query: QueryBankAccountRegistryDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      data: toPagedResult(
        await this.financeBankAccountService.findPendingMessages(query, currentUser),
      ),
      message: 'Pending bank messages retrieved successfully.',
    };
  }

  @Get(':id/review-preview')
  @Roles('super_admin', 'owner', 'finance_manager', 'auditor')
  @RequireFormalActorIdentity()
  async previewReview(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      data: await this.financeBankAccountService.previewReview(id, currentUser),
      message: 'Bank account review preview generated successfully.',
    };
  }

  @Post()
  @Roles('admin', 'finance', 'super_admin', 'owner', 'finance_manager', 'finance_operator')
  @RequireFormalActorIdentity()
  async create(
    @Body() dto: SaveBankAccountRegistryDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      data: await this.financeBankAccountService.create(dto, currentUser),
      message: 'Bank account created successfully.',
    };
  }

  @Post(':id/review')
  @Roles('super_admin', 'owner', 'finance_manager', 'auditor')
  @RequireFormalActorIdentity()
  async review(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewBankAccountRegistryDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      data: await this.financeBankAccountService.review(id, dto, currentUser),
      message: 'Bank account review recorded successfully.',
    };
  }

  @Put(':id')
  @Roles('admin', 'finance', 'super_admin', 'owner', 'finance_manager', 'finance_operator')
  @RequireFormalActorIdentity()
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveBankAccountRegistryDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      data: await this.financeBankAccountService.update(id, dto, currentUser),
      message: 'Bank account updated successfully.',
    };
  }

  @Post(':id/rebind-history')
  @Roles('admin', 'finance', 'super_admin', 'owner', 'finance_manager', 'finance_operator')
  async rebindHistory(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      data: await this.financeBankAccountService.backfill(id, currentUser),
      message: 'Bank account history rebound successfully.',
    };
  }

  @Post(':id/backfill')
  @Roles('admin', 'finance', 'super_admin', 'owner', 'finance_manager', 'finance_operator')
  async backfillAlias(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      data: await this.financeBankAccountService.backfill(id, currentUser),
      message: 'Bank account history rebound successfully.',
    };
  }
}
