import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { AiService } from '../ai/ai.service';
import { QueryAiConsoleOverviewDto } from '../ai/dto/query-ai-console-overview.dto';
import { CancelPointsCommandDto } from './dto/cancel-points-command.dto';
import { CancelPointsRedemptionDto } from './dto/cancel-points-redemption.dto';
import { CancelPointsWelfareBatchDto } from './dto/cancel-points-welfare-batch.dto';
import { ConfirmPointsCommandDto } from './dto/confirm-points-command.dto';
import { ConfirmPointsRedemptionDto } from './dto/confirm-points-redemption.dto';
import { ConfirmPointsWelfareBatchDto } from './dto/confirm-points-welfare-batch.dto';
import { CreatePointsCommandDraftDto } from './dto/create-points-command-draft.dto';
import { CreatePointsRedemptionDraftDto } from './dto/create-points-redemption-draft.dto';
import { CreatePointsWelfareBatchDraftDto } from './dto/create-points-welfare-batch-draft.dto';
import { ExecutePointsCommandDto } from './dto/execute-points-command.dto';
import { ExecutePointsWelfareBatchDto } from './dto/execute-points-welfare-batch.dto';
import { MarkPointsRedemptionFulfilledDto } from './dto/mark-points-redemption-fulfilled.dto';
import { MovePointsWelfareBatchItemDto } from './dto/move-points-welfare-batch-item.dto';
import { PatchPointsWelfareBatchItemDto } from './dto/patch-points-welfare-batch-item.dto';
import { QueryPointsCommandsDto } from './dto/query-points-commands.dto';
import { QueryPointsLedgerDto } from './dto/query-points-ledger.dto';
import { QueryPointsRedeemablesDto } from './dto/query-points-redeemables.dto';
import { QueryPointsRedemptionsDto } from './dto/query-points-redemptions.dto';
import { QueryPointsWelfareBatchItemsDto } from './dto/query-points-welfare-batch-items.dto';
import { QueryPointsWelfareBatchesDto } from './dto/query-points-welfare-batches.dto';
import { QueryPointsWelfarePreviewDto } from './dto/query-points-welfare-preview.dto';
import { PointsService } from './points.service';

@Controller('points')
export class PointsController {
  constructor(
    private readonly pointsService: PointsService,
    private readonly aiService: AiService,
  ) {}

  @Post('commands/draft')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async createDraft(
    @Body() dto: CreatePointsCommandDraftDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '积点命令草稿已创建',
      data: await this.pointsService.createDraft(dto, currentUser),
    };
  }

  @Post('commands/:id/confirm')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async confirmCommand(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmPointsCommandDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '积点命令已确认',
      data: await this.pointsService.confirmCommand(id, dto, currentUser),
    };
  }

  @Post('commands/:id/execute')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async executeCommand(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ExecutePointsCommandDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '积点命令已执行',
      data: await this.pointsService.executeCommand(id, dto, currentUser),
    };
  }

  @Post('commands/:id/cancel')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async cancelCommand(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelPointsCommandDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '积点命令已取消',
      data: await this.pointsService.cancelCommand(id, dto, currentUser),
    };
  }

  @Get('commands')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async findCommands(@Query() query: QueryPointsCommandsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.pointsService.findCommands(query),
    };
  }

  @Get('commands/:id')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async getCommandDetail(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QueryAiConsoleOverviewDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ): Promise<{ success: true; message: string; data: Record<string, unknown> }> {
    const [detail, aiContext] = await Promise.all([
      this.pointsService.getCommandDetail(id),
      this.aiService.getPointsCommandContext(id, query, currentUser),
    ]);

    return {
      success: true,
      message: '查询成功',
      data: {
        ...detail,
        commandExplanation: {
          summary: aiContext.commandExplanation,
          answerSections: aiContext.answerSections,
          confidenceLevel: aiContext.confidenceLevel,
          memoryInfluenceSummary: aiContext.memoryInfluenceSummary,
          nextStepAfterDone: aiContext.nextStepAfterDone,
          whyNow: aiContext.whyNow,
        },
        citedKnowledge: aiContext.citedKnowledge,
        citedFounderMemories: aiContext.founderMemories,
        citedRoleMemories: aiContext.roleMemories,
        citedManualDecisions: aiContext.citedManualDecisions,
        generalizationBoundary: aiContext.generalizationBoundary,
        founderPrinciplesApplied: aiContext.founderPrinciplesApplied,
        rolePlaybookApplied: aiContext.rolePlaybookApplied,
        aiContext,
      },
    };
  }

  @Get('ledger')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async findLedger(@Query() query: QueryPointsLedgerDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.pointsService.findLedger(query),
    };
  }

  @Get('redeemables')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async findRedeemables(@Query() query: QueryPointsRedeemablesDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.pointsService.findRedeemables(query),
    };
  }

  @Post('redemptions/draft')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async createRedemptionDraft(
    @Body() dto: CreatePointsRedemptionDraftDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '积点兑换草稿已创建',
      data: await this.pointsService.createRedemptionDraft(dto, currentUser),
    };
  }

  @Post('redemptions/:id/confirm')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async confirmRedemption(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmPointsRedemptionDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '积点兑换请求已确认',
      data: await this.pointsService.confirmRedemption(id, dto, currentUser),
    };
  }

  @Post('redemptions/:id/mark-fulfilled')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async markRedemptionFulfilled(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MarkPointsRedemptionFulfilledDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '积点兑换请求已标记为 ABC 履约完成',
      data: await this.pointsService.markRedemptionFulfilled(id, dto, currentUser),
    };
  }

  @Post('redemptions/:id/cancel')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async cancelRedemption(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelPointsRedemptionDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '积点兑换请求已取消',
      data: await this.pointsService.cancelRedemption(id, dto, currentUser),
    };
  }

  @Get('redemptions')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async findRedemptions(@Query() query: QueryPointsRedemptionsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.pointsService.findRedemptions(query),
    };
  }

  @Get('redemptions/:id')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async getRedemptionDetail(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QueryAiConsoleOverviewDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ): Promise<{ success: true; message: string; data: Record<string, unknown> }> {
    const [detail, aiContext] = await Promise.all([
      this.pointsService.getRedemptionDetail(id),
      this.aiService.getPointsRedemptionContext(id, query, currentUser),
    ]);

    return {
      success: true,
      message: '查询成功',
      data: {
        ...detail,
        commandExplanation: {
          summary: aiContext.commandExplanation,
          answerSections: aiContext.answerSections,
          confidenceLevel: aiContext.confidenceLevel,
          memoryInfluenceSummary: aiContext.memoryInfluenceSummary,
          nextStepAfterDone: aiContext.nextStepAfterDone,
          whyNow: aiContext.whyNow,
        },
        citedKnowledge: aiContext.citedKnowledge,
        citedFounderMemories: aiContext.founderMemories,
        citedRoleMemories: aiContext.roleMemories,
        citedManualDecisions: aiContext.citedManualDecisions,
        generalizationBoundary: aiContext.generalizationBoundary,
        founderPrinciplesApplied: aiContext.founderPrinciplesApplied,
        rolePlaybookApplied: aiContext.rolePlaybookApplied,
        aiContext,
      },
    };
  }

  @Get('welfare/preview')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async getWelfarePreview(
    @Query() query: QueryPointsWelfarePreviewDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '员工月度福利积点预览已生成',
      data: await this.pointsService.getWelfarePreview(query, currentUser),
    };
  }

  @Post('welfare/batches/draft')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async createWelfareBatchDraft(
    @Body() dto: CreatePointsWelfareBatchDraftDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '员工月度福利积点母单草案已创建',
      data: await this.pointsService.createWelfareBatchDraft(dto, currentUser),
    };
  }

  @Post('welfare/batches/:id/confirm')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async confirmWelfareBatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmPointsWelfareBatchDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '员工月度福利积点母单已确认',
      data: await this.pointsService.confirmWelfareBatch(id, dto, currentUser),
    };
  }

  @Post('welfare/batches/:id/execute')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async executeWelfareBatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ExecutePointsWelfareBatchDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '员工月度福利积点母单已执行',
      data: await this.pointsService.executeWelfareBatch(id, dto, currentUser),
    };
  }

  @Post('welfare/batches/:id/cancel')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async cancelWelfareBatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelPointsWelfareBatchDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '员工月度福利积点母单已取消',
      data: await this.pointsService.cancelWelfareBatch(id, dto, currentUser),
    };
  }

  @Get('welfare/batches')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async findWelfareBatches(
    @Query() query: QueryPointsWelfareBatchesDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.pointsService.findWelfareBatches(query, currentUser),
    };
  }

  @Get('welfare/batches/:id')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async getWelfareBatchDetail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.pointsService.getWelfareBatchDetail(id, currentUser),
    };
  }

  @Get('welfare/batches/:id/items')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async getWelfareBatchItems(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QueryPointsWelfareBatchItemsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.pointsService.getWelfareBatchItems(id, query, currentUser),
    };
  }

  @Patch('welfare/batches/:id/items/:itemId')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async patchWelfareBatchItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: PatchPointsWelfareBatchItemDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '福利批次子项已更新',
      data: await this.pointsService.patchWelfareBatchItem(id, itemId, dto, currentUser),
    };
  }

  @Post('welfare/batches/:id/items/:itemId/move')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async moveWelfareBatchItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: MovePointsWelfareBatchItemDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '福利批次子项分区已调整',
      data: await this.pointsService.moveWelfareBatchItem(id, itemId, dto, currentUser),
    };
  }
}
