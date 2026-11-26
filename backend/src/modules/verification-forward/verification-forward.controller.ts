import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { QueryVerificationCodeDispatchDto } from './dto/query-verification-code-dispatch.dto';
import { VerificationForwardService } from './verification-forward.service';

@Controller('security/verification-codes')
export class VerificationForwardController {
  constructor(private readonly verificationForwardService: VerificationForwardService) {}

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
    @Query() query: QueryVerificationCodeDispatchDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '验证码转发记录查询成功',
      data: await this.verificationForwardService.findAll(query, currentUser),
    };
  }

  @Get(':id')
  @Roles(
    'admin',
    'finance',
    'super_admin',
    'owner',
    'finance_manager',
    'finance_operator',
    'auditor',
  )
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '验证码转发详情查询成功',
      data: await this.verificationForwardService.findOne(id, currentUser),
    };
  }
}
