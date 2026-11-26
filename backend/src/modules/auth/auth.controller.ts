import { Controller, Get } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';

@Controller('auth')
export class AuthController {
  @Get('current-user')
  getCurrentUser(@CurrentUserDecorator() currentUser: CurrentUser) {
    return {
      success: true,
      message: '查询成功',
      data: {
        id: currentUser.id,
        username: currentUser.username,
        realName: currentUser.realName,
        roleCodes: currentUser.roleCodes,
        identitySource: currentUser.identitySource,
        formalIdentityBound: currentUser.identitySource === 'trusted_proxy',
      },
    };
  }
}
