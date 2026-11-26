import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CompleteMobileDeviceCommandDto } from '../mobile-diagnostics/dto/complete-mobile-device-command.dto';
import { CreateMobileDiagnosticHeartbeatDto } from '../mobile-diagnostics/dto/create-mobile-diagnostic-heartbeat.dto';
import { CreateMobileSmsEventDto } from './dto/create-mobile-sms-event.dto';
import { MobileBridgeService } from './mobile-bridge.service';

type MobileInboxPayload = Partial<CreateMobileSmsEventDto> & {
  sender?: string;
  body?: string;
  receivedAt?: string;
  messageId?: string;
  bodyHash?: string;
};

@Controller('mobile')
export class MobilePublicController {
  constructor(private readonly mobileBridgeService: MobileBridgeService) {}

  @Post('heartbeat')
  @Public()
  async reportHeartbeat(
    @Body() dto: CreateMobileDiagnosticHeartbeatDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-mobile-bridge-token') bridgeToken?: string,
  ) {
    return {
      success: true,
      message: 'Mobile heartbeat saved successfully.',
      data: await this.mobileBridgeService.reportHeartbeat(
        dto,
        this.resolveBridgeToken(authorization, bridgeToken),
      ),
    };
  }

  @Post('sms/inbox')
  @Public()
  async createInboxSms(
    @Body() payload: MobileInboxPayload,
    @Headers('authorization') authorization?: string,
    @Headers('x-mobile-bridge-token') bridgeToken?: string,
  ) {
    const dto = this.toSmsEventDto(payload);
    const result = await this.mobileBridgeService.createSmsEvent(
      dto,
      this.resolveBridgeToken(authorization, bridgeToken),
    );

    return {
      success: true,
      message: 'Mobile inbox SMS saved as raw pending evidence.',
      data: {
        eventId: result.event.id,
        rawSmsId: result.rawSmsId,
        deduplicated: result.deduplicated,
        classifyType: result.classifyType,
        bankSmsTransactionId: result.bankSmsTransactionId,
        status: 'raw_pending_evidence_only',
      },
    };
  }

  @Get('commands')
  @Public()
  async findPendingCommands(
    @Query('deviceId') deviceId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-mobile-bridge-token') bridgeToken?: string,
  ) {
    return {
      success: true,
      message: 'Pending mobile commands retrieved successfully.',
      data: await this.mobileBridgeService.findPendingCommands(
        deviceId,
        this.resolveBridgeToken(authorization, bridgeToken),
      ),
    };
  }

  @Post('commands/:id/complete')
  @Public()
  async completeCommand(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompleteMobileDeviceCommandDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-mobile-bridge-token') bridgeToken?: string,
  ) {
    return {
      success: true,
      message: 'Mobile command completion saved successfully.',
      data: await this.mobileBridgeService.completeCommand(
        id,
        dto,
        this.resolveBridgeToken(authorization, bridgeToken),
      ),
    };
  }

  private resolveBridgeToken(authorization?: string, bridgeToken?: string) {
    const bearerPrefix = 'Bearer ';
    const trimmedAuthorization = authorization?.trim() ?? '';
    if (trimmedAuthorization.startsWith(bearerPrefix)) {
      return trimmedAuthorization.slice(bearerPrefix.length).trim();
    }

    return bridgeToken;
  }

  private toSmsEventDto(payload: MobileInboxPayload): CreateMobileSmsEventDto {
    return {
      deviceId: payload.deviceId ?? '',
      senderAddress: payload.senderAddress ?? payload.sender ?? '',
      messageBody: payload.messageBody ?? payload.body ?? '',
      receivedAtDevice:
        payload.receivedAtDevice ?? payload.receivedAt ?? new Date().toISOString(),
      simSlot: payload.simSlot,
      ingestSource: payload.ingestSource ?? 'inbox_sync',
      smsFormat: payload.smsFormat,
      pduCount: payload.pduCount ?? 1,
      deliveryStatus: payload.deliveryStatus ?? 'pending',
      rawPayloadJson: {
        ...(payload.rawPayloadJson ?? {}),
        deviceSmsId: payload.messageId ?? payload.rawPayloadJson?.deviceSmsId,
        bodyHash: payload.bodyHash ?? payload.rawPayloadJson?.bodyHash,
        hqIngressPath: '/api/mobile/sms/inbox',
        status: 'raw_pending_evidence_only',
      },
    };
  }
}
