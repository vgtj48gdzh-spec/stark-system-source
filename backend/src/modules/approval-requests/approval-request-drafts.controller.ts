import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { RequireFormalActorIdentity } from '../../common/decorators/require-formal-actor-identity.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { ApprovalRequestDraftsService } from './approval-request-drafts.service';
import { CreateApprovalRequestDraftFromWarehousePreviewDto } from './dto/create-approval-request-draft-from-warehouse-preview.dto';
import { SubmitApprovalRequestDraftDto } from './dto/submit-approval-request-draft.dto';

@Controller('approval-request-drafts')
export class ApprovalRequestDraftsController {
  constructor(private readonly approvalRequestDraftsService: ApprovalRequestDraftsService) {}

  @Post('warehouse-preview')
  @Roles('finance')
  @RequireFormalActorIdentity()
  async createFromWarehousePreview(
    @Body() dto: CreateApprovalRequestDraftFromWarehousePreviewDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: 'Manual approval draft created',
      data: await this.approvalRequestDraftsService.createFromWarehousePreview(dto, currentUser),
    };
  }

  @Post(':id/submit')
  @Roles('finance')
  @RequireFormalActorIdentity()
  async submit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitApprovalRequestDraftDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '审批草稿已提交，等待独立审批人处理',
      data: await this.approvalRequestDraftsService.submit(id, dto, currentUser),
    };
  }
}
