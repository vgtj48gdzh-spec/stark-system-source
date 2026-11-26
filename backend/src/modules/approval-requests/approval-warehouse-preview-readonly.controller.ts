import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApprovalWarehousePreviewReadonlyService } from './approval-warehouse-preview-readonly.service';
import { QueryApprovalWarehousePreviewDto } from './dto/query-approval-warehouse-preview.dto';

@Controller('approval-requests/warehouse-preview')
export class ApprovalWarehousePreviewReadonlyController {
  constructor(
    private readonly approvalWarehousePreviewReadonlyService: ApprovalWarehousePreviewReadonlyService,
  ) {}

  @Get()
  @Roles('finance', 'approver')
  async findPreviews(@Query() query: QueryApprovalWarehousePreviewDto) {
    return {
      success: true,
      message: 'Query succeeded',
      data: await this.approvalWarehousePreviewReadonlyService.findPreviews(query),
    };
  }
}
