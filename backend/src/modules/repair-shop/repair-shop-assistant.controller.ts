import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import {
  CreateRepairAiDraftDto,
  CreateRepairConfirmationRequestDto,
} from './dto/repair-shop.dto';
import { RepairShopService } from './repair-shop.service';

@Controller('assistant/repair-shop')
export class RepairShopAssistantController {
  constructor(private readonly repairShopService: RepairShopService) {}

  @Get('work-orders/:workOrderId')
  async query(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.repairShopService.getAssistantSafeWorkOrder(workOrderId, currentUser);
  }

  @Get('work-orders/:workOrderId/progress')
  async progress(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.repairShopService.getAssistantProgress(workOrderId, currentUser);
  }

  @Post('work-orders/:workOrderId/drafts')
  async createDraft(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Body() dto: CreateRepairAiDraftDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.repairShopService.createAssistantAiDraft(workOrderId, dto, currentUser);
  }

  @Post('work-orders/:workOrderId/confirmation-requests')
  async requestConfirmation(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Body() dto: CreateRepairConfirmationRequestDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.repairShopService.createAssistantConfirmationRequest(
      workOrderId,
      dto,
      currentUser,
    );
  }
}
