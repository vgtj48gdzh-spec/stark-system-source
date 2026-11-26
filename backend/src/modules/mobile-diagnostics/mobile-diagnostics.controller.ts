import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { MobileDiagnosticsService } from './mobile-diagnostics.service';

@Controller('mobile-diagnostics')
export class MobileDiagnosticsController {
  constructor(private readonly mobileDiagnosticsService: MobileDiagnosticsService) {}

  @Get('overview')
  @Roles(
    'admin',
    'finance',
    'super_admin',
    'owner',
    'finance_manager',
    'finance_operator',
    'auditor',
  )
  async getOverview(
    @Query('deviceId') deviceId: string | undefined,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '移动短信诊断概览查询成功',
      data: await this.mobileDiagnosticsService.getOverview(currentUser, deviceId),
    };
  }

  @Post('devices/:deviceId/request-inbox-sync')
  @Roles('admin', 'finance', 'super_admin', 'owner', 'finance_manager', 'finance_operator')
  async requestInboxSync(
    @Param('deviceId') deviceId: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '已下发 inbox sync 指令',
      data: await this.mobileDiagnosticsService.requestCommand(deviceId, 'inbox_sync', currentUser),
    };
  }

  @Post('devices/:deviceId/request-test-upload')
  @Roles('admin', 'finance', 'super_admin', 'owner', 'finance_manager', 'finance_operator')
  async requestTestUpload(
    @Param('deviceId') deviceId: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '已下发测试上传指令',
      data: await this.mobileDiagnosticsService.requestCommand(deviceId, 'test_upload', currentUser),
    };
  }

  @Post('devices/:deviceId/request-backend-rediscovery')
  @Roles('admin', 'finance', 'super_admin', 'owner', 'finance_manager', 'finance_operator')
  async requestBackendRediscovery(
    @Param('deviceId') deviceId: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '已下发后台重新发现指令',
      data: await this.mobileDiagnosticsService.requestCommand(
        deviceId,
        'test_upload',
        currentUser,
        {
          requestedAction: 'backend_rediscover',
          fullSubnetScan: true,
          force: true,
        },
      ),
    };
  }

  @Post('devices/:deviceId/request-switch-discovered-backend')
  @Roles('admin', 'finance', 'super_admin', 'owner', 'finance_manager', 'finance_operator')
  async requestSwitchDiscoveredBackend(
    @Param('deviceId') deviceId: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '已下发切换到已发现后台指令',
      data: await this.mobileDiagnosticsService.requestCommand(
        deviceId,
        'test_upload',
        currentUser,
        {
          requestedAction: 'switch_discovered_backend',
        },
      ),
    };
  }

  @Post('devices/:deviceId/request-pending-queue-retry')
  @Roles('admin', 'finance', 'super_admin', 'owner', 'finance_manager', 'finance_operator')
  async requestPendingQueueRetry(
    @Param('deviceId') deviceId: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '已下发强制重试待上传队列指令，短信队列不会被删除',
      data: await this.mobileDiagnosticsService.requestCommand(
        deviceId,
        'test_upload',
        currentUser,
        {
          requestedAction: 'force_pending_queue_retry',
          pendingQueueDeleted: false,
        },
      ),
    };
  }

  @Post('devices/:deviceId/clear-target-failure')
  @Roles('admin', 'finance', 'super_admin', 'owner', 'finance_manager', 'finance_operator')
  async clearTargetFailure(
    @Param('deviceId') deviceId: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '已清理旧后台 target 失败记录，未删除短信队列',
      data: await this.mobileDiagnosticsService.clearTargetFailureDiagnostics(deviceId, currentUser),
    };
  }
}
