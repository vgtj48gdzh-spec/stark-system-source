import { Body, Controller, Get, Param, ParseEnumPipe, ParseIntPipe, Post } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { RequireFormalActorIdentity } from '../../common/decorators/require-formal-actor-identity.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import {
  RepairAuthorityCaptureAction,
  RepairAuthorityCaptureCommandDto,
  RepairAuthorityCaptureFamily,
} from './dto/repair-authority-capture.dto';
import { RepairAuthorityCaptureService } from './repair-authority-capture.service';

const CAPTURE_ROLES = ['group_leader', 'business_owner', 'admin', 'finance', 'founder', 'super_admin', 'owner'];

@Controller('repair-shop')
export class RepairAuthorityCaptureController {
  constructor(private readonly capture: RepairAuthorityCaptureService) {}

  @Get('work-orders/:workOrderId/authority-capture/:family')
  @Roles(...CAPTURE_ROLES)
  @RequireFormalActorIdentity()
  async read(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Param('family', new ParseEnumPipe(RepairAuthorityCaptureFamily)) family: RepairAuthorityCaptureFamily,
    @CurrentUserDecorator() actor: CurrentUser,
  ) {
    return { success: true, message: '正式资料安全视图', data: await this.capture.read(workOrderId, family, actor) };
  }

  // Authority refs identify the command target; do not introduce a second URL
  // workorder identity checked outside the domain-owned mutation transaction.
  @Post('authority-capture/:action')
  @Roles(...CAPTURE_ROLES)
  @RequireFormalActorIdentity()
  async execute(
    @Param('action', new ParseEnumPipe(RepairAuthorityCaptureAction)) action: RepairAuthorityCaptureAction,
    @Body() dto: RepairAuthorityCaptureCommandDto,
    @CurrentUserDecorator() actor: CurrentUser,
  ) {
    return {
      success: true,
      message: '资料阶段操作已完成；不代表贡献、工资或付款已确认',
      data: await this.capture.execute(action, dto.command, actor),
    };
  }
}
