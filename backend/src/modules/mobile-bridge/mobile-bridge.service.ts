import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MessageHubService } from '../message-hub/message-hub.service';
import {
  buildSecurityCredentialBlockedMetadata,
  isOtpOrVerificationSms,
  maskSmsSender,
  REDACTED_SECURITY_CREDENTIAL_BODY,
} from '../message-hub/utils/sms-security.util';
import { CompleteMobileDeviceCommandDto } from '../mobile-diagnostics/dto/complete-mobile-device-command.dto';
import { CreateMobileDiagnosticHeartbeatDto } from '../mobile-diagnostics/dto/create-mobile-diagnostic-heartbeat.dto';
import { MobileDiagnosticsService } from '../mobile-diagnostics/mobile-diagnostics.service';
import {
  appendMobileSmsIngestSourceNormalizationMetadata,
  CreateMobileSmsEventDto,
  isAllowedMobileSmsIngestSource,
  type MobileSmsIngestSource,
  normalizeMobileSmsIngestSource,
} from './dto/create-mobile-sms-event.dto';
import { QueryMobileSmsEventsDto } from './dto/query-mobile-sms-events.dto';
import { MobileSmsEvent } from './entities/mobile-sms-event.entity';
import {
  buildMobileSmsDedupeFingerprint,
  readParsedNumber,
  readParsedString,
  resolveMobileSmsDeviceSmsId,
} from './utils/mobile-sms-dedupe.util';

const DEFAULT_SMS_EVENT_LIMIT = 20;
const DEFAULT_DELIVERY_STATUS = 'received';

@Injectable()
export class MobileBridgeService {
  private readonly logger = new Logger(MobileBridgeService.name);

  constructor(
    @InjectRepository(MobileSmsEvent)
    private readonly mobileSmsEventRepository: Repository<MobileSmsEvent>,
    private readonly configService: ConfigService,
    private readonly messageHubService: MessageHubService,
    private readonly mobileDiagnosticsService: MobileDiagnosticsService,
    private readonly dataSource: DataSource,
  ) {}

  getHealth() {
    return {
      service: 'mobile-bridge',
      status: 'up',
      tokenConfigured: Boolean(this.configService.get<string>('MOBILE_BRIDGE_TOKEN')?.trim()),
      serverTime: new Date().toISOString(),
    };
  }

  getLanHealth(requestHost?: string) {
    const backendPort = this.resolveBackendPort(requestHost);
    return {
      ok: true,
      service: 'stark-mobile-bridge-backend',
      serverTime: new Date().toISOString(),
      version: '0.1.0',
      requestHost: requestHost?.trim() || null,
      backendPort,
      serverId: 'stark-mobile-bridge-local',
    };
  }

  async createSmsEvent(dto: CreateMobileSmsEventDto, bridgeToken?: string) {
    this.assertBridgeToken(bridgeToken);

    if (typeof dto.ingestSource !== 'string' || !dto.ingestSource.trim()) {
      throw new BadRequestException(
        'ingestSource is required and must be one of the following values: live_broadcast, inbox_sync',
      );
    }
    const normalizedIngestSource = normalizeMobileSmsIngestSource(
      dto.ingestSource,
      dto.rawPayloadJson,
    );
    const ingestSource = normalizedIngestSource.ingestSource;
    if (!ingestSource || !isAllowedMobileSmsIngestSource(ingestSource)) {
      throw new BadRequestException(
        'ingestSource is required and must be one of the following values: live_broadcast, inbox_sync',
      );
    }

    const rawPayloadJson = appendMobileSmsIngestSourceNormalizationMetadata(
      dto.rawPayloadJson,
      normalizedIngestSource,
    );
    const deviceId = dto.deviceId.trim();
    const senderAddress = dto.senderAddress.trim();
    const receivedAtDevice = new Date(dto.receivedAtDevice);
    if (isOtpOrVerificationSms(dto.messageBody)) {
      const blockedMetadata = buildSecurityCredentialBlockedMetadata({
        sender: senderAddress,
        body: dto.messageBody,
        deviceId,
        receivedAt: receivedAtDevice,
      });
      const safeSenderAddress = maskSmsSender(senderAddress);
      const blockedRawPayloadJson = {
        ...(rawPayloadJson ?? {}),
        ...blockedMetadata,
        hqIngressPolicy: 'security_credential_body_blocked',
      };
      const dedupeFingerprint = buildMobileSmsDedupeFingerprint({
        deviceId,
        deviceSmsId: resolveMobileSmsDeviceSmsId(blockedRawPayloadJson),
        simSlot: dto.simSlot ?? null,
        senderAddress: safeSenderAddress,
        messageBody: REDACTED_SECURITY_CREDENTIAL_BODY,
        receivedAtDevice,
      });

      let savedEvent = await this.mobileSmsEventRepository.findOne({
        where: {
          deviceId,
          dedupeFingerprint,
        },
      });
      const deduplicated = Boolean(savedEvent);
      if (!savedEvent) {
        savedEvent = await this.mobileSmsEventRepository.save(
          this.mobileSmsEventRepository.create({
            deviceId,
            senderAddress: safeSenderAddress,
            messageBody: REDACTED_SECURITY_CREDENTIAL_BODY,
            deviceSmsId: null,
            dedupeFingerprint,
            receivedAtDevice,
            receivedAtServer: new Date(),
            smsFormat: dto.smsFormat?.trim() ? dto.smsFormat.trim() : null,
            pduCount: dto.pduCount,
            rawPayloadJson: blockedRawPayloadJson,
            deliveryStatus: 'blocked_security_credential',
          }),
        );
      }

      return {
        event: this.toEventView(savedEvent),
        rawSmsId: null,
        classifyType: 'security_credential_blocked',
        deduplicated,
        bankSmsTransactionId: null,
      };
    }

    const mergedRawPayloadJson = {
      ...(rawPayloadJson ?? {}),
      ingestSource,
      simSlot: dto.simSlot ?? null,
    };
    const deviceSmsId = resolveMobileSmsDeviceSmsId(mergedRawPayloadJson);
    const dedupeFingerprint = buildMobileSmsDedupeFingerprint({
      deviceId,
      deviceSmsId,
      simSlot: dto.simSlot ?? null,
      senderAddress,
      messageBody: dto.messageBody,
      receivedAtDevice,
    });

    const inboundInput = {
      deviceId,
      simSlot: dto.simSlot ?? null,
      sender: senderAddress,
      body: dto.messageBody,
      receivedAt: receivedAtDevice,
      deviceSmsId,
      dedupeFingerprint,
      ingestSource,
    } as const;
    let committed: {
      savedEvent: MobileSmsEvent;
      hubResult: Awaited<ReturnType<MessageHubService['processInboundSms']>>;
    };

    try {
      committed = await this.dataSource.transaction(async (manager) => {
        const eventRepository = manager.getRepository(MobileSmsEvent);
        let savedEvent = await this.findExistingSmsEvent(
          eventRepository,
          deviceId,
          deviceSmsId,
          dedupeFingerprint,
        );
        const eventCreatedNow = !savedEvent;

        if (!savedEvent) {
          savedEvent = await eventRepository.save(
            eventRepository.create({
              deviceId,
              senderAddress,
              messageBody: dto.messageBody,
              deviceSmsId,
              dedupeFingerprint,
              receivedAtDevice,
              receivedAtServer: new Date(),
              smsFormat: dto.smsFormat?.trim() ? dto.smsFormat.trim() : null,
              pduCount: dto.pduCount,
              rawPayloadJson: this.mergeRawPayloadJson(
                null,
                mergedRawPayloadJson,
                ingestSource,
              ),
              deliveryStatus: dto.deliveryStatus?.trim() || DEFAULT_DELIVERY_STATUS,
            }),
          );
        }

        const hubResult = await this.messageHubService.processInboundSms(inboundInput, {
          manager,
          mobileEvent: savedEvent,
          eventCreatedNow,
          recordDiagnostics: false,
        });

        return { savedEvent, hubResult };
      });
    } catch (error) {
      if (!this.isPromotionAdmissionUniqueViolation(error)) {
        throw error;
      }
      const savedEvent = await this.findExistingSmsEvent(
        this.mobileSmsEventRepository,
        deviceId,
        deviceSmsId,
        dedupeFingerprint,
      );
      if (!savedEvent) {
        throw error;
      }
      const hubResult = await this.messageHubService.processInboundSms(inboundInput, {
        mobileEvent: savedEvent,
        eventCreatedNow: false,
        recordDiagnostics: false,
      });
      committed = { savedEvent, hubResult };
    }

    const { savedEvent, hubResult } = committed;
    try {
      await this.mobileDiagnosticsService.recordSmsIngestResult({
        deviceId,
        ingestSource,
        result: hubResult.deduplicated ? 'duplicate' : 'stored',
        receivedAt: receivedAtDevice,
      });
    } catch {
      this.logger.warn('SMS ingest committed but diagnostics update failed.');
    }

    return {
      event: this.toEventView(savedEvent),
      rawSmsId: hubResult.raw.id,
      classifyType: hubResult.classification?.classifyType ?? null,
      deduplicated: hubResult.deduplicated,
      bankSmsTransactionId: hubResult.bankSmsTransaction?.id ?? null,
    };
  }

  async findRecentSmsEvents(query: QueryMobileSmsEventsDto, bridgeToken?: string) {
    this.assertBridgeToken(bridgeToken);

    const limit = query.limit ?? DEFAULT_SMS_EVENT_LIMIT;
    const list = await this.mobileSmsEventRepository.find({
      order: {
        receivedAtServer: 'DESC',
        id: 'DESC',
      },
      take: limit,
    });

    return {
      list: list.map((event) => this.toEventView(event)),
      limit,
    };
  }

  async reportHeartbeat(dto: CreateMobileDiagnosticHeartbeatDto, bridgeToken?: string) {
    this.assertBridgeToken(bridgeToken);
    return this.mobileDiagnosticsService.upsertHeartbeat(dto);
  }

  async findPendingCommands(deviceId: string, bridgeToken?: string) {
    this.assertBridgeToken(bridgeToken);
    return this.mobileDiagnosticsService.fetchPendingCommands(deviceId);
  }

  async completeCommand(
    id: number,
    dto: CompleteMobileDeviceCommandDto,
    bridgeToken?: string,
  ) {
    this.assertBridgeToken(bridgeToken);
    return this.mobileDiagnosticsService.completeCommand(id, dto);
  }

  private async findExistingSmsEvent(
    repository: Repository<MobileSmsEvent>,
    deviceId: string,
    deviceSmsId: string | null,
    dedupeFingerprint: string,
  ) {
    const byDeviceSmsId = deviceSmsId
      ? await repository.findOne({
          where: { deviceId, deviceSmsId },
          order: { id: 'ASC' },
        })
      : null;
    if (byDeviceSmsId) {
      return byDeviceSmsId;
    }

    return repository.findOne({
      where: { deviceId, dedupeFingerprint },
      order: { id: 'ASC' },
    });
  }

  private isPromotionAdmissionUniqueViolation(error: unknown) {
    const candidate = error as {
      message?: string;
      driverError?: { code?: string; message?: string; sqlMessage?: string };
    };
    const code = candidate.driverError?.code;
    const message = [
      candidate.message,
      candidate.driverError?.message,
      candidate.driverError?.sqlMessage,
    ]
      .filter((item): item is string => Boolean(item))
      .join(' ');

    return (
      code === 'ER_DUP_ENTRY' &&
      (message.includes('uq_sms_message_raw_promotion_admission_key') ||
        message.includes('uq_sms_message_raw_mobile_sms_event_id'))
    );
  }

  private assertBridgeToken(bridgeToken?: string) {
    const configuredToken = this.configService.get<string>('MOBILE_BRIDGE_TOKEN')?.trim();
    if (!configuredToken) {
      throw new ServiceUnavailableException(
        'MOBILE_BRIDGE_TOKEN is not configured on the server.',
      );
    }

    if (!bridgeToken?.trim() || bridgeToken.trim() !== configuredToken) {
      throw new UnauthorizedException('Invalid mobile bridge token.');
    }
  }

  private resolveBackendPort(requestHost?: string) {
    const configuredPort = Number(this.configService.get<string>('PORT'));
    if (Number.isInteger(configuredPort) && configuredPort > 0) {
      return configuredPort;
    }

    const hostPort = requestHost?.trim().match(/:(\d+)$/)?.[1];
    const parsedHostPort = Number(hostPort);
    if (Number.isInteger(parsedHostPort) && parsedHostPort > 0) {
      return parsedHostPort;
    }

    return 3000;
  }

  private toEventView(event: MobileSmsEvent) {
    return {
      id: event.id,
      deviceId: event.deviceId,
      senderAddress: event.senderAddress,
      messageBody: null,
      messageBodyRedacted: Boolean(event.messageBody),
      rawBodyReturned: false,
      receivedAtDevice: event.receivedAtDevice.toISOString(),
      receivedAtServer: event.receivedAtServer.toISOString(),
      smsFormat: event.smsFormat,
      pduCount: event.pduCount,
      deviceSmsId: event.deviceSmsId,
      dedupeFingerprint: event.dedupeFingerprint,
      rawPayloadJson: event.rawPayloadJson,
      deliveryStatus: event.deliveryStatus,
      createdAt: event.createdAt.toISOString(),
    };
  }

  private mergeRawPayloadJson(
    currentPayload: Record<string, unknown> | null,
    incomingPayload: Record<string, unknown>,
    ingestSource: string,
  ) {
    const mergedPayload: Record<string, unknown> = {
      ...(currentPayload ?? {}),
      ...incomingPayload,
    };
    const existingPaths = Array.isArray(currentPayload?.ingestPaths)
      ? (currentPayload?.ingestPaths as unknown[]).filter((item): item is string => typeof item === 'string')
      : [];
    const existingSource = readParsedString(currentPayload, 'ingestSource');
    const mergedPaths = new Set<string>(existingPaths);
    if (existingSource) {
      mergedPaths.add(existingSource);
    }
    if (ingestSource.trim()) {
      mergedPaths.add(ingestSource.trim());
    }
    if (mergedPaths.size > 0) {
      mergedPayload.ingestPaths = Array.from(mergedPaths);
    }

    const queueEnqueuedAt = readParsedString(incomingPayload, 'queueEnqueuedAt');
    if (queueEnqueuedAt) {
      mergedPayload.queueEnqueuedAt = queueEnqueuedAt;
    }
    const incomingDeviceSmsId =
      resolveMobileSmsDeviceSmsId(incomingPayload) ??
      readParsedString(currentPayload, 'deviceSmsId');
    if (incomingDeviceSmsId) {
      mergedPayload.deviceSmsId = incomingDeviceSmsId;
    }
    const incomingSimSlot =
      readParsedNumber(incomingPayload, 'simSlot') ?? readParsedNumber(currentPayload, 'simSlot');
    if (incomingSimSlot !== null) {
      mergedPayload.simSlot = incomingSimSlot;
    }

    return mergedPayload;
  }
}
