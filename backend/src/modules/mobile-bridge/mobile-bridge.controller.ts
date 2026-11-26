import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CompleteMobileDeviceCommandDto } from '../mobile-diagnostics/dto/complete-mobile-device-command.dto';
import { CreateMobileDiagnosticHeartbeatDto } from '../mobile-diagnostics/dto/create-mobile-diagnostic-heartbeat.dto';
import { CreateMobileSmsEventDto } from './dto/create-mobile-sms-event.dto';
import { QueryMobileSmsEventsDto } from './dto/query-mobile-sms-events.dto';
import { MobileBridgeService } from './mobile-bridge.service';

@Controller('mobile-bridge')
export class MobileBridgeController {
  constructor(private readonly mobileBridgeService: MobileBridgeService) {}

  @Get('health')
  @Public()
  async getHealth() {
    return {
      success: true,
      message: 'Mobile bridge health check succeeded.',
      data: this.mobileBridgeService.getHealth(),
    };
  }

  @Get('lan-health')
  @Public()
  async getLanHealth(@Headers('host') requestHost?: string) {
    return {
      success: true,
      message: 'Mobile bridge LAN health check succeeded.',
      data: this.mobileBridgeService.getLanHealth(requestHost),
    };
  }

  @Post('sms-events')
  @Public()
  async createSmsEvent(
    @Body() dto: CreateMobileSmsEventDto,
    @Headers('x-mobile-bridge-token') bridgeToken?: string,
  ) {
    return {
      success: true,
      message: 'Mobile SMS event saved successfully.',
      data: await this.mobileBridgeService.createSmsEvent(dto, bridgeToken),
    };
  }

  @Get('sms-events')
  @Public()
  async findRecentSmsEvents(
    @Query() query: QueryMobileSmsEventsDto,
    @Headers('x-mobile-bridge-token') bridgeToken?: string,
  ) {
    return {
      success: true,
      message: 'Mobile SMS events retrieved successfully.',
      data: await this.mobileBridgeService.findRecentSmsEvents(query, bridgeToken),
    };
  }

  @Post('diagnostics/heartbeat')
  @Public()
  async reportHeartbeat(
    @Body() dto: CreateMobileDiagnosticHeartbeatDto,
    @Headers('x-mobile-bridge-token') bridgeToken?: string,
  ) {
    return {
      success: true,
      message: 'Mobile diagnostics heartbeat saved successfully.',
      data: await this.mobileBridgeService.reportHeartbeat(dto, bridgeToken),
    };
  }

  @Get('commands/pending')
  @Public()
  async findPendingCommands(
    @Query('deviceId') deviceId: string,
    @Headers('x-mobile-bridge-token') bridgeToken?: string,
  ) {
    return {
      success: true,
      message: 'Pending mobile commands retrieved successfully.',
      data: await this.mobileBridgeService.findPendingCommands(deviceId, bridgeToken),
    };
  }

  @Post('commands/:id/complete')
  @Public()
  async completeCommand(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompleteMobileDeviceCommandDto,
    @Headers('x-mobile-bridge-token') bridgeToken?: string,
  ) {
    return {
      success: true,
      message: 'Mobile command completion saved successfully.',
      data: await this.mobileBridgeService.completeCommand(id, dto, bridgeToken),
    };
  }
}
