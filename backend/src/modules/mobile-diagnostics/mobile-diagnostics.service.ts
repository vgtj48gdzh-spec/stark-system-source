import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { OperationLogAction } from '../../shared/enums/operation-log-action.enum';
import { BankSmsTransaction } from '../finance-bank-sms/entities/bank-sms-transaction.entity';
import { SmsMessageClassification } from '../message-hub/entities/sms-message-classification.entity';
import { SmsMessageRaw } from '../message-hub/entities/sms-message-raw.entity';
import { MobileSmsEvent } from '../mobile-bridge/entities/mobile-sms-event.entity';
import {
  normalizeMobileSmsBody,
  normalizeMobileSmsSender,
  readParsedNumber,
  readParsedString,
} from '../mobile-bridge/utils/mobile-sms-dedupe.util';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { CompleteMobileDeviceCommandDto } from './dto/complete-mobile-device-command.dto';
import { CreateMobileDiagnosticHeartbeatDto } from './dto/create-mobile-diagnostic-heartbeat.dto';
import { MobileDeviceCommand } from './entities/mobile-device-command.entity';
import { MobileDeviceDiagnostic } from './entities/mobile-device-diagnostic.entity';

const WRITE_ROLES = ['admin', 'finance', 'super_admin', 'owner', 'finance_manager', 'finance_operator'] as const;
const READ_ROLES = [...WRITE_ROLES, 'auditor'] as const;

const CARRIER_SENDERS = new Set(['10086', '10010', '10000', '10001', '1008611']);
const LOW_BALANCE_KEYWORDS = ['余额不足', '低余额', '低于', '欠费提醒', '余额仅剩', '请及时充值'];
const STOP_SERVICE_KEYWORDS = ['停机', '停机提醒', '暂停服务', '已欠费', '将停机', '服务已停'];
const RECHARGE_KEYWORDS = ['充值成功', '交费成功', '缴费成功', '充值', '交费', '话费到账'];
const BALANCE_KEYWORDS = ['余额', '账户余额', '剩余话费', '可用余额'];

type DuplicateSample = {
  key: string;
  count: number;
  sources: string[];
  sender: string;
  bodyPreview: string;
};

const LOW_BALANCE_THRESHOLD_CNY = 10;
const DEVICE_ONLINE_SECONDS = 120;
const DEVICE_STALE_SECONDS = 600;
const LOW_BALANCE_KEYWORDS_NORMALIZED = [
  '\u4f59\u989d\u4e0d\u8db3',
  '\u4f4e\u4f59\u989d',
  '\u4f4e\u4e8e',
  '\u4f59\u989d\u4ec5\u5269',
  '\u8bf7\u53ca\u65f6\u5145\u503c',
];
const ARREARS_KEYWORDS = [
  '\u6b20\u8d39',
  '\u6b20\u8d39\u63d0\u9192',
  '\u5df2\u6b20\u8d39',
  '\u8d26\u6237\u4f59\u989d\u4e3a\u8d1f',
];
const STOP_SERVICE_KEYWORDS_NORMALIZED = [
  '\u505c\u673a',
  '\u505c\u673a\u63d0\u9192',
  '\u6682\u505c\u670d\u52a1',
  '\u5c06\u505c\u673a',
  '\u670d\u52a1\u5df2\u505c',
];
const RECHARGE_KEYWORDS_NORMALIZED = [
  '\u5145\u503c\u6210\u529f',
  '\u4ea4\u8d39\u6210\u529f',
  '\u7f34\u8d39\u6210\u529f',
  '\u5145\u503c',
  '\u4ea4\u8d39',
  '\u8bdd\u8d39\u5230\u8d26',
];
const BALANCE_KEYWORDS_NORMALIZED = [
  '\u4f59\u989d',
  '\u8d26\u6237\u4f59\u989d',
  '\u5269\u4f59\u8bdd\u8d39',
  '\u53ef\u7528\u4f59\u989d',
  '\u8bdd\u8d39\u4f59\u989d',
];
const CARRIER_BRAND_KEYWORDS = [
  '\u4e2d\u56fd\u79fb\u52a8',
  '\u4e2d\u56fd\u8054\u901a',
  '\u4e2d\u56fd\u7535\u4fe1',
  '\u8bdd\u8d39',
  '\u505c\u673a',
  '\u5145\u503c',
];

type CarrierCategory =
  | 'balance_info'
  | 'low_balance_candidate'
  | 'arrears_candidate'
  | 'stop_service_candidate'
  | 'recharge'
  | 'carrier_alert';

type DeviceOnlineStatus = 'online' | 'stale' | 'offline' | 'unknown';

type DiagnosticWarning = {
  code: string;
  source: string;
  severity: 'warning';
  message: string;
  reason: string;
};

type DuplicateGroupSampleRecord = {
  rawSmsId: number | null;
  bridgeEventId: number | null;
  sourcePath: string;
  deviceSmsId: string | null;
  dedupeFingerprint: string | null;
  deviceReceivedAt: string | null;
  rawCreatedAt: string | null;
  queueEnqueuedAt: string | null;
  dedupeHit: string;
};

type DuplicateGroupSample = {
  key: string;
  count: number;
  sourcePaths: string[];
  sender: string;
  bodyPreview: string;
  rawSmsIds: number[];
  bridgeEventIds: number[];
  deviceSmsIds: string[];
  dedupeFingerprints: string[];
  sampleRecords: DuplicateGroupSampleRecord[];
};

@Injectable()
export class MobileDiagnosticsService {
  private readonly logger = new Logger(MobileDiagnosticsService.name);

  constructor(
    @InjectRepository(MobileDeviceDiagnostic)
    private readonly mobileDeviceDiagnosticRepository: Repository<MobileDeviceDiagnostic>,
    @InjectRepository(MobileDeviceCommand)
    private readonly mobileDeviceCommandRepository: Repository<MobileDeviceCommand>,
    @InjectRepository(MobileSmsEvent)
    private readonly mobileSmsEventRepository: Repository<MobileSmsEvent>,
    @InjectRepository(SmsMessageRaw)
    private readonly smsMessageRawRepository: Repository<SmsMessageRaw>,
    @InjectRepository(SmsMessageClassification)
    private readonly smsMessageClassificationRepository: Repository<SmsMessageClassification>,
    @InjectRepository(BankSmsTransaction)
    private readonly bankSmsTransactionRepository: Repository<BankSmsTransaction>,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async upsertHeartbeat(dto: CreateMobileDiagnosticHeartbeatDto) {
    let record =
      (await this.mobileDeviceDiagnosticRepository.findOne({
        where: { deviceId: dto.deviceId.trim() },
      })) ?? this.mobileDeviceDiagnosticRepository.create({ deviceId: dto.deviceId.trim() });
    const runtimeSnapshot = this.readObject(dto.runtimeSnapshot);

    if (dto.receiveSmsPermission !== undefined) {
      record.receiveSmsPermission = dto.receiveSmsPermission;
    }
    if (dto.readSmsPermission !== undefined) {
      record.readSmsPermission = dto.readSmsPermission;
    }
    if (dto.deviceReportedAt) {
      record.deviceReportedAt = new Date(dto.deviceReportedAt);
    }
    if (dto.lastBroadcastReceivedAt) {
      record.lastBroadcastReceivedAt = new Date(dto.lastBroadcastReceivedAt);
    }
    if (dto.lastRawSmsIngestResult?.trim()) {
      record.lastRawSmsIngestResult = dto.lastRawSmsIngestResult.trim();
    }
    if (dto.lastRawSmsIngestAt) {
      record.lastRawSmsIngestAt = new Date(dto.lastRawSmsIngestAt);
    }
    if (dto.lastInboxSyncAt) {
      record.lastInboxSyncAt = new Date(dto.lastInboxSyncAt);
    }
    const pendingUploadQueueCount =
      dto.pendingUploadQueueCount ??
      this.readSnapshotNumberList(runtimeSnapshot, [
        'pendingUploadQueueCount',
        'uploadQueueCount',
        'pendingQueueCount',
      ]);
    if (pendingUploadQueueCount !== null) {
      record.pendingUploadQueueCount = Math.max(0, Math.round(pendingUploadQueueCount));
    }
    const lastTestUploadAt =
      dto.lastTestUploadAt ??
      this.readSnapshotStringList(runtimeSnapshot, ['lastTestUploadAt']);
    if (lastTestUploadAt) {
      record.lastTestUploadAt = new Date(lastTestUploadAt);
    }
    const resolvedBaseUrl =
      dto.resolvedBaseUrl?.trim() ||
      this.readSnapshotStringList(runtimeSnapshot, [
        'resolvedBaseUrl',
        'backendTarget',
        'backendBaseUrl',
        'baseUrl',
      ]);
    if (resolvedBaseUrl) {
      record.resolvedBaseUrl = resolvedBaseUrl;
    }
    const baseUrlSource =
      dto.baseUrlSource?.trim() ||
      this.readSnapshotStringList(runtimeSnapshot, [
        'baseUrlSource',
        'resolvedBaseUrlSource',
        'backendTargetSource',
      ]);
    if (baseUrlSource) {
      record.baseUrlSource = baseUrlSource;
    }
    const heartbeatRuntimePatch = this.buildHeartbeatRuntimePatch(dto, runtimeSnapshot);
    if (Object.keys(heartbeatRuntimePatch).length > 0) {
      record.runtimeSnapshotJson = {
        ...(this.readObject(record.runtimeSnapshotJson) ?? {}),
        ...heartbeatRuntimePatch,
      };
    }
    record.lastHeartbeatAt = new Date();

    record = await this.mobileDeviceDiagnosticRepository.save(record);

    return {
      deviceId: record.deviceId,
      lastHeartbeatAt: record.lastHeartbeatAt?.toISOString() ?? null,
    };
  }

  async getHomeClimatePresenceCandidates() {
    const records = await this.mobileDeviceDiagnosticRepository.find({
      order: { lastHeartbeatAt: 'DESC' },
      take: 16,
    });
    return records.map((record) => ({
      zone: this.readSnapshotString(record.runtimeSnapshotJson, 'homeClimatePresenceZone'),
      source: this.readSnapshotString(record.runtimeSnapshotJson, 'homeClimatePresenceSource'),
      observedAt: this.readSnapshotString(
        record.runtimeSnapshotJson,
        'homeClimatePresenceObservedAt',
      ),
      lastHeartbeatAt: record.lastHeartbeatAt,
    }));
  }

  async recordSmsIngestResult(input: {
    deviceId: string;
    ingestSource: 'live_broadcast' | 'inbox_sync';
    result: string;
    receivedAt: Date;
  }) {
    return this.upsertHeartbeat({
      deviceId: input.deviceId,
      lastRawSmsIngestResult: input.result,
      lastRawSmsIngestAt: input.receivedAt.toISOString(),
      lastBroadcastReceivedAt:
        input.ingestSource === 'live_broadcast' ? input.receivedAt.toISOString() : undefined,
      lastInboxSyncAt: input.ingestSource === 'inbox_sync' ? input.receivedAt.toISOString() : undefined,
    });
  }

  async getOverview(currentUser: CurrentUser, deviceId?: string) {
    this.assertReadable(currentUser);
    const diagnosticWarnings: DiagnosticWarning[] = [];

    const diagnostics = await this.readDiagnosticSource(
      diagnosticWarnings,
      'mobile_device_diagnostics',
      () =>
        this.mobileDeviceDiagnosticRepository.find({
          where: deviceId?.trim() ? { deviceId: deviceId.trim() } : undefined,
          order: {
            updatedAt: 'DESC',
            id: 'DESC',
          },
          take: 20,
        }),
      [],
    );

    const activeDeviceId = deviceId?.trim() || diagnostics[0]?.deviceId || null;
    const currentDiagnostic =
      diagnostics.find((item) => item.deviceId === activeDeviceId) ??
      diagnostics[0] ??
      null;

    const recentBridgeEvents = activeDeviceId
      ? await this.readDiagnosticSource(
          diagnosticWarnings,
          'mobile_sms_events_recent',
          () =>
            this.mobileSmsEventRepository.find({
              where: { deviceId: activeDeviceId },
              order: { receivedAtDevice: 'DESC', id: 'DESC' },
              take: 50,
            }),
          [],
        )
      : [];
    const bridgeEventsForAnalysis = activeDeviceId
      ? await this.readDiagnosticSource(
          diagnosticWarnings,
          'mobile_sms_events_analysis',
          () =>
            this.mobileSmsEventRepository.find({
              where: { deviceId: activeDeviceId },
              order: { receivedAtDevice: 'DESC', id: 'DESC' },
              take: 250,
            }),
          [],
        )
      : [];

    const recentRawSms = activeDeviceId
      ? await this.readDiagnosticSource(
          diagnosticWarnings,
          'sms_message_raw_recent',
          () =>
            this.smsMessageRawRepository.find({
              where: { deviceId: activeDeviceId },
              order: { receivedAt: 'DESC', id: 'DESC' },
              take: 50,
            }),
          [],
        )
      : [];
    const rawSmsForAnalysis = activeDeviceId
      ? await this.readDiagnosticSource(
          diagnosticWarnings,
          'sms_message_raw_analysis',
          () =>
            this.smsMessageRawRepository.find({
              where: { deviceId: activeDeviceId },
              order: { receivedAt: 'DESC', id: 'DESC' },
              take: 250,
            }),
          [],
        )
      : [];

    const rawSmsIds = recentRawSms.map((item) => item.id);
    const recentClassifications = rawSmsIds.length
      ? await this.readDiagnosticSource(
          diagnosticWarnings,
          'sms_message_classification_recent',
          () =>
            this.smsMessageClassificationRepository.find({
              where: { rawSmsId: In(rawSmsIds) },
              order: { createdAt: 'DESC', id: 'DESC' },
            }),
          [],
        )
      : [];
    const recentBankTransactions = rawSmsIds.length
      ? await this.readDiagnosticSource(
          diagnosticWarnings,
          'bank_sms_transaction_recent',
          () =>
            this.bankSmsTransactionRepository.find({
              where: { rawSmsId: In(rawSmsIds) },
              order: { createdAt: 'DESC', id: 'DESC' },
            }),
          [],
        )
      : [];
    const pendingCommands = activeDeviceId
      ? await this.readDiagnosticSource(
          diagnosticWarnings,
          'mobile_device_command_pending',
          () =>
            this.mobileDeviceCommandRepository.find({
              where: {
                deviceId: activeDeviceId,
                status: 'pending',
              },
              order: { requestedAt: 'ASC', id: 'ASC' },
            }),
          [],
        )
      : [];
    const recentCommands = activeDeviceId
      ? await this.readDiagnosticSource(
          diagnosticWarnings,
          'mobile_device_command_recent',
          () =>
            this.mobileDeviceCommandRepository.find({
              where: {
                deviceId: activeDeviceId,
              },
              order: { requestedAt: 'DESC', id: 'DESC' },
              take: 20,
            }),
          [],
        )
      : [];

    const classificationByRawSmsId = new Map(recentClassifications.map((item) => [item.rawSmsId, item]));
    const bankTransactionByRawSmsId = new Map(recentBankTransactions.map((item) => [item.rawSmsId, item]));
    const bridgeEventByLooseKey = new Map<string, MobileSmsEvent[]>();
    for (const item of recentBridgeEvents) {
      const key = this.buildLooseBridgeEventKey(item);
      const list = bridgeEventByLooseKey.get(key);
      if (list) {
        list.push(item);
      } else {
        bridgeEventByLooseKey.set(key, [item]);
      }
    }

    const carrierRisk = this.buildDiagnosticSection(
      diagnosticWarnings,
      'carrier_risk_summary',
      () => this.buildCarrierRiskSummary(rawSmsForAnalysis),
      this.buildUnavailableCarrierRiskSummary(),
    );
    const duplicateDiagnostics = this.buildDiagnosticSection(
      diagnosticWarnings,
      'duplicate_diagnostics',
      () =>
        this.buildDuplicateDiagnostics(
          bridgeEventsForAnalysis,
          rawSmsForAnalysis,
          currentDiagnostic,
        ),
      this.buildUnavailableDuplicateDiagnostics(),
    );
    const rawDedupeHitIndex = this.buildRawDedupeHitIndex(rawSmsForAnalysis);
    const bridgeDedupeHitIndex = this.buildBridgeDedupeHitIndex(bridgeEventsForAnalysis, rawSmsForAnalysis);
    const rawLooseSourcePathIndex = this.buildRawLooseSourcePathIndex(rawSmsForAnalysis);
    const latestRawSmsReceivedAt = this.toIsoString(this.readDate(recentRawSms[0]?.receivedAt));
    const latestRawSmsCreatedAt = this.toIsoString(this.readDate(recentRawSms[0]?.createdAt));
    const latestBankTransactionCreatedAt = this.toIsoString(
      this.readDate(recentBankTransactions[0]?.createdAt),
    );

    const devices = diagnostics.map((item) =>
      this.buildDeviceOverview(
        item,
        item.deviceId === activeDeviceId ? carrierRisk : null,
        item.deviceId === activeDeviceId ? duplicateDiagnostics : null,
        item.deviceId === activeDeviceId ? latestRawSmsReceivedAt : null,
        item.deviceId === activeDeviceId ? latestRawSmsCreatedAt : null,
        item.deviceId === activeDeviceId ? latestBankTransactionCreatedAt : null,
      ),
    );
    const currentDeviceOverview =
      devices.find((item) => item.deviceId === activeDeviceId) ?? null;
    const recentCommandDiagnostics = recentCommands.map((item) =>
      this.toCommandDiagnostic(item, currentDeviceOverview?.lastCommandPollAt ?? null),
    );
    const diagnosticConclusion = this.buildDiagnosticConclusion(
      currentDeviceOverview,
      recentCommandDiagnostics,
    );
    const emptyRuntimeOverview = this.buildEmptyRuntimeOverview(diagnosticWarnings);
    const runtimeOverview =
      currentDeviceOverview === null
        ? emptyRuntimeOverview
        : {
            backendTarget: currentDeviceOverview.backendTarget,
            backendTargetSource: currentDeviceOverview.backendTargetSource,
            connectionMode: currentDeviceOverview.connectionMode,
            dependsOnAdbReverse: currentDeviceOverview.dependsOnAdbReverse,
            batteryPercent: currentDeviceOverview.batteryPercent,
            isCharging: currentDeviceOverview.isCharging,
            chargeSource: currentDeviceOverview.chargeSource,
            deviceOnlineStatus: currentDeviceOverview.deviceOnlineStatus,
            lastHeartbeat: currentDeviceOverview.lastHeartbeat,
            lastHeartbeatAgeSeconds: currentDeviceOverview.lastHeartbeatAgeSeconds,
            lastCommandPollAt: currentDeviceOverview.lastCommandPollAt,
            lastCommandPollAgeSeconds: currentDeviceOverview.lastCommandPollAgeSeconds,
            lastInboxSyncAt: currentDeviceOverview.lastInboxSyncAt,
            lastInboxSyncAgeSeconds: currentDeviceOverview.lastInboxSyncAgeSeconds,
            lastSmsReceived: currentDeviceOverview.lastSmsReceived,
            phoneLocalLastSmsAt: currentDeviceOverview.phoneLocalLastSmsAt,
            phoneLocalLastSmsAgeSeconds: currentDeviceOverview.phoneLocalLastSmsAgeSeconds,
            lastUploadSuccess: currentDeviceOverview.lastUploadSuccess,
            lastUploadSuccessAgeSeconds: currentDeviceOverview.lastUploadSuccessAgeSeconds,
            lastUploadFailure: currentDeviceOverview.lastUploadFailure,
            lastUploadFailureAgeSeconds: currentDeviceOverview.lastUploadFailureAgeSeconds,
            lastUploadFailureReason: currentDeviceOverview.lastUploadFailureReason,
            smsMessageRawLatestReceivedAt: currentDeviceOverview.smsMessageRawLatestReceivedAt,
            smsMessageRawLatestCreatedAt: currentDeviceOverview.smsMessageRawLatestCreatedAt,
            bankSmsTransactionLatestCreatedAt: currentDeviceOverview.bankSmsTransactionLatestCreatedAt,
            receiveSmsPermission: currentDeviceOverview.receiveSmsPermission,
            readSmsPermission: currentDeviceOverview.readSmsPermission,
            smsReceivePermission: this.toPermissionStatus(currentDeviceOverview.receiveSmsPermission),
            smsReadPermission: this.toPermissionStatus(currentDeviceOverview.readSmsPermission),
            permissionUnknownReason: currentDeviceOverview.permissionUnknownReason,
            targetReachable: currentDeviceOverview.targetReachable,
            batteryOptimizationStatus: currentDeviceOverview.batteryOptimizationStatus,
            appVisibilityStatus: currentDeviceOverview.appVisibilityStatus,
            serviceRunningStatus: currentDeviceOverview.serviceRunningStatus,
            networkProfile: currentDeviceOverview.networkProfile,
            targetAutoHeal: currentDeviceOverview.targetAutoHeal,
            pendingQueueDrainDiagnostics: currentDeviceOverview.pendingQueueDrainDiagnostics,
            uploadLinkStatus: currentDeviceOverview.smsReceiveStatus?.uploadLinkStatus,
            backendTargetStatus: currentDeviceOverview.smsReceiveStatus?.backendTargetStatus,
            pendingQueueStatus: currentDeviceOverview.smsReceiveStatus?.pendingQueueStatus,
            smsReceiveStatus: currentDeviceOverview.smsReceiveStatus,
            carrierDiagnostics: currentDeviceOverview.carrierDiagnostics,
            pendingUploadQueueCount: currentDeviceOverview.pendingUploadQueueCount,
            oldestPendingAge: currentDeviceOverview.oldestPendingAge,
            runningModeSummary: currentDeviceOverview.runningModeSummary,
            duplicateDiagnostics: currentDeviceOverview.duplicateDiagnostics,
          };

    return {
      devices,
      activeDeviceId,
      degraded: diagnosticWarnings.length > 0,
      diagnosticsUnavailable: diagnosticWarnings.length > 0,
      warnings: diagnosticWarnings,
      diagnosticWarnings,
      diagnosticConclusion,
      bridgeConnectivitySummary: currentDeviceOverview?.bridgeConnectivity ?? emptyRuntimeOverview.bridgeConnectivity,
      deviceHealthSummary: currentDeviceOverview?.deviceHealth ?? emptyRuntimeOverview.deviceHealth,
      runtimeOverview,
      duplicateCauseSummary: duplicateDiagnostics,
      carrierRiskSummary: carrierRisk,
      pendingCommands: pendingCommands.map((item) => ({
        id: item.id,
        commandType: item.commandType,
        requestedAt: this.toIsoString(this.readDate(item.requestedAt)),
        status: item.status,
        fetchedAt: this.readSnapshotString(this.readObject(item.responsePayload), 'fetchedAt'),
        lastFetchedAt: this.readSnapshotString(this.readObject(item.responsePayload), 'lastFetchedAt'),
      })),
      recentCommands: recentCommandDiagnostics,
      recentBridgeEvents: recentBridgeEvents.map((item) => ({
        id: item.id,
        sender: this.maskPotentialSensitiveIdentifier(item.senderAddress),
        body: this.summarizeBody(item.messageBody),
        bodyPreview: this.summarizeBody(item.messageBody),
        deviceReceivedAt: this.toIsoString(this.readDate(item.receivedAtDevice)),
        serverReceivedAt: this.toIsoString(this.readDate(item.receivedAtServer)),
        createdAt: this.toIsoString(this.readDate(item.createdAt)),
        deliveryStatus: item.deliveryStatus,
        sourcePath: this.readBridgeEventSourcePathNormalized(item),
        deviceSmsId: item.deviceSmsId,
        dedupeFingerprint: item.dedupeFingerprint,
        dedupeHit: bridgeDedupeHitIndex.get(item.id) ?? 'none',
        queueEnqueuedAt: readParsedString(item.rawPayloadJson, 'queueEnqueuedAt'),
        ingestPaths: Array.isArray(item.rawPayloadJson?.ingestPaths)
          ? item.rawPayloadJson.ingestPaths
          : null,
      })),
      recentRawSms: recentRawSms.map((item) => ({
        id: item.id,
        sender: this.maskPotentialSensitiveIdentifier(item.sender),
        body: this.summarizeBody(item.body),
        bodyPreview: this.summarizeBody(item.body),
        receivedAt: this.toIsoString(this.readDate(item.receivedAt)),
        createdAt: this.toIsoString(this.readDate(item.createdAt)),
        ingestSource: item.ingestSource,
        sourcePath: item.ingestSource,
        uploadStatus: item.uploadStatus,
        classifyStatus: item.classifyStatus,
        deviceSmsId: item.deviceSmsId,
        dedupeFingerprint: item.dedupeFingerprint,
        dedupeHit: rawDedupeHitIndex.get(item.id) ?? 'none',
      })),
      recentSmsTrace: recentRawSms.map((item) => {
        const bridgeEvent = bridgeEventByLooseKey.get(this.buildLooseRawSmsKey(item))?.[0] ?? null;
        const classification = classificationByRawSmsId.get(item.id) ?? null;
        const transaction = bankTransactionByRawSmsId.get(item.id) ?? null;
        const parsedJson = classification?.parsedJson ?? null;

        return {
          rawSmsId: item.id,
          sender: this.maskPotentialSensitiveIdentifier(item.sender),
          body: this.summarizeBody(item.body),
          bodyPreview: this.summarizeBody(item.body),
          ingestSource: item.ingestSource,
          sourcePath: item.ingestSource,
          dedupeHit: rawDedupeHitIndex.get(item.id) ?? 'none',
          duplicateSourcePaths: rawLooseSourcePathIndex.get(this.buildLooseRawSmsKey(item)) ?? [item.ingestSource],
          uploadStatus: item.uploadStatus,
          classifyStatus: item.classifyStatus,
          rawReceivedAt: this.toIsoString(this.readDate(item.receivedAt)),
          rawCreatedAt: this.toIsoString(this.readDate(item.createdAt)),
          bridgeEventId: bridgeEvent?.id ?? null,
          bridgeReceivedAtDevice: this.toIsoString(this.readDate(bridgeEvent?.receivedAtDevice)),
          bridgeReceivedAtServer: this.toIsoString(this.readDate(bridgeEvent?.receivedAtServer)),
          bridgeCreatedAt: this.toIsoString(this.readDate(bridgeEvent?.createdAt)),
          bridgeSourcePath: bridgeEvent ? this.readBridgeEventSourcePathNormalized(bridgeEvent) : null,
          bridgeDedupeHit: bridgeEvent ? bridgeDedupeHitIndex.get(bridgeEvent.id) ?? 'none' : null,
          queueEnqueuedAt: readParsedString(bridgeEvent?.rawPayloadJson ?? null, 'queueEnqueuedAt'),
          deviceSmsId: bridgeEvent?.deviceSmsId ?? item.deviceSmsId ?? null,
          dedupeFingerprint: bridgeEvent?.dedupeFingerprint ?? item.dedupeFingerprint ?? null,
          classificationId: classification?.id ?? null,
          classificationCreatedAt: this.toIsoString(this.readDate(classification?.createdAt)),
          classifyType: classification?.classifyType ?? null,
          bodyBusinessDate: this.deriveBodyBusinessDate(item.body, item.receivedAt),
          bankBusinessDate:
            readParsedString(parsedJson, 'bankBusinessDate') ??
            this.toIsoString(this.readDate(transaction?.bankBusinessDate)) ??
            null,
          recognizedAccountTail:
            readParsedString(parsedJson, 'accountTail') ?? transaction?.accountTail ?? null,
          recognizedCompanyId:
            readParsedNumber(parsedJson, 'companyId') ?? transaction?.companyId ?? null,
          accountAlias: this.redactDiagnosticText(readParsedString(parsedJson, 'accountAlias')),
          accountHolder: this.redactDiagnosticText(readParsedString(parsedJson, 'accountHolder')),
          bindingSource: readParsedString(parsedJson, 'bindingSource'),
          businessCandidateType: readParsedString(parsedJson, 'businessCandidateType'),
          bankSmsTransactionId: transaction?.id ?? null,
          transactionCreatedAt: this.toIsoString(this.readDate(transaction?.createdAt)),
          transactionSmsReceivedAt: this.toIsoString(this.readDate(transaction?.smsReceivedAt)),
          transactionBankBusinessDate: this.toIsoString(this.readDate(transaction?.bankBusinessDate)),
          reconcileStatus: transaction?.reconcileStatus ?? null,
          direction: transaction?.direction ?? null,
          amount: transaction?.amount ?? null,
        };
      }),
    };
  }

  async requestCommand(
    deviceId: string,
    commandType: 'inbox_sync' | 'test_upload',
    currentUser: CurrentUser,
    commandPayload?: Record<string, unknown>,
  ) {
    this.assertWritable(currentUser);

    const command = await this.mobileDeviceCommandRepository.save(
      this.mobileDeviceCommandRepository.create({
        deviceId: deviceId.trim(),
        commandType,
        status: 'pending',
        requestedBy: currentUser.id,
        requestedAt: new Date(),
        executedAt: null,
        responsePayload: commandPayload ?? null,
      }),
    );

    await this.operationLogsService.create({
      module: 'mobile_diagnostics',
      targetId: command.id,
      action:
        commandType === 'inbox_sync'
          ? OperationLogAction.REQUEST_MOBILE_INBOX_SYNC
          : OperationLogAction.REQUEST_MOBILE_TEST_UPLOAD,
      operatorId: currentUser.id,
      detail: `Issued ${commandType} command to ${deviceId.trim()}`,
      detailJson: commandPayload ?? null,
    });

    return {
      id: command.id,
      deviceId: command.deviceId,
      commandType: command.commandType,
      status: command.status,
      requestedAt: command.requestedAt.toISOString(),
      payload: commandPayload ?? null,
    };
  }

  async clearTargetFailureDiagnostics(deviceId: string, currentUser: CurrentUser) {
    this.assertWritable(currentUser);
    const normalizedDeviceId = deviceId.trim();
    const record = await this.mergeDiagnosticRuntimeSnapshot(normalizedDeviceId, {
      lastFailureTarget: null,
      lastFailureTargetAt: null,
      lastFailureReason: null,
      lastStaleReason: null,
      lastApiFailureAt: null,
      lastApiFailureReason: null,
      lastUploadFailureAt: null,
      lastUploadFailureReason: null,
      targetFailureCount: 0,
      pendingQueueLastRetryReason: null,
      pendingQueueLastPreviousTarget: null,
      pendingQueueBoundToLegacyTarget: false,
      pendingQueueUsesActiveTarget: true,
      pendingQueueDeleted: false,
    });

    await this.operationLogsService.create({
      module: 'mobile_diagnostics',
      targetId: record.id,
      action: 'clear_mobile_target_failure',
      operatorId: currentUser.id,
      detail: `Cleared mobile target failure diagnostics for ${normalizedDeviceId}; pending SMS queue was not deleted.`,
    });

    return {
      deviceId: normalizedDeviceId,
      pendingQueueDeleted: false,
      clearedAt: new Date().toISOString(),
    };
  }

  async fetchPendingCommands(deviceId: string) {
    const normalizedDeviceId = deviceId.trim();
    const list = await this.mobileDeviceCommandRepository.find({
      where: {
        deviceId: normalizedDeviceId,
        status: 'pending',
      },
      order: {
        requestedAt: 'ASC',
        id: 'ASC',
      },
      take: 10,
    });
    const fetchedAt = new Date();
    await this.mergeDiagnosticRuntimeSnapshot(normalizedDeviceId, {
      lastCommandPollAt: fetchedAt.toISOString(),
      lastCommandPollPendingCount: list.length,
    });

    for (const item of list) {
      const responsePayload = this.readObject(item.responsePayload) ?? {};
      item.responsePayload = {
        ...responsePayload,
        fetchedAt: this.readSnapshotString(responsePayload, 'fetchedAt') ?? fetchedAt.toISOString(),
        lastFetchedAt: fetchedAt.toISOString(),
        fetchCount: (this.readSnapshotNumber(responsePayload, 'fetchCount') ?? 0) + 1,
      };
    }
    if (list.length > 0) {
      await this.mobileDeviceCommandRepository.save(list);
    }

    return list.map((item) => ({
      id: item.id,
      commandType: item.commandType,
      requestedAt: item.requestedAt.toISOString(),
      fetchedAt: this.readSnapshotString(this.readObject(item.responsePayload), 'fetchedAt'),
      payload: this.readObject(item.responsePayload),
    }));
  }

  async completeCommand(id: number, dto: CompleteMobileDeviceCommandDto) {
    const command = await this.mobileDeviceCommandRepository.findOne({
      where: { id },
    });
    if (!command) {
      throw new NotFoundException('Mobile device command does not exist.');
    }

    command.status = dto.status;
    command.executedAt = new Date();
    command.responsePayload = {
      ...(this.readObject(command.responsePayload) ?? {}),
      note: dto.note?.trim() || null,
      ...(dto.responsePayload ?? {}),
    };
    await this.mobileDeviceCommandRepository.save(command);
    const responsePayload = this.readObject(command.responsePayload);
    const completedAt =
      this.readSnapshotStringList(responsePayload, ['completedAt', 'executedAt']) ??
      command.executedAt.toISOString();
    const diagnosticPatch: Record<string, unknown> = {
      lastCommandResultAt: command.executedAt.toISOString(),
      lastCommandResultStatus: command.status,
      lastCommandResultType: command.commandType,
      lastCommandResultError:
        command.status === 'failed'
          ? this.readSnapshotStringList(responsePayload, ['reason', 'error', 'message', 'note'])
          : null,
    };
    if (command.commandType === 'inbox_sync') {
      diagnosticPatch.lastInboxSyncAt = completedAt;
    }
    if (command.commandType === 'test_upload') {
      diagnosticPatch.lastTestUploadAt = completedAt;
    }
    const requestedAction = this.readSnapshotString(responsePayload, 'requestedAction');
    if (requestedAction === 'force_pending_queue_retry') {
      const pendingAfter = this.readSnapshotNumber(responsePayload, 'pendingAfter');
      const quarantined = this.readSnapshotNumber(responsePayload, 'quarantined');
      const unreplayable = this.readSnapshotNumber(responsePayload, 'unreplayable');
      const closedMissingPayload = this.readSnapshotNumber(responsePayload, 'closedMissingPayload');
      const scanLimitReached = this.readSnapshotBoolean(responsePayload, 'scanLimitReached');
      const scanLimitUnmatched = this.readSnapshotNumber(responsePayload, 'scanLimitUnmatched');
      const notQuarantinedUnmatched = this.readSnapshotNumber(responsePayload, 'notQuarantinedUnmatched');
      const confirmedMissingPayload = this.readSnapshotNumber(responsePayload, 'confirmedMissingPayload');
      const stillActivePendingAfterBoundedScan = this.readSnapshotBoolean(
        responsePayload,
        'stillActivePendingAfterBoundedScan',
      );
      diagnosticPatch.lastPendingQueueForceRetryAt = completedAt;
      diagnosticPatch.pendingQueueLastFlushStartedAt =
        this.readSnapshotString(responsePayload, 'startedAt') ?? completedAt;
      diagnosticPatch.pendingQueueLastFlushFinishedAt =
        this.readSnapshotString(responsePayload, 'finishedAt') ?? completedAt;
      diagnosticPatch.pendingQueueLastFlushReason =
        this.readSnapshotString(responsePayload, 'triggerReason') ?? requestedAction;
      diagnosticPatch.pendingQueueLastFlushTriggered =
        this.readSnapshotBoolean(responsePayload, 'queueFlushTriggered') ?? true;
      diagnosticPatch.pendingQueueLastFlushPendingBefore =
        this.readSnapshotNumber(responsePayload, 'pendingBefore');
      diagnosticPatch.pendingQueueLastFlushAttempted =
        this.readSnapshotNumber(responsePayload, 'attempted');
      diagnosticPatch.pendingQueueLastFlushSucceeded =
        this.readSnapshotNumber(responsePayload, 'succeeded');
      diagnosticPatch.pendingQueueLastFlushFailed =
        this.readSnapshotNumber(responsePayload, 'failed');
      diagnosticPatch.pendingQueueLastFlushSkippedDuplicate =
        this.readSnapshotNumber(responsePayload, 'skippedDuplicate');
      diagnosticPatch.pendingQueueLastFlushBlocked =
        this.readSnapshotNumber(responsePayload, 'blocked');
      diagnosticPatch.pendingQueueLastFlushPendingAfter = pendingAfter;
      diagnosticPatch.pendingQueueLastFlushActiveTarget =
        this.readSnapshotString(responsePayload, 'activeTarget');
      diagnosticPatch.pendingQueueLastFlushPreviousTarget =
        this.readSnapshotString(responsePayload, 'previousTarget');
      diagnosticPatch.pendingQueueLastActiveTarget =
        this.readSnapshotString(responsePayload, 'activeTarget');
      diagnosticPatch.pendingQueueLastPreviousTarget =
        this.readSnapshotString(responsePayload, 'previousTarget');
      diagnosticPatch.pendingQueueLastRetryAt =
        this.readSnapshotString(responsePayload, 'startedAt') ?? completedAt;
      diagnosticPatch.pendingQueueLastRetryReason =
        this.readSnapshotString(responsePayload, 'triggerReason') ?? requestedAction;
      diagnosticPatch.pendingQueueUsesActiveTarget = true;
      diagnosticPatch.pendingQueueBoundToLegacyTarget = false;
      diagnosticPatch.pendingQueueDeleted = false;
      diagnosticPatch.pendingQueueStatusDistribution = {
        pending: pendingAfter ?? null,
        retry_scheduled: this.readSnapshotNumber(responsePayload, 'failed'),
        blocked: this.readSnapshotNumber(responsePayload, 'blocked'),
        duplicate_skipped: this.readSnapshotNumber(responsePayload, 'skippedDuplicate'),
        uploaded: this.readSnapshotNumber(responsePayload, 'succeeded'),
        quarantined_unreplayable: unreplayable,
        closed_missing_payload: closedMissingPayload,
        scan_limit_reached_not_quarantined: scanLimitUnmatched,
        payload_not_found_in_scan_window: notQuarantinedUnmatched,
      };
      diagnosticPatch.pendingQueueLastScanLimitReached = scanLimitReached;
      diagnosticPatch.pendingQueueLastScanLimitUnmatched = scanLimitUnmatched;
      diagnosticPatch.pendingQueueLastNotQuarantinedUnmatched = notQuarantinedUnmatched;
      diagnosticPatch.pendingQueueLastConfirmedMissingPayload = confirmedMissingPayload;
      diagnosticPatch.pendingQueueStillActiveAfterBoundedScan = stillActivePendingAfterBoundedScan;
      if (quarantined !== null) {
        diagnosticPatch.pendingQueueQuarantinedCount = quarantined;
      }
      if (unreplayable !== null) {
        diagnosticPatch.pendingQueueUnreplayableCount = unreplayable;
      }
      if (closedMissingPayload !== null) {
        diagnosticPatch.pendingQueueClosedMissingPayloadCount = closedMissingPayload;
      }
      const quarantineReason = this.readSnapshotString(responsePayload, 'quarantineReason');
      if (quarantineReason) {
        diagnosticPatch.pendingQueueLastQuarantineReason = quarantineReason;
        diagnosticPatch.pendingQueueLastQuarantineSource = 'system_auto_quarantine';
        diagnosticPatch.pendingQueueLastQuarantinedAt =
          this.readSnapshotString(responsePayload, 'finishedAt') ?? completedAt;
      }
      diagnosticPatch.pendingQueueWaitingBackoff =
        (pendingAfter ?? 0) > 0 &&
        ((this.readSnapshotNumber(responsePayload, 'failed') ?? 0) > 0 ||
          (this.readSnapshotNumber(responsePayload, 'blocked') ?? 0) > (quarantined ?? 0) ||
          stillActivePendingAfterBoundedScan === true);
    }
    await this.mergeDiagnosticRuntimeSnapshot(command.deviceId, diagnosticPatch, (record) => {
      if (command.commandType === 'inbox_sync') {
        record.lastInboxSyncAt = new Date(completedAt);
      }
      if (command.commandType === 'test_upload') {
        record.lastTestUploadAt = new Date(completedAt);
      }
      if (requestedAction === 'force_pending_queue_retry') {
        const pendingAfter = this.readSnapshotNumber(responsePayload, 'pendingAfter');
        if (pendingAfter !== null) {
          record.pendingUploadQueueCount = Math.max(0, Math.round(pendingAfter));
        }
      }
    });

    return {
      id: command.id,
      status: command.status,
      executedAt: command.executedAt.toISOString(),
      durationSeconds: this.deriveDurationSeconds(command.requestedAt, command.executedAt),
    };
  }

  private async readDiagnosticSource<T>(
    warnings: DiagnosticWarning[],
    source: string,
    reader: () => Promise<T>,
    fallback: T,
  ): Promise<T> {
    try {
      return await reader();
    } catch (error) {
      this.addDiagnosticWarning(warnings, source, error);
      return fallback;
    }
  }

  private buildDiagnosticSection<T>(
    warnings: DiagnosticWarning[],
    source: string,
    builder: () => T,
    fallback: T,
  ): T {
    try {
      return builder();
    } catch (error) {
      this.addDiagnosticWarning(warnings, source, error);
      return fallback;
    }
  }

  private addDiagnosticWarning(
    warnings: DiagnosticWarning[],
    source: string,
    error: unknown,
  ) {
    const reason = this.sanitizeDiagnosticErrorReason(error);
    const warning: DiagnosticWarning = {
      code: 'diagnostics_unavailable',
      source,
      severity: 'warning',
      message: `${source} read failed; returning degraded mobile diagnostics instead of HTTP 500.`,
      reason,
    };
    warnings.push(warning);
    this.logger.warn(`${warning.message} reason=${reason}`);
  }

  private sanitizeDiagnosticErrorReason(error: unknown) {
    const maybeError = error as {
      code?: unknown;
      errno?: unknown;
      sqlMessage?: unknown;
      message?: unknown;
    };
    const code =
      typeof maybeError?.code === 'string'
        ? maybeError.code
        : typeof maybeError?.errno === 'number'
          ? `errno_${maybeError.errno}`
          : 'unknown_error';
    const rawMessage =
      typeof maybeError?.sqlMessage === 'string'
        ? maybeError.sqlMessage
        : typeof maybeError?.message === 'string'
          ? maybeError.message
          : 'source unavailable';
    const schemaMessage = rawMessage.match(/Unknown column '([^']+)'/i)?.[0] ??
      rawMessage.match(/Table '[^']+' doesn't exist/i)?.[0] ??
      rawMessage.match(/Unknown table '[^']+'/i)?.[0] ??
      rawMessage.match(/ER_[A-Z0-9_]+/i)?.[0] ??
      'source unavailable or schema incompatible';
    return `${code}: ${schemaMessage}`
      .replace(/token\s*=?\s*[^,\s)]+/gi, 'token=<redacted>')
      .replace(/password\s*=?\s*[^,\s)]+/gi, 'password=<redacted>')
      .replace(/\b\d{11,}\b/g, '<redacted-number>');
  }

  private buildUnavailableSection(source: string) {
    return {
      status: 'unavailable',
      source,
      warning: 'diagnostics_unavailable',
    };
  }

  private buildUnavailableCarrierRiskSummary() {
    return {
      balanceSmsDetected: false,
      lowBalanceCandidate: false,
      arrearsCandidate: false,
      stopServiceCandidate: false,
      lowBalanceRisk: false,
      stopServiceRisk: false,
      latestBalanceAmount: null,
      latestBalanceObservedAt: null,
      lastRechargeSmsTime: null,
      classificationRules: {
        carrier: '10086',
        lowBalanceCandidateRule:
          'balance amount <= 10 CNY, or low-balance keywords are present',
        arrearsCandidateRule:
          'balance amount < 0 CNY, or arrears keywords are present',
        stopServiceCandidateRule:
          'stop-service keywords are present',
        thresholds: {
          lowBalanceLessThanOrEqualCny: LOW_BALANCE_THRESHOLD_CNY,
          arrearsLessThanCny: 0,
        },
      },
      recentCarrierAlertSummary: [],
      status: 'unavailable',
      warning: 'diagnostics_unavailable',
    };
  }

  private buildUnavailableDuplicateDiagnostics() {
    const unavailableSample = {
      groupCount: 0,
      proof: 'diagnostics_unavailable',
      sampleGroups: [],
    };
    return {
      uiProjectionDuplicate: {
        count: 0,
        note: 'diagnostics_unavailable',
      },
      dualPathDuplicate: unavailableSample,
      uploadRetryDuplicate: {
        groupCount: 0,
        pendingUploadQueueCount: 0,
        lastUploadFailureReason: null,
        queueItemCountDetail: this.buildEmptyQueueItemCountDetail(),
        sampleGroups: [],
      },
      databaseTrueDuplicate: {
        bridgeEventGroupCount: 0,
        rawSmsGroupCount: 0,
        note: 'diagnostics_unavailable',
        bridgeEventSamples: [],
        rawSmsSamples: [],
      },
      dualPathVsRawLooseComparison: {
        legacyRawDbLooseGroupCount: 0,
        dualPathGroupCount: 0,
        matchedGroupCount: 0,
        oneToOne: true,
        note: 'diagnostics_unavailable',
      },
      dedupeKeyPolicy: {
        primary: 'deviceId + deviceSmsId',
        fallback: 'deviceId + simSlot + sender + deviceReceivedAt + normalizedBody',
        singleUpsertEntry:
          'MobileBridgeService.createSmsEvent -> MessageHubService.processInboundSms -> ingestSmsMessage',
        singleUpsertProof: 'diagnostics_unavailable',
        safeHistoricalDedupPlan: [],
      },
      queueItemCountDetail: this.buildEmptyQueueItemCountDetail(),
      duplicateGroupSamples: [],
      status: 'unavailable',
      warning: 'diagnostics_unavailable',
    };
  }

  private buildEmptyQueueItemCountDetail() {
    return {
      runtimePendingUploadQueueCount: 0,
      recentBridgeEventsWithQueueTimestamp: 0,
      recentRawSmsWithoutDeviceSmsId: 0,
      recentRawSmsByUploadStatus: [],
    };
  }

  private buildEmptyRuntimeOverview(warnings: DiagnosticWarning[]) {
    const smsReceiveStatus = {
      uploadLinkStatus: 'unknown',
      backendTargetStatus: 'unknown',
      pendingQueueStatus: 'pending_queue_empty',
      smsReceiveCapability: 'unknown',
      smsReceiveUnavailableReason: warnings.length > 0 ? 'diagnostics_unavailable' : null,
      smsReceiveIdleReason: null,
      carrierStatus: 'carrier_available_or_unknown',
      diagnosticStatuses: warnings.length > 0
        ? ['diagnostics_unavailable', 'sms_receive_permission_unknown']
        : ['sms_receive_permission_unknown'],
      testUploadAffected: false,
      commandPollingAffected: false,
      healthCheckAffected: false,
    };
    const carrierDiagnostics = {
      simPresent: null,
      simPresentStatus: 'unknown',
      simState: 'unknown',
      slotState: null,
      serviceState: 'unknown',
      isRoaming: null,
      networkOperatorName: null,
      signalStrength: null,
      dataNetworkType: null,
      phoneStatePermission: null,
      receiveSmsPermission: 'unknown',
      readSmsPermission: 'unknown',
      defaultSmsAppRestricted: null,
      smsReceiveCapability: 'unknown',
      smsReceiveUnavailableReason: warnings.length > 0 ? 'diagnostics_unavailable' : null,
      smsReceiveIdleReason: null,
      smsReceivePrerequisitesSatisfied: false,
      lastSystemSmsReceivedAt: null,
      lastReceiverTriggeredAt: null,
      lastInboxScanAt: null,
      diagnosticStatuses: smsReceiveStatus.diagnosticStatuses,
    };
    const pendingQueueDrainDiagnostics = {
      statusCode: 'pending_queue_empty',
      autoDrainRecommended: false,
      autoDrainTriggerExpected: false,
      targetReachable: false,
      uploadSuccessNewerThanFailure: false,
      pendingUploadQueueCount: 0,
      currentActiveTarget: null,
      lastFailureTarget: null,
      oldTargetDetected: false,
      oldFailureTarget: false,
      previousRetryTargetMismatch: false,
      flushActiveTargetMismatch: false,
      retried: false,
      retriedStillPending: false,
      drainFailed: false,
      quarantinedCount: 0,
      unreplayableCount: 0,
      closedMissingPayloadCount: 0,
      manualReviewNeeded: false,
      scanLimitReachedNotQuarantined: false,
      scanLimitUnmatchedCount: 0,
      notQuarantinedUnmatchedCount: 0,
      confirmedMissingPayloadCount: 0,
      stillActivePendingAfterBoundedScan: false,
      safeBoundary:
        'mobile diagnostics only; empty runtime output does not confirm finance state.',
    };
    const targetAutoHeal = {
      currentActiveTarget: null,
      targetSource: null,
      lastSuccessfulTarget: null,
      lastFailureTarget: null,
      lastFailureReason: null,
      targetSubnetMismatch: false,
      autoDiscoveryStatus: 'not_run',
      autoDiscoveryCandidateCount: null,
      pendingQueueUsesActiveTarget: true,
      pendingQueueBoundToLegacyTarget: false,
      pendingQueueDrainDiagnostics,
    };
    const runningModeSummary = {
      currentMode: 'unknown',
      backendTarget: null,
      backendTargetSource: null,
      dependsOnAdbReverse: false,
      currentModeNote: 'No mobile diagnostic heartbeat has been received.',
      recommendedModes: {
        development: 'adb_reverse',
        formal: ['wifi_lan', 'vpn_tunnel', 'public_url'],
      },
    };
    const bridgeConnectivity = {
      backendTarget: null,
      currentActiveTarget: null,
      baseUrlSource: null,
      transportMode: 'unknown',
      targetReachable: false,
      dependsOnAdbReverse: false,
      lastCommandPollAt: null,
      lastCommandPollAgeSeconds: null,
      networkProfile: null,
      targetAutoHeal,
      configurableBackendSupported: true,
      runningModeSummary,
      remainingFormalizationSteps: [
        'Open Android bridge and send a heartbeat before diagnosing SMS reception.',
      ],
      pendingQueueDrainDiagnostics,
    };
    const deviceHealth = {
      batteryPercent: null,
      isCharging: null,
      chargeSource: null,
      batteryOptimizationStatus: 'unknown',
      appVisibilityStatus: 'unknown',
      serviceRunningStatus: 'unknown',
      batteryTemperature: null,
      networkType: null,
      simState: 'unknown',
      slotState: null,
      simPresent: null,
      simPresentStatus: 'unknown',
      serviceState: 'unknown',
      isRoaming: null,
      networkOperatorName: null,
      dataNetworkType: null,
      signalStrength: null,
      storageAvailable: null,
      appVersion: null,
      buildId: null,
      androidVersion: null,
      lastBootTime: null,
    };

    return {
      backendTarget: null,
      backendTargetSource: null,
      connectionMode: 'unknown',
      dependsOnAdbReverse: false,
      batteryPercent: null,
      isCharging: null,
      chargeSource: null,
      deviceOnlineStatus: 'unknown',
      lastHeartbeat: null,
      lastHeartbeatAgeSeconds: null,
      lastCommandPollAt: null,
      lastCommandPollAgeSeconds: null,
      lastInboxSyncAt: null,
      lastInboxSyncAgeSeconds: null,
      lastSmsReceived: null,
      phoneLocalLastSmsAt: null,
      phoneLocalLastSmsAgeSeconds: null,
      lastUploadSuccess: null,
      lastUploadSuccessAgeSeconds: null,
      lastUploadFailure: null,
      lastUploadFailureAgeSeconds: null,
      lastUploadFailureReason: null,
      smsMessageRawLatestReceivedAt: null,
      smsMessageRawLatestCreatedAt: null,
      bankSmsTransactionLatestCreatedAt: null,
      receiveSmsPermission: null,
      readSmsPermission: null,
      smsReceivePermission: 'unknown',
      smsReadPermission: 'unknown',
      permissionUnknownReason: 'no_device_diagnostic_record',
      targetReachable: false,
      batteryOptimizationStatus: 'unknown',
      appVisibilityStatus: 'unknown',
      serviceRunningStatus: 'unknown',
      networkProfile: null,
      targetAutoHeal,
      pendingQueueDrainDiagnostics,
      uploadLinkStatus: 'unknown',
      backendTargetStatus: 'unknown',
      pendingQueueStatus: 'pending_queue_empty',
      smsReceiveStatus,
      carrierDiagnostics,
      pendingUploadQueueCount: 0,
      oldestPendingAge: null,
      runningModeSummary,
      duplicateDiagnostics: this.buildUnavailableSection('duplicate_diagnostics'),
      bridgeConnectivity,
      deviceHealth,
    };
  }

  private toPermissionStatus(value: boolean | null | undefined) {
    if (value === true) {
      return 'granted';
    }
    if (value === false) {
      return 'missing';
    }
    return 'unknown';
  }

  private buildDeviceOverview(
    item: MobileDeviceDiagnostic,
    carrierRisk: Record<string, unknown> | null,
    duplicateDiagnostics: Record<string, unknown> | null,
    latestRawSmsReceivedAt: string | null,
    latestRawSmsCreatedAt: string | null,
    latestBankTransactionCreatedAt: string | null,
  ) {
    const runtimeSnapshot = this.readObject(item.runtimeSnapshotJson);
    const networkProfile = this.readObject(runtimeSnapshot?.networkProfile);
    const deviceReportedAt = this.toIsoString(this.readDate(item.deviceReportedAt));
    const lastHeartbeatAt = this.toIsoString(item.lastHeartbeatAt);
    const backendTarget =
      this.readSnapshotStringList(runtimeSnapshot, [
        'backendTarget',
        'resolvedBaseUrl',
        'backendBaseUrl',
        'baseUrl',
      ]) ?? item.resolvedBaseUrl ?? null;
    const connectionMode =
      this.readSnapshotStringList(runtimeSnapshot, ['connectionMode', 'transportMode']) ??
      this.deriveTransportMode(backendTarget);
    const targetReachable =
      this.readSnapshotBoolean(runtimeSnapshot, 'targetReachable') ??
      this.deriveTargetReachable(runtimeSnapshot);
    const oldestPendingEnqueuedAt =
      this.readSnapshotString(runtimeSnapshot, 'oldestPendingEnqueuedAt') ?? null;
    const oldestPendingAgeSeconds =
      this.readSnapshotNumber(runtimeSnapshot, 'oldestPendingAgeSeconds') ??
      this.deriveAgeSeconds(oldestPendingEnqueuedAt);
    const pendingUploadQueueCount =
      this.readSnapshotNumberList(runtimeSnapshot, [
        'pendingUploadQueueCount',
        'uploadQueueCount',
        'pendingQueueCount',
      ]) ?? item.pendingUploadQueueCount;
    const lastUploadSuccessAt = this.readSnapshotString(runtimeSnapshot, 'lastUploadSuccessAt');
    const lastUploadFailureAt = this.readSnapshotString(runtimeSnapshot, 'lastUploadFailureAt');
    const lastUploadFailureReason = this.readSnapshotString(runtimeSnapshot, 'lastUploadFailureReason');
    const lastApiSuccessAt = this.readSnapshotString(runtimeSnapshot, 'lastApiSuccessAt');
    const lastApiFailureAt = this.readSnapshotString(runtimeSnapshot, 'lastApiFailureAt');
    const lastApiFailureReason = this.readSnapshotString(runtimeSnapshot, 'lastApiFailureReason');
    const currentActiveTarget =
      this.readSnapshotStringList(runtimeSnapshot, ['currentActiveTarget', 'backendTarget']) ??
      backendTarget;
    const targetSource =
      this.readSnapshotStringList(runtimeSnapshot, [
        'targetSource',
        'currentBackendSource',
        'backendTargetSource',
      ]) ?? item.baseUrlSource;
    const lastSuccessfulTarget =
      this.readSnapshotStringList(runtimeSnapshot, ['lastSuccessfulTarget', 'lastSuccessfulBackendUrl']);
    const lastFailureTarget =
      this.readSnapshotStringList(runtimeSnapshot, ['lastFailureTarget', 'lastFailedBackendUrl']);
    const lastFailureReason =
      this.readSnapshotStringList(runtimeSnapshot, ['lastFailureReason', 'lastFailureTargetReason']) ??
      lastApiFailureReason ??
      lastUploadFailureReason;
    const targetSubnetMismatch =
      this.readSnapshotBoolean(runtimeSnapshot, 'targetSubnetMismatch') ??
      this.readSnapshotBoolean(runtimeSnapshot, 'backendLikelyFromOtherNetwork') ??
      false;
    const autoDiscoveryStatus =
      this.readSnapshotString(runtimeSnapshot, 'autoDiscoveryStatus') ??
      this.deriveAutoDiscoveryStatus(runtimeSnapshot);
    const autoDiscoveryCandidateCount =
      this.readSnapshotNumber(runtimeSnapshot, 'autoDiscoveryCandidateCount') ?? null;
    const autoDiscoverySelectedUrl = this.readSnapshotString(runtimeSnapshot, 'autoDiscoverySelectedUrl');
    const autoDiscoveryErrorCategory = this.readSnapshotString(runtimeSnapshot, 'autoDiscoveryErrorCategory');
    const pendingQueueUsesActiveTarget =
      this.readSnapshotBoolean(runtimeSnapshot, 'pendingQueueUsesActiveTarget') ?? true;
    const pendingQueueBoundToLegacyTarget =
      this.readSnapshotBoolean(runtimeSnapshot, 'pendingQueueBoundToLegacyTarget') ?? false;
    const targetAutoHeal = {
      currentActiveTarget,
      targetSource,
      lastSuccessfulTarget,
      lastFailureTarget,
      lastFailureReason,
      lastFailureTargetAt: this.readSnapshotString(runtimeSnapshot, 'lastFailureTargetAt'),
      targetSubnetMismatch,
      backendErrorCategory: this.readSnapshotString(runtimeSnapshot, 'backendErrorCategory'),
      lastStaleReason: this.readSnapshotString(runtimeSnapshot, 'lastStaleReason'),
      lastRebindAt: this.readSnapshotString(runtimeSnapshot, 'lastRebindAt'),
      lastRebindReason: this.readSnapshotString(runtimeSnapshot, 'lastRebindReason'),
      lastRebindPreviousTarget: this.readSnapshotString(runtimeSnapshot, 'lastRebindPreviousTarget'),
      autoDiscoveryStatus,
      autoDiscoveryCandidateCount,
      autoDiscoverySelectedUrl,
      autoDiscoveryErrorCategory,
      autoDiscoveryLastStartedAt: this.readSnapshotString(runtimeSnapshot, 'autoDiscoveryLastStartedAt'),
      autoDiscoveryLastFinishedAt: this.readSnapshotString(runtimeSnapshot, 'autoDiscoveryLastFinishedAt'),
      autoDiscoveryLastReason: this.readSnapshotString(runtimeSnapshot, 'autoDiscoveryLastReason'),
      pendingQueueUsesActiveTarget,
      pendingQueueBoundToLegacyTarget,
      pendingQueueLastRetryAt: this.readSnapshotString(runtimeSnapshot, 'pendingQueueLastRetryAt'),
      pendingQueueLastRetryReason: this.readSnapshotString(runtimeSnapshot, 'pendingQueueLastRetryReason'),
      pendingQueueLastPreviousTarget: this.readSnapshotString(runtimeSnapshot, 'pendingQueueLastPreviousTarget'),
      pendingQueueLastActiveTarget: this.readSnapshotString(runtimeSnapshot, 'pendingQueueLastActiveTarget'),
      pendingQueueLastFlushStartedAt: this.readSnapshotString(runtimeSnapshot, 'pendingQueueLastFlushStartedAt'),
      pendingQueueLastFlushFinishedAt: this.readSnapshotString(runtimeSnapshot, 'pendingQueueLastFlushFinishedAt'),
      pendingQueueLastFlushReason: this.readSnapshotString(runtimeSnapshot, 'pendingQueueLastFlushReason'),
      pendingQueueLastFlushTriggered: this.readSnapshotBoolean(runtimeSnapshot, 'pendingQueueLastFlushTriggered'),
      pendingQueueLastFlushPendingBefore: this.readSnapshotNumber(runtimeSnapshot, 'pendingQueueLastFlushPendingBefore'),
      pendingQueueLastFlushAttempted: this.readSnapshotNumber(runtimeSnapshot, 'pendingQueueLastFlushAttempted'),
      pendingQueueLastFlushSucceeded: this.readSnapshotNumber(runtimeSnapshot, 'pendingQueueLastFlushSucceeded'),
      pendingQueueLastFlushFailed: this.readSnapshotNumber(runtimeSnapshot, 'pendingQueueLastFlushFailed'),
      pendingQueueLastFlushSkippedDuplicate: this.readSnapshotNumber(runtimeSnapshot, 'pendingQueueLastFlushSkippedDuplicate'),
      pendingQueueLastFlushBlocked: this.readSnapshotNumber(runtimeSnapshot, 'pendingQueueLastFlushBlocked'),
      pendingQueueLastFlushPendingAfter: this.readSnapshotNumber(runtimeSnapshot, 'pendingQueueLastFlushPendingAfter'),
      pendingQueueLastFlushActiveTarget: this.readSnapshotString(runtimeSnapshot, 'pendingQueueLastFlushActiveTarget'),
      pendingQueueLastFlushPreviousTarget: this.readSnapshotString(runtimeSnapshot, 'pendingQueueLastFlushPreviousTarget'),
      pendingQueueLastFlushRebindAt: this.readSnapshotString(runtimeSnapshot, 'pendingQueueLastFlushRebindAt'),
      pendingQueueWaitingBackoff: this.readSnapshotBoolean(runtimeSnapshot, 'pendingQueueWaitingBackoff'),
      pendingQueueStatusDistribution: this.readObject(runtimeSnapshot?.pendingQueueStatusDistribution),
      pendingQueueLastScanLimitReached: this.readSnapshotBoolean(runtimeSnapshot, 'pendingQueueLastScanLimitReached'),
      pendingQueueLastScanLimitUnmatched: this.readSnapshotNumber(runtimeSnapshot, 'pendingQueueLastScanLimitUnmatched'),
      pendingQueueLastNotQuarantinedUnmatched: this.readSnapshotNumber(
        runtimeSnapshot,
        'pendingQueueLastNotQuarantinedUnmatched',
      ),
      pendingQueueLastConfirmedMissingPayload: this.readSnapshotNumber(
        runtimeSnapshot,
        'pendingQueueLastConfirmedMissingPayload',
      ),
      pendingQueueStillActiveAfterBoundedScan: this.readSnapshotBoolean(
        runtimeSnapshot,
        'pendingQueueStillActiveAfterBoundedScan',
      ),
      pendingQueueQuarantinedCount: this.readSnapshotNumber(runtimeSnapshot, 'pendingQueueQuarantinedCount'),
      pendingQueueUnreplayableCount: this.readSnapshotNumber(runtimeSnapshot, 'pendingQueueUnreplayableCount'),
      pendingQueueClosedMissingPayloadCount: this.readSnapshotNumber(
        runtimeSnapshot,
        'pendingQueueClosedMissingPayloadCount',
      ),
      pendingQueueLastQuarantinedAt: this.readSnapshotString(runtimeSnapshot, 'pendingQueueLastQuarantinedAt'),
      pendingQueueLastQuarantineReason: this.readSnapshotString(runtimeSnapshot, 'pendingQueueLastQuarantineReason'),
      pendingQueueLastQuarantineSource: this.readSnapshotString(runtimeSnapshot, 'pendingQueueLastQuarantineSource'),
      pendingQueueLastQuarantineItemIds: this.readSnapshotStringArray(
        runtimeSnapshot,
        'pendingQueueLastQuarantineItemIds',
      ),
      pendingQueueQuarantineAudit: Array.isArray(runtimeSnapshot?.pendingQueueQuarantineAudit)
        ? runtimeSnapshot.pendingQueueQuarantineAudit
        : [],
      lastPendingQueueForceRetryAt: this.readSnapshotString(runtimeSnapshot, 'lastPendingQueueForceRetryAt'),
    };
    const lastCommandPollAt = this.readSnapshotStringList(runtimeSnapshot, [
      'lastCommandPollAt',
      'lastCommandPollingAt',
      'lastCommandFetchAt',
    ]);
    const lastDeviceActivityAt = this.pickLatestIsoString([
      lastHeartbeatAt,
      deviceReportedAt,
      lastApiSuccessAt,
      lastCommandPollAt,
    ]);
    const deviceOnlineStatus = this.deriveDeviceOnlineStatus(lastDeviceActivityAt);
    const lastHeartbeatAgeSeconds = this.deriveAgeSeconds(lastDeviceActivityAt);
    const phoneLocalLastSmsAt =
      this.readSnapshotStringList(runtimeSnapshot, [
        'lastLocalSmsReceivedAt',
        'phoneLocalLastSmsAt',
        'lastPhoneSmsReceivedAt',
        'lastSmsReceivedAt',
        'lastSmsReceived',
        'lastMessageReceivedAt',
      ]) ??
      this.toIsoString(item.lastBroadcastReceivedAt) ??
      latestRawSmsReceivedAt ??
      this.toIsoString(item.lastRawSmsIngestAt) ??
      this.toIsoString(item.lastInboxSyncAt);
    const systemLastUploadSuccessAt =
      lastUploadSuccessAt ??
      this.toIsoString(item.lastRawSmsIngestAt) ??
      latestRawSmsCreatedAt;
    const lastSmsReceivedAt =
      phoneLocalLastSmsAt ??
      latestRawSmsReceivedAt ??
      this.toIsoString(item.lastRawSmsIngestAt) ??
      this.toIsoString(item.lastBroadcastReceivedAt) ??
      this.toIsoString(item.lastInboxSyncAt);
    const clockSkewSeconds =
      item.deviceReportedAt && item.lastHeartbeatAt
        ? Math.round((item.lastHeartbeatAt.getTime() - item.deviceReportedAt.getTime()) / 1000)
        : null;
    const dependsOnAdbReverse = connectionMode === 'adb_reverse';
    const batteryPercent = this.readSnapshotNumber(runtimeSnapshot, 'batteryPercent');
    const isCharging = this.readSnapshotBoolean(runtimeSnapshot, 'isCharging');
    const chargeSource = this.readSnapshotString(runtimeSnapshot, 'chargeSource');
    const batteryOptimizationStatus =
      this.readSnapshotString(runtimeSnapshot, 'batteryOptimizationStatus') ?? 'unknown';
    const appVisibilityStatus = this.readSnapshotString(runtimeSnapshot, 'appVisibilityStatus') ?? 'unknown';
    const serviceRunningStatus = this.readSnapshotString(runtimeSnapshot, 'serviceRunningStatus') ?? 'unknown';
    const permissionUnknownReason =
      item.receiveSmsPermission === null || item.readSmsPermission === null
        ? 'device_did_not_report_permission_fields_or_old_apk'
        : null;
    const runningModeSummary = {
      currentMode: connectionMode,
      backendTarget,
      backendTargetSource: targetSource,
      dependsOnAdbReverse,
      currentModeNote: dependsOnAdbReverse
        ? 'Current app depends on 127.0.0.1/localhost plus adb reverse.'
        : 'Current app is already using a non-loopback backend target.',
      recommendedModes: {
        development: 'adb_reverse',
        formal: ['wifi_lan', 'vpn_tunnel', 'public_url'],
      },
    };
    const pendingQueueDrainDiagnostics = this.buildPendingQueueDrainDiagnostics({
      targetReachable,
      pendingUploadQueueCount,
      currentActiveTarget,
      lastFailureTarget,
      lastUploadSuccessAt: systemLastUploadSuccessAt,
      lastUploadFailureAt,
      lastUploadFailureReason,
      pendingQueueUsesActiveTarget,
      pendingQueueBoundToLegacyTarget,
      pendingQueueLastRetryAt: targetAutoHeal.pendingQueueLastRetryAt,
      pendingQueueLastRetryReason: targetAutoHeal.pendingQueueLastRetryReason,
      pendingQueueLastPreviousTarget: targetAutoHeal.pendingQueueLastPreviousTarget,
      pendingQueueLastActiveTarget: targetAutoHeal.pendingQueueLastActiveTarget,
      pendingQueueLastFlushFinishedAt: targetAutoHeal.pendingQueueLastFlushFinishedAt,
      pendingQueueLastFlushReason: targetAutoHeal.pendingQueueLastFlushReason,
      pendingQueueLastFlushPendingBefore: targetAutoHeal.pendingQueueLastFlushPendingBefore,
      pendingQueueLastFlushAttempted: targetAutoHeal.pendingQueueLastFlushAttempted,
      pendingQueueLastFlushSucceeded: targetAutoHeal.pendingQueueLastFlushSucceeded,
      pendingQueueLastFlushFailed: targetAutoHeal.pendingQueueLastFlushFailed,
      pendingQueueLastFlushBlocked: targetAutoHeal.pendingQueueLastFlushBlocked,
      pendingQueueLastFlushPendingAfter: targetAutoHeal.pendingQueueLastFlushPendingAfter,
      pendingQueueLastFlushActiveTarget: targetAutoHeal.pendingQueueLastFlushActiveTarget,
      pendingQueueLastFlushPreviousTarget: targetAutoHeal.pendingQueueLastFlushPreviousTarget,
      pendingQueueLastScanLimitReached: targetAutoHeal.pendingQueueLastScanLimitReached,
      pendingQueueLastScanLimitUnmatched: targetAutoHeal.pendingQueueLastScanLimitUnmatched,
      pendingQueueLastNotQuarantinedUnmatched: targetAutoHeal.pendingQueueLastNotQuarantinedUnmatched,
      pendingQueueLastConfirmedMissingPayload: targetAutoHeal.pendingQueueLastConfirmedMissingPayload,
      pendingQueueStillActiveAfterBoundedScan: targetAutoHeal.pendingQueueStillActiveAfterBoundedScan,
      pendingQueueQuarantinedCount: targetAutoHeal.pendingQueueQuarantinedCount,
      pendingQueueUnreplayableCount: targetAutoHeal.pendingQueueUnreplayableCount,
      pendingQueueClosedMissingPayloadCount: targetAutoHeal.pendingQueueClosedMissingPayloadCount,
      pendingQueueLastQuarantinedAt: targetAutoHeal.pendingQueueLastQuarantinedAt,
      pendingQueueLastQuarantineReason: targetAutoHeal.pendingQueueLastQuarantineReason,
      pendingQueueLastQuarantineSource: targetAutoHeal.pendingQueueLastQuarantineSource,
    });
    const targetAutoHealWithDrainDiagnostics = {
      ...targetAutoHeal,
      pendingQueueDrainDiagnostics,
    };
    const bridgeConnectivity = {
      backendTarget,
      currentActiveTarget,
      baseUrlSource: targetSource,
      transportMode: connectionMode,
      targetReachable,
      dependsOnAdbReverse,
      lastCommandPollAt,
      lastCommandPollAgeSeconds: this.deriveAgeSeconds(lastCommandPollAt),
      networkProfile,
      targetAutoHeal: targetAutoHealWithDrainDiagnostics,
      configurableBackendSupported: true,
      runningModeSummary,
      remainingFormalizationSteps: this.buildRemainingBridgeSteps({
        dependsOnAdbReverse,
        targetReachable,
        pendingUploadQueueCount,
        lastUploadSuccessAt: systemLastUploadSuccessAt,
        lastUploadFailureAt,
        lastUploadFailureReason,
        currentActiveTarget,
        lastFailureTarget,
        targetSubnetMismatch,
        pendingQueueBoundToLegacyTarget,
        pendingQueueQuarantinedCount: targetAutoHeal.pendingQueueQuarantinedCount,
        pendingQueueManualReviewNeeded: pendingQueueDrainDiagnostics.manualReviewNeeded === true,
        pendingQueueStillActiveAfterBoundedScan:
          pendingQueueDrainDiagnostics.stillActivePendingAfterBoundedScan === true,
      }),
    };
    const carrierDiagnostics = this.buildCarrierDiagnosticsOverview(runtimeSnapshot, {
      receiveSmsPermission: item.receiveSmsPermission,
      readSmsPermission: item.readSmsPermission,
      phoneLocalLastSmsAt,
      lastReceiverTriggeredAt: this.readSnapshotString(runtimeSnapshot, 'lastReceiverTriggeredAt'),
      lastInboxScanAt:
        this.readSnapshotString(runtimeSnapshot, 'lastInboxScanAt') ??
        this.readSnapshotString(runtimeSnapshot, 'inboxScanFinishedAt') ??
        this.readSnapshotString(runtimeSnapshot, 'inboxScanStartedAt'),
    });
    const smsReceiveStatus = this.buildSmsReceiveStatus({
      targetReachable,
      pendingUploadQueueCount,
      lastUploadSuccessAt: systemLastUploadSuccessAt,
      lastUploadFailureAt,
      carrierDiagnostics,
    });

    return {
      deviceId: item.deviceId,
      receiveSmsPermission: item.receiveSmsPermission,
      readSmsPermission: item.readSmsPermission,
      permissionUnknownReason,
      deviceReportedAt,
      lastBroadcastReceivedAt: this.toIsoString(item.lastBroadcastReceivedAt),
      lastRawSmsIngestResult: item.lastRawSmsIngestResult,
      lastRawSmsIngestAt: this.toIsoString(item.lastRawSmsIngestAt),
      lastInboxSyncAt: this.toIsoString(item.lastInboxSyncAt),
      pendingUploadQueueCount,
      oldestPendingEnqueuedAt,
      oldestPendingAgeSeconds,
      lastUploadSuccessReportedAt: lastUploadSuccessAt,
      lastUploadFailureAt,
      lastUploadFailureReason,
      lastApiSuccessAt,
      lastApiFailureAt,
      lastApiFailureReason,
      lastTestUploadAt: this.toIsoString(item.lastTestUploadAt),
      resolvedBaseUrl: backendTarget,
      baseUrlSource: targetSource,
      transportMode: connectionMode,
      targetReachable,
      lastHeartbeatAt,
      lastDeviceActivityAt,
      deviceOnlineStatus,
      lastHeartbeatAgeSeconds,
      lastCommandPollAt,
      lastCommandPollAgeSeconds: this.deriveAgeSeconds(lastCommandPollAt),
      lastInboxSyncAgeSeconds: this.deriveAgeSeconds(this.toIsoString(item.lastInboxSyncAt)),
      deviceServerClockSkewSeconds: clockSkewSeconds,
      backendTarget,
      currentActiveTarget,
      connectionMode,
      dependsOnAdbReverse,
      backendTargetSource: targetSource,
      targetAutoHeal: targetAutoHealWithDrainDiagnostics,
      batteryPercent,
      isCharging,
      chargeSource,
      batteryOptimizationStatus,
      appVisibilityStatus,
      serviceRunningStatus,
      networkProfile,
      lastHeartbeat: lastHeartbeatAt,
      lastSmsReceived: lastSmsReceivedAt,
      phoneLocalLastSmsAt,
      phoneLocalLastSmsAgeSeconds: this.deriveAgeSeconds(phoneLocalLastSmsAt),
      lastUploadSuccess: systemLastUploadSuccessAt,
      lastUploadSuccessAt: systemLastUploadSuccessAt,
      lastUploadSuccessAgeSeconds: this.deriveAgeSeconds(systemLastUploadSuccessAt),
      lastUploadFailure: lastUploadFailureAt,
      lastUploadFailureAgeSeconds: this.deriveAgeSeconds(lastUploadFailureAt),
      smsMessageRawLatestReceivedAt: latestRawSmsReceivedAt,
      smsMessageRawLatestCreatedAt: latestRawSmsCreatedAt,
      bankSmsTransactionLatestCreatedAt: latestBankTransactionCreatedAt,
      oldestPendingAge: oldestPendingAgeSeconds,
      runningModeSummary,
      bridgeConnectivity: {
        ...bridgeConnectivity,
        targetAutoHeal: targetAutoHealWithDrainDiagnostics,
        pendingQueueDrainDiagnostics,
      },
      uploadLinkStatus: smsReceiveStatus.uploadLinkStatus,
      backendTargetStatus: smsReceiveStatus.backendTargetStatus,
      pendingQueueStatus: smsReceiveStatus.pendingQueueStatus,
      smsReceiveStatus,
      pendingQueueDrainDiagnostics,
      carrierDiagnostics,
      deviceHealth: {
        batteryPercent,
        isCharging,
        chargeSource,
        batteryOptimizationStatus,
        appVisibilityStatus,
        serviceRunningStatus,
        batteryTemperature: this.readSnapshotNumber(runtimeSnapshot, 'batteryTemperature'),
        networkType: this.readSnapshotString(runtimeSnapshot, 'networkType'),
        simState: this.readSnapshotString(runtimeSnapshot, 'simState'),
        slotState: this.readSnapshotString(runtimeSnapshot, 'slotState'),
        simPresent: carrierDiagnostics.simPresent,
        simPresentStatus: carrierDiagnostics.simPresentStatus,
        serviceState: carrierDiagnostics.serviceState,
        isRoaming: carrierDiagnostics.isRoaming,
        networkOperatorName: carrierDiagnostics.networkOperatorName,
        dataNetworkType: carrierDiagnostics.dataNetworkType,
        signalStrength: this.readSnapshotString(runtimeSnapshot, 'signalStrength'),
        storageAvailable: this.readSnapshotNumber(runtimeSnapshot, 'storageAvailable'),
        appVersion: this.readSnapshotString(runtimeSnapshot, 'appVersion'),
        buildId: this.readSnapshotString(runtimeSnapshot, 'buildId'),
        androidVersion: this.readSnapshotString(runtimeSnapshot, 'androidVersion'),
        lastBootTime: this.readSnapshotString(runtimeSnapshot, 'lastBootTime'),
      },
      carrierRisk,
      duplicateDiagnostics,
    };
  }

  private buildCarrierDiagnosticsOverview(
    runtimeSnapshot: Record<string, unknown> | null,
    fallback: {
      receiveSmsPermission: boolean | null;
      readSmsPermission: boolean | null;
      phoneLocalLastSmsAt: string | null;
      lastReceiverTriggeredAt: string | null;
      lastInboxScanAt: string | null;
    },
  ) {
    const rawCarrier = this.readObject(runtimeSnapshot?.carrierDiagnostics);
    const serviceState =
      this.readSnapshotStringList(rawCarrier, ['serviceState', 'simServiceState']) ??
      this.readSnapshotString(runtimeSnapshot, 'simServiceState') ??
      'unknown';
    const simState =
      this.readSnapshotString(rawCarrier, 'simState') ??
      this.readSnapshotString(runtimeSnapshot, 'simState') ??
      'unknown';
    const simPresent =
      this.readSnapshotBoolean(rawCarrier, 'simPresent') ??
      this.readSnapshotBoolean(runtimeSnapshot, 'simPresent') ??
      this.inferSimPresent(simState);
    const smsReceiveUnavailableReason =
      this.readSnapshotString(rawCarrier, 'smsReceiveUnavailableReason') ??
      this.readSnapshotString(runtimeSnapshot, 'smsReceiveUnavailableReason') ??
      this.inferSmsReceiveUnavailableReason({
        simPresent,
        serviceState,
        receiveSmsPermission: fallback.receiveSmsPermission,
      });
    const smsReceiveCapability =
      this.readSnapshotString(rawCarrier, 'smsReceiveCapability') ??
      this.readSnapshotString(runtimeSnapshot, 'smsReceiveCapability') ??
      this.inferSmsReceiveCapability({
        simPresent,
        serviceState,
        receiveSmsPermission: fallback.receiveSmsPermission,
      });
    const diagnosticStatuses = new Set([
      ...this.readSnapshotStringArray(rawCarrier, 'diagnosticStatuses'),
    ]);
    if (smsReceiveCapability === 'unavailable' && smsReceiveUnavailableReason === 'sim_no_signal') {
      diagnosticStatuses.add('sms_receive_unavailable_no_signal');
    }
    if (smsReceiveCapability === 'unavailable' && smsReceiveUnavailableReason === 'no_sim') {
      diagnosticStatuses.add('sms_receive_unavailable_no_sim');
    }
    if (
      serviceState === 'out_of_service' ||
      serviceState === 'emergency_only' ||
      serviceState === 'power_off' ||
      smsReceiveUnavailableReason === 'sim_no_signal'
    ) {
      diagnosticStatuses.add('carrier_unavailable');
    }
    const isRoaming =
      this.readSnapshotBoolean(rawCarrier, 'isRoaming') ??
      this.readSnapshotBoolean(runtimeSnapshot, 'isRoaming');
    if (isRoaming === true || (smsReceiveUnavailableReason === 'sim_no_signal' && serviceState !== 'in_service')) {
      diagnosticStatuses.add('roaming_required_or_unavailable');
    }
    if (smsReceiveCapability === 'unknown') {
      diagnosticStatuses.add('sms_receive_permission_unknown');
    }
    const smsReceiveIdleReason =
      this.readSnapshotString(rawCarrier, 'smsReceiveIdleReason') ??
      this.readSnapshotString(runtimeSnapshot, 'smsReceiveIdleReason') ??
      (!fallback.phoneLocalLastSmsAt && smsReceiveCapability === 'can_receive'
        ? 'system_inbox_idle_no_new_sms'
        : null);
    if (smsReceiveIdleReason === 'system_inbox_idle_no_new_sms') {
      diagnosticStatuses.add('sms_receive_idle_no_new_sms');
    }

    return {
      simPresent,
      simPresentStatus:
        this.readSnapshotString(rawCarrier, 'simPresentStatus') ??
        this.readSnapshotString(runtimeSnapshot, 'simPresentStatus') ??
        (simPresent === null ? 'unknown' : simPresent ? 'present' : 'absent'),
      simState,
      slotState:
        this.readSnapshotString(rawCarrier, 'slotState') ??
        this.readSnapshotString(runtimeSnapshot, 'slotState'),
      serviceState,
      isRoaming,
      networkOperatorName:
        this.readSnapshotString(rawCarrier, 'networkOperatorName') ??
        this.readSnapshotString(runtimeSnapshot, 'networkOperatorName'),
      signalStrength:
        this.readSnapshotString(rawCarrier, 'signalStrength') ??
        this.readSnapshotString(runtimeSnapshot, 'signalStrength'),
      dataNetworkType:
        this.readSnapshotString(rawCarrier, 'dataNetworkType') ??
        this.readSnapshotString(runtimeSnapshot, 'dataNetworkType') ??
        this.readSnapshotString(runtimeSnapshot, 'networkType'),
      phoneStatePermission:
        this.readSnapshotString(rawCarrier, 'phoneStatePermission') ??
        this.readSnapshotString(runtimeSnapshot, 'phoneStatePermission'),
      receiveSmsPermission:
        this.readSnapshotString(rawCarrier, 'receiveSmsPermission') ??
        (fallback.receiveSmsPermission === null
          ? 'unknown'
          : fallback.receiveSmsPermission
            ? 'granted'
            : 'missing'),
      readSmsPermission:
        this.readSnapshotString(rawCarrier, 'readSmsPermission') ??
        (fallback.readSmsPermission === null
          ? 'unknown'
          : fallback.readSmsPermission
            ? 'granted'
            : 'missing'),
      defaultSmsAppRestricted:
        this.readSnapshotBoolean(rawCarrier, 'defaultSmsAppRestricted') ??
        this.readSnapshotBoolean(runtimeSnapshot, 'defaultSmsAppRestricted'),
      smsReceiveCapability,
      smsReceiveUnavailableReason,
      smsReceiveIdleReason,
      smsReceivePrerequisitesSatisfied:
        this.readSnapshotBoolean(rawCarrier, 'smsReceivePrerequisitesSatisfied') ??
        smsReceiveCapability === 'can_receive',
      lastSystemSmsReceivedAt:
        this.readSnapshotString(rawCarrier, 'lastSystemSmsReceivedAt') ??
        this.readSnapshotString(runtimeSnapshot, 'lastSystemSmsReceivedAt') ??
        fallback.phoneLocalLastSmsAt,
      lastReceiverTriggeredAt:
        this.readSnapshotString(rawCarrier, 'lastReceiverTriggeredAt') ??
        fallback.lastReceiverTriggeredAt,
      lastInboxScanAt:
        this.readSnapshotString(rawCarrier, 'lastInboxScanAt') ??
        fallback.lastInboxScanAt,
      diagnosticStatuses: Array.from(diagnosticStatuses),
    };
  }

  private buildSmsReceiveStatus(input: {
    targetReachable: boolean;
    pendingUploadQueueCount: number;
    lastUploadSuccessAt: string | null;
    lastUploadFailureAt: string | null;
    carrierDiagnostics: Record<string, unknown>;
  }) {
    const uploadFailureNewerThanSuccess = this.isTimestampAfter(
      input.lastUploadFailureAt,
      input.lastUploadSuccessAt,
    );
    const uploadLinkStatus =
      input.targetReachable && !uploadFailureNewerThanSuccess
        ? 'upload_link_ok'
        : 'current_upload_failed';
    const backendTargetStatus = input.targetReachable ? 'backend_target_ok' : 'backend_target_unreachable';
    const pendingQueueStatus =
      input.pendingUploadQueueCount === 0 ? 'pending_queue_empty' : 'pending_queue_backlog';
    const carrierStatuses = this.readSnapshotStringArray(input.carrierDiagnostics, 'diagnosticStatuses');
    const diagnosticStatuses = new Set<string>([
      uploadLinkStatus,
      backendTargetStatus,
      pendingQueueStatus,
      ...carrierStatuses,
    ]);
    return {
      uploadLinkStatus,
      backendTargetStatus,
      pendingQueueStatus,
      smsReceiveCapability: this.readSnapshotString(input.carrierDiagnostics, 'smsReceiveCapability') ?? 'unknown',
      smsReceiveUnavailableReason: this.readSnapshotString(input.carrierDiagnostics, 'smsReceiveUnavailableReason'),
      smsReceiveIdleReason: this.readSnapshotString(input.carrierDiagnostics, 'smsReceiveIdleReason'),
      carrierStatus: diagnosticStatuses.has('carrier_unavailable') ? 'carrier_unavailable' : 'carrier_available_or_unknown',
      diagnosticStatuses: Array.from(diagnosticStatuses),
      testUploadAffected: false,
      commandPollingAffected: false,
      healthCheckAffected: false,
    };
  }

  private buildPendingQueueDrainDiagnostics(input: {
    targetReachable: boolean;
    pendingUploadQueueCount: number;
    currentActiveTarget: string | null;
    lastFailureTarget: string | null;
    lastUploadSuccessAt: string | null;
    lastUploadFailureAt: string | null;
    lastUploadFailureReason: string | null;
    pendingQueueUsesActiveTarget: boolean;
    pendingQueueBoundToLegacyTarget: boolean;
    pendingQueueLastRetryAt: string | null;
    pendingQueueLastRetryReason: string | null;
    pendingQueueLastPreviousTarget: string | null;
    pendingQueueLastActiveTarget: string | null;
    pendingQueueLastFlushFinishedAt: string | null;
    pendingQueueLastFlushReason: string | null;
    pendingQueueLastFlushPendingBefore: number | null;
    pendingQueueLastFlushAttempted: number | null;
    pendingQueueLastFlushSucceeded: number | null;
    pendingQueueLastFlushFailed: number | null;
    pendingQueueLastFlushBlocked: number | null;
    pendingQueueLastFlushPendingAfter: number | null;
    pendingQueueLastFlushActiveTarget: string | null;
    pendingQueueLastFlushPreviousTarget: string | null;
    pendingQueueLastScanLimitReached: boolean | null;
    pendingQueueLastScanLimitUnmatched: number | null;
    pendingQueueLastNotQuarantinedUnmatched: number | null;
    pendingQueueLastConfirmedMissingPayload: number | null;
    pendingQueueStillActiveAfterBoundedScan: boolean | null;
    pendingQueueQuarantinedCount: number | null;
    pendingQueueUnreplayableCount: number | null;
    pendingQueueClosedMissingPayloadCount: number | null;
    pendingQueueLastQuarantinedAt: string | null;
    pendingQueueLastQuarantineReason: string | null;
    pendingQueueLastQuarantineSource: string | null;
  }) {
    const uploadSuccessNewerThanFailure = this.isTimestampAtOrAfter(
      input.lastUploadSuccessAt,
      input.lastUploadFailureAt,
    );
    const autoDrainRecommended =
      input.targetReachable && input.pendingUploadQueueCount > 0;
    const autoDrainTriggerExpected =
      autoDrainRecommended && uploadSuccessNewerThanFailure;
    const payloadValidationFailure =
      this.resolveUploadPayloadValidationFailure(input.lastUploadFailureReason);
    const oldFailureTarget =
      Boolean(input.currentActiveTarget && input.lastFailureTarget) &&
      this.normalizeTargetForComparison(input.currentActiveTarget) !==
        this.normalizeTargetForComparison(input.lastFailureTarget);
    const previousRetryTargetMismatch =
      Boolean(input.currentActiveTarget && input.pendingQueueLastPreviousTarget) &&
      this.normalizeTargetForComparison(input.currentActiveTarget) !==
        this.normalizeTargetForComparison(input.pendingQueueLastPreviousTarget);
    const flushActiveTargetMismatch =
      Boolean(input.currentActiveTarget && input.pendingQueueLastFlushActiveTarget) &&
      this.normalizeTargetForComparison(input.currentActiveTarget) !==
        this.normalizeTargetForComparison(input.pendingQueueLastFlushActiveTarget);
    const oldTargetDetected =
      input.pendingQueueBoundToLegacyTarget ||
      input.pendingQueueUsesActiveTarget === false ||
      oldFailureTarget ||
      previousRetryTargetMismatch ||
      flushActiveTargetMismatch;
    const retried =
      Boolean(input.pendingQueueLastRetryAt || input.pendingQueueLastFlushFinishedAt);
    const drainFailed =
      (input.pendingQueueLastFlushFailed ?? 0) > 0 ||
      (input.pendingQueueLastFlushBlocked ?? 0) > 0;
    const scanLimitReachedNotQuarantined =
      input.pendingUploadQueueCount > 0 &&
      input.pendingQueueLastScanLimitReached === true &&
      (input.pendingQueueLastScanLimitUnmatched ?? 0) > 0;
    const payloadNotFoundInScanWindow =
      input.pendingUploadQueueCount > 0 &&
      scanLimitReachedNotQuarantined === false &&
      (input.pendingQueueLastNotQuarantinedUnmatched ?? 0) > 0;
    const stillActivePendingAfterBoundedScan =
      input.pendingUploadQueueCount > 0 &&
      (input.pendingQueueStillActiveAfterBoundedScan === true ||
        scanLimitReachedNotQuarantined ||
        payloadNotFoundInScanWindow);
    const retriedStillPending =
      retried &&
      input.pendingUploadQueueCount > 0 &&
      ((input.pendingQueueLastFlushPendingAfter ?? input.pendingUploadQueueCount) > 0 ||
        drainFailed);
    const quarantinedCount = input.pendingQueueQuarantinedCount ?? 0;
    const unreplayableCount = input.pendingQueueUnreplayableCount ?? 0;
    const closedMissingPayloadCount = input.pendingQueueClosedMissingPayloadCount ?? 0;
    const missingPayloadQuarantined =
      unreplayableCount > 0 &&
      input.pendingQueueLastQuarantineReason === 'blocked_by_missing_payload';
    const manualReviewNeeded =
      missingPayloadQuarantined && quarantinedCount > closedMissingPayloadCount;

    let statusCode = 'pending_queue_empty';
    if (input.pendingUploadQueueCount === 0 && missingPayloadQuarantined) {
      statusCode = 'pending_queue_quarantined_unreplayable';
    } else if (scanLimitReachedNotQuarantined) {
      statusCode = 'pending_scan_limit_reached_not_quarantined';
    } else if (payloadNotFoundInScanWindow) {
      statusCode = 'pending_payload_not_found_in_scan_window';
    } else if (input.pendingUploadQueueCount > 0 && !input.targetReachable) {
      statusCode = 'target_unreachable_pending_backlog';
    } else if (input.pendingUploadQueueCount > 0 && payloadValidationFailure) {
      statusCode = 'pending_drain_payload_validation_error';
    } else if (input.pendingUploadQueueCount > 0 && retriedStillPending && drainFailed) {
      statusCode = 'pending_drain_failed';
    } else if (input.pendingUploadQueueCount > 0 && retriedStillPending) {
      statusCode = 'pending_retried_still_failed';
    } else if (input.pendingUploadQueueCount > 0 && oldTargetDetected) {
      statusCode = 'pending_old_target';
    } else if (autoDrainTriggerExpected) {
      statusCode = 'auto_drain_trigger_expected';
    } else if (input.pendingUploadQueueCount > 0) {
      statusCode = 'pending_backlog_waiting_for_upload_recovery';
    }

    return {
      statusCode,
      autoDrainRecommended,
      autoDrainTriggerExpected,
      targetReachable: input.targetReachable,
      uploadSuccessNewerThanFailure,
      pendingUploadQueueCount: input.pendingUploadQueueCount,
      currentActiveTarget: input.currentActiveTarget,
      lastFailureTarget: input.lastFailureTarget,
      oldTargetDetected,
      oldFailureTarget,
      previousRetryTargetMismatch,
      flushActiveTargetMismatch,
      retried,
      retriedStillPending,
      drainFailed,
      quarantinedCount,
      unreplayableCount,
      closedMissingPayloadCount,
      manualReviewNeeded,
      scanLimitReachedNotQuarantined,
      scanLimitUnmatchedCount: input.pendingQueueLastScanLimitUnmatched ?? 0,
      notQuarantinedUnmatchedCount: input.pendingQueueLastNotQuarantinedUnmatched ?? 0,
      confirmedMissingPayloadCount: input.pendingQueueLastConfirmedMissingPayload ?? 0,
      stillActivePendingAfterBoundedScan,
      lastQuarantinedAt: input.pendingQueueLastQuarantinedAt,
      lastQuarantineReason: input.pendingQueueLastQuarantineReason,
      lastQuarantineSource: input.pendingQueueLastQuarantineSource,
      payloadValidationErrorField: payloadValidationFailure?.field ?? null,
      lastDrainFailureReason:
        (missingPayloadQuarantined ? 'blocked_by_missing_payload' : null) ??
        (scanLimitReachedNotQuarantined ? 'pending_scan_limit_reached' : null) ??
        (payloadNotFoundInScanWindow ? 'pending_payload_not_found_in_scan_window' : null) ??
        payloadValidationFailure?.type ??
        ((input.pendingQueueLastFlushBlocked ?? 0) > 0
          ? 'blocked_by_missing_payload'
          : (input.pendingQueueLastFlushFailed ?? 0) > 0
            ? 'retry_scheduled_or_upload_failed'
            : null),
      lastRetryAt: input.pendingQueueLastRetryAt,
      lastRetryReason: input.pendingQueueLastRetryReason,
      lastRetryPreviousTarget: input.pendingQueueLastPreviousTarget,
      lastRetryActiveTarget: input.pendingQueueLastActiveTarget,
      lastFlushFinishedAt: input.pendingQueueLastFlushFinishedAt,
      lastFlushReason: input.pendingQueueLastFlushReason,
      lastFlushPendingBefore: input.pendingQueueLastFlushPendingBefore,
      lastFlushAttempted: input.pendingQueueLastFlushAttempted,
      lastFlushSucceeded: input.pendingQueueLastFlushSucceeded,
      lastFlushFailed: input.pendingQueueLastFlushFailed,
      lastFlushBlocked: input.pendingQueueLastFlushBlocked,
      lastFlushPendingAfter: input.pendingQueueLastFlushPendingAfter,
      lastFlushActiveTarget: input.pendingQueueLastFlushActiveTarget,
      lastFlushPreviousTarget: input.pendingQueueLastFlushPreviousTarget,
      safeBoundary:
        'pending queue retry only replays SMS upload payloads through mobile bridge ingestion; it does not confirm finance state.',
    };
  }

  private buildDiagnosticConclusion(
    device: Record<string, unknown> | null,
    commandDiagnostics: Array<Record<string, unknown>> = [],
  ) {
    if (!device) {
      return {
        level: 'info',
        title: '设备状态未知',
        summary: '尚未收到任何移动桥接设备诊断上报，无法判断权限、网络或短信链路。',
        recommendations: ['打开 Android bridge 应用并触发一次心跳或命令轮询。'],
      };
    }

    const status = device.deviceOnlineStatus as DeviceOnlineStatus;
    const heartbeatAge = typeof device.lastHeartbeatAgeSeconds === 'number' ? device.lastHeartbeatAgeSeconds : null;
    const commandPollAge =
      typeof device.lastCommandPollAgeSeconds === 'number' ? device.lastCommandPollAgeSeconds : null;
    const targetReachable = device.targetReachable === true;
    const receivePermission = device.receiveSmsPermission;
    const readPermission = device.readSmsPermission;
    const pendingQueueCount =
      typeof device.pendingUploadQueueCount === 'number' ? device.pendingUploadQueueCount : 0;
    const networkProfile = this.readObject(device.networkProfile);
    const wifiSsid = this.readSnapshotString(networkProfile, 'wifiSsid');
    const wifiProfileMatched = this.readSnapshotBoolean(networkProfile, 'wifiProfileMatched');
    const wifiSsidPermission = this.readSnapshotString(networkProfile, 'wifiSsidPermission');
    const phoneSmsAt = typeof device.phoneLocalLastSmsAt === 'string' ? device.phoneLocalLastSmsAt : null;
    const systemUploadAt =
      typeof device.lastUploadSuccessAt === 'string'
        ? device.lastUploadSuccessAt
        : typeof device.lastUploadSuccess === 'string'
          ? device.lastUploadSuccess
          : null;
    const rawCreatedAt =
      typeof device.smsMessageRawLatestCreatedAt === 'string' ? device.smsMessageRawLatestCreatedAt : null;
    const bankCreatedAt =
      typeof device.bankSmsTransactionLatestCreatedAt === 'string'
        ? device.bankSmsTransactionLatestCreatedAt
        : null;
    const lastUploadFailureReason =
      typeof device.lastUploadFailureReason === 'string' ? device.lastUploadFailureReason : null;
    const payloadValidationFailure =
      this.resolveUploadPayloadValidationFailure(lastUploadFailureReason);
    const targetAutoHeal = this.readObject(device.targetAutoHeal);
    const targetSubnetMismatch = this.readSnapshotBoolean(targetAutoHeal, 'targetSubnetMismatch') === true;
    const lastFailureTarget = this.readSnapshotString(targetAutoHeal, 'lastFailureTarget');
    const currentActiveTarget = this.readSnapshotString(targetAutoHeal, 'currentActiveTarget');
    const pendingQueueDrainDiagnostics =
      this.readObject(device.pendingQueueDrainDiagnostics) ??
      this.readObject(targetAutoHeal?.pendingQueueDrainDiagnostics);
    const pendingDrainStatusCode = this.readSnapshotString(pendingQueueDrainDiagnostics, 'statusCode');
    const lastUploadFailureAt =
      typeof device.lastUploadFailureAt === 'string'
        ? device.lastUploadFailureAt
        : typeof device.lastUploadFailure === 'string'
          ? device.lastUploadFailure
          : null;
    const uploadSuccessNewerThanFailure = this.isTimestampAtOrAfter(systemUploadAt, lastUploadFailureAt);
    const uploadFailureNewerThanSuccess = this.isTimestampAfter(lastUploadFailureAt, systemUploadAt);
    const historicalOldTargetFailure =
      Boolean(lastFailureTarget && currentActiveTarget) &&
      this.normalizeTargetForComparison(lastFailureTarget) !==
        this.normalizeTargetForComparison(currentActiveTarget);
    const currentActiveTargetFailed =
      Boolean(lastUploadFailureReason) &&
      (!lastFailureTarget ||
        !currentActiveTarget ||
        this.normalizeTargetForComparison(lastFailureTarget) ===
          this.normalizeTargetForComparison(currentActiveTarget));
    const smsReceiveStatus = this.readObject(device.smsReceiveStatus);
    const smsReceiveStatuses = new Set(this.readSnapshotStringArray(smsReceiveStatus, 'diagnosticStatuses'));
    const carrierDiagnostics = this.readObject(device.carrierDiagnostics);
    const carrierServiceState = this.readSnapshotString(carrierDiagnostics, 'serviceState');
    const pendingCommandNotPolled =
      commandDiagnostics.find((item) =>
        item.status === 'pending' &&
        item.pendingReason === 'command_created_but_device_not_polled',
      ) ?? null;
    const pendingCommandRequestedAt =
      typeof pendingCommandNotPolled?.requestedAt === 'string'
        ? pendingCommandNotPolled.requestedAt
        : null;
    const lastCommandPollAt =
      typeof device.lastCommandPollAt === 'string' ? device.lastCommandPollAt : null;
    const commandPollMissingOrPredatesPendingCommand =
      pendingCommandRequestedAt !== null &&
      (lastCommandPollAt === null ||
        Date.parse(lastCommandPollAt) < Date.parse(pendingCommandRequestedAt));

    if (status === 'unknown') {
      return {
        level: 'info',
        title: '设备从未上报',
        summary: '后端还没有该设备的心跳缓存，无法判断权限、网络或短信链路。',
        recommendations: ['打开 Android bridge 应用，确认后端地址和 token 后手动轮询一次。'],
      };
    }
    if (status === 'offline') {
      return {
        level: 'error',
        title: '设备离线',
        summary: `最后心跳为 ${heartbeatAge === null ? '未知时间' : `${Math.round(heartbeatAge / 60)} 分钟前`}，当前无法判断权限和短信状态。`,
        recommendations: ['检查手机是否开机、是否在同一局域网、Android bridge 是否被系统限制后台运行。'],
      };
    }
    if (status === 'stale') {
      return {
        level: 'warning',
        title: '设备状态过期',
        summary: `最后心跳约 ${heartbeatAge === null ? '未知' : `${Math.round(heartbeatAge / 60)} 分钟前`}，页面展示的是最近一次缓存。`,
        recommendations: ['检查手机是否还在同一局域网，并在手机端手动轮询命令刷新状态。'],
      };
    }
    if (targetSubnetMismatch && !targetReachable) {
      return {
        level: 'error',
        title: '检测到旧局域网后台地址残留',
        summary: `手机当前网段与后台目标不一致。当前 active target：${currentActiveTarget || '未知'}；最近失败 target：${lastFailureTarget || '未知'}。`,
        recommendations: ['触发后台重新发现；如果设备无法拉取命令，请先在 Android bridge 本地执行重新发现后台。'],
      };
    }
    if (
      targetReachable &&
      pendingQueueCount === 0 &&
      smsReceiveStatuses.has('upload_link_ok') &&
      smsReceiveStatuses.has('carrier_unavailable')
    ) {
      return {
        level: 'warning',
        statusCode: 'carrier_unavailable',
        title: '设备在线，后台上传链路正常，但当前 SIM 无运营商信号，无法验收真实短信接收。',
        summary:
          `当前上传链路：upload_link_ok；后台目标：backend_target_ok；pending 队列：pending_queue_empty。` +
          `短信接收能力不可用，service state=${carrierServiceState || 'unknown'}。`,
        recommendations: ['这不是后台上传失败；请在有运营商信号或可用漫游环境下再验收真实短信接收。'],
      };
    }
    if (targetReachable && pendingQueueCount === 0 && pendingDrainStatusCode === 'pending_queue_quarantined_unreplayable') {
      return {
        level: 'warning',
        statusCode: 'pending_queue_quarantined_unreplayable',
        title: '缺少 payload 的 pending 队列项已进入隔离',
        summary:
          `当前 active pending 队列已清空；${
            this.readSnapshotNumber(pendingQueueDrainDiagnostics, 'unreplayableCount') ?? 0
          } 条缺少可重放 payload 的队列项已标记为 quarantined/unreplayable。` +
          `最近隔离原因：${
            this.readSnapshotString(pendingQueueDrainDiagnostics, 'lastQuarantineReason') || 'unknown'
          }。`,
        recommendations: [
          '保留隔离审计信息并人工确认是否关闭；不要再次强制重放不存在的短信 payload。',
          '该状态不代表银行短信已确认，也不创建收款、付款、工单或虚拟账记录。',
        ],
        pendingQueueDrainDiagnostics,
      };
    }
    if (targetReachable && pendingQueueCount > 0 && payloadValidationFailure) {
      return {
        level: 'warning',
        statusCode: 'payload_validation_error',
        title: '当前网络可达，但 pending 队列存在 payload 校验失败',
        summary:
          `当前 active target ${currentActiveTarget || '未知'} 可达；队列剩余 ${pendingQueueCount} 条。` +
          `失败类型：payload_validation_error；失败字段：${payloadValidationFailure.field}；` +
          `最近失败 target ${lastFailureTarget || '未知'}。这不是网络 target 故障。`,
        recommendations: [
          `修复/规范化 ${payloadValidationFailure.field} 后执行“强制重试待上传队列”。`,
        ],
      };
    }
    if (
      targetReachable &&
      pendingQueueCount > 0 &&
      pendingDrainStatusCode === 'pending_scan_limit_reached_not_quarantined'
    ) {
      return {
        level: 'warning',
        statusCode: 'pending_scan_limit_reached_not_quarantined',
        title: 'Pending queue stayed active after bounded inbox scan limit',
        summary:
          `Active target ${currentActiveTarget || 'unknown'} is reachable, but the bounded inbox scan hit its limit ` +
          `before matching all pending keys. Unmatched in scan window: ${
            this.readSnapshotNumber(pendingQueueDrainDiagnostics, 'scanLimitUnmatchedCount') ?? 'unknown'
          }; active pending remains ${pendingQueueCount}. No item was quarantined or canceled.`,
        recommendations: [
          'Keep the pending item active for a future worker retry or deeper safe scan.',
          'Do not treat a bounded scan miss as missing payload, and do not confirm finance state from this diagnostic.',
        ],
        pendingQueueDrainDiagnostics,
      };
    }
    if (
      targetReachable &&
      pendingQueueCount > 0 &&
      pendingDrainStatusCode === 'pending_payload_not_found_in_scan_window'
    ) {
      return {
        level: 'warning',
        statusCode: 'pending_payload_not_found_in_scan_window',
        title: 'Pending queue payload was not found in the current scan window',
        summary:
          `Active target ${currentActiveTarget || 'unknown'} is reachable, but the current inbox scan did not match ` +
          `all pending keys. Unmatched but not quarantined: ${
            this.readSnapshotNumber(pendingQueueDrainDiagnostics, 'notQuarantinedUnmatchedCount') ?? 'unknown'
          }; active pending remains ${pendingQueueCount}.`,
        recommendations: [
          'Leave the pending item active unless a separate safe confirmation proves the payload is unreplayable.',
          'Do not cancel the worker or create finance/payment/work-order/ledger state from this diagnostic.',
        ],
        pendingQueueDrainDiagnostics,
      };
    }
    if (targetReachable && pendingCommandNotPolled && commandPollMissingOrPredatesPendingCommand) {
      return {
        level: 'warning',
        statusCode: 'command_polling_stale',
        title: 'Backend target is reachable, but the Android bridge has not fetched the new command yet',
        summary:
          `Active target ${currentActiveTarget || 'unknown'} is reachable and the device is online, ` +
          `but command #${pendingCommandNotPolled.id ?? 'unknown'} was created after the last command poll. ` +
          `Last command poll age: ${commandPollAge ?? 'unknown'} seconds; pending queue: ${pendingQueueCount}.`,
        recommendations: [
          'Keep the Android bridge foreground service running; the updated APK polls on app foreground, service tick, network restore, target switch, and upload recovery.',
          'If this message remains after the next foreground-service tick, rebuild/install the updated APK with adb install -r.',
        ],
        commandPolling: {
          lastCommandPollAt,
          lastCommandPollAgeSeconds: commandPollAge,
          pendingCommandId: pendingCommandNotPolled.id ?? null,
          pendingCommandRequestedAt,
          pendingReason: pendingCommandNotPolled.pendingReason ?? null,
        },
      };
    }
    if (
      targetReachable &&
      pendingQueueCount > 0 &&
      (pendingDrainStatusCode === 'pending_drain_failed' ||
        pendingDrainStatusCode === 'pending_retried_still_failed')
    ) {
      return {
        level: 'warning',
        statusCode: pendingDrainStatusCode,
        title: 'Pending queue was retried but still did not clear',
        summary:
          `Active target ${currentActiveTarget || 'unknown'} is reachable, but pending remains ${pendingQueueCount}. ` +
          `Last drain reason: ${
            this.readSnapshotString(pendingQueueDrainDiagnostics, 'lastDrainFailureReason') || 'unknown'
          }; last flush after: ${
            this.readSnapshotNumber(pendingQueueDrainDiagnostics, 'lastFlushPendingAfter') ?? 'unknown'
          }.`,
        recommendations: [
          'Check the pending queue drain diagnostics before pressing force retry again.',
          'Do not treat this as bank SMS confirmation; it is still only a mobile upload replay path.',
        ],
        pendingQueueDrainDiagnostics,
      };
    }
    if (targetReachable && pendingQueueCount > 0 && pendingDrainStatusCode === 'pending_old_target') {
      return {
        level: 'warning',
        statusCode: 'pending_old_target',
        title: 'Pending queue is linked to an old target history, but the current active target is reachable',
        summary:
          `Active target ${currentActiveTarget || 'unknown'} is reachable; old target ${
            lastFailureTarget || this.readSnapshotString(pendingQueueDrainDiagnostics, 'lastRetryPreviousTarget') || 'unknown'
          } is historical. The updated bridge should retry pending items against the current active target.`,
        recommendations: [
          'Install/run the updated Android bridge so automatic drain uses the current active target.',
          'Do not clear or delete the pending SMS queue.',
        ],
        pendingQueueDrainDiagnostics,
      };
    }
    if (targetReachable && payloadValidationFailure && uploadSuccessNewerThanFailure) {
      return {
        level: 'info',
        statusCode: 'historical_payload_validation_error',
        title: '当前上传链路可达，存在历史 payload 校验失败记录',
        summary:
          `当前 active target ${currentActiveTarget || '未知'} 可达，最近上传成功晚于失败。` +
          `历史失败类型：payload_validation_error；历史失败字段：${payloadValidationFailure.field}；` +
          `当前 pending 队列 ${pendingQueueCount} 条。`,
        recommendations: ['无需按网络故障处理；如页面仍显示旧失败，可保留为历史诊断记录。'],
      };
    }
    if (targetReachable && uploadSuccessNewerThanFailure && pendingQueueCount > 0) {
      return {
        level: 'warning',
        statusCode: 'current_reachable_with_pending_backlog',
        title: '当前上传链路可达，但 pending 队列仍有积压',
        summary:
          `当前 active target ${currentActiveTarget || '未知'} 可达，最近上传成功晚于最近失败。` +
          `待上传队列 ${pendingQueueCount} 条；最近失败 target ${lastFailureTarget || '无'} ` +
          `${historicalOldTargetFailure ? '属于历史旧 target 失败，不是当前链路故障。' : '需要继续观察。'}`,
        recommendations: ['执行“强制重试待上传队列”，让旧 pending 队列使用当前 active target 重新发送。'],
      };
    }
    if (targetReachable && historicalOldTargetFailure && uploadSuccessNewerThanFailure) {
      return {
        level: 'info',
        statusCode: 'historical_old_target_failure',
        title: '当前上传链路可达，存在历史旧 target 失败记录',
        summary:
          `当前 active target ${currentActiveTarget || '未知'} 可达；最近失败 target ` +
          `${lastFailureTarget || '未知'} 是旧地址，且最近上传成功晚于失败。`,
        recommendations: ['如页面仍有旧失败提示，可清理旧失败 target 诊断记录；不要删除短信队列。'],
      };
    }
    if (!targetReachable) {
      if (wifiSsid && wifiSsid !== 'unknown' && wifiProfileMatched === false) {
        return {
          level: 'error',
          title: '当前 WiFi 未绑定后端目标',
          summary: `设备连接到 WiFi「${wifiSsid}」，但没有命中该 WiFi 的后端地址绑定，当前目标不可达。`,
          recommendations: ['在 Android bridge 中填入当前办公室 WiFi 可达的后端 URL，并点击 health check 或轮询命令保存绑定。'],
        };
      }
      if (wifiSsidPermission === 'missing') {
        return {
          level: 'warning',
          title: '后端不可达，且无法读取 WiFi 名称',
          summary: 'Android 没有位置权限，无法用 WiFi 名称匹配连接方案；当前目标也不可达。',
          recommendations: ['授予 WiFi SSID 所需的位置权限后，按当前 WiFi 保存后端 URL 绑定。'],
        };
      }
      return {
        level: 'error',
        title: '设备在线，但后端目标不可达',
        summary: '心跳存在，但 Android 端上报当前后端目标不可达，短信可能只停留在本地队列。',
        recommendations: ['检查手机端后端目标地址、端口、防火墙、办公室 Wi-Fi 网段是否变化。'],
      };
    }
    if (uploadFailureNewerThanSuccess && currentActiveTargetFailed) {
      return {
        level: 'error',
        statusCode: 'current_upload_failed',
        title: '当前上传链路失败',
        summary: `最近上传失败晚于最近成功，且失败 target 指向当前 active target：${currentActiveTarget || '未知'}。`,
        recommendations: ['先测试上传；若失败，检查手机到当前后台地址的网络、端口、防火墙和 token。'],
      };
    }
    if (receivePermission === null || readPermission === null) {
      return {
        level: 'warning',
        title: '设备在线，权限状态未知',
        summary: '设备心跳没有携带 RECEIVE_SMS / READ_SMS 权限字段，可能是旧 APK 或尚未重新上报权限。',
        recommendations: ['重新打开 Android bridge 或安装新版 APK 后触发一次心跳。'],
      };
    }
    if (receivePermission === false || readPermission === false) {
      return {
        level: 'error',
        title: '短信权限缺失',
        summary: `RECEIVE_SMS=${receivePermission === true ? '已授权' : '未授权'}，READ_SMS=${readPermission === true ? '已授权' : '未授权'}。`,
        recommendations: ['在手机系统权限中授予 RECEIVE_SMS 和 READ_SMS，然后重新执行手动同步。'],
      };
    }
    if (commandPollAge !== null && commandPollAge > DEVICE_STALE_SECONDS) {
      return {
        level: 'warning',
        title: '设备在线，但命令轮询过期',
        summary: `最后 command polling 约 ${Math.round(commandPollAge / 60)} 分钟前，页面按钮创建的命令可能不会被手机及时拉取。`,
        recommendations: ['在手机端点击轮询命令，或检查 WorkManager 后台任务是否被电池优化限制。'],
      };
    }
    if (pendingQueueCount > 0 || lastUploadFailureReason) {
      return {
        level: 'warning',
        title: '设备在线，但上传链路有积压或失败',
        summary: `待上传队列 ${pendingQueueCount} 条，最近失败原因：${lastUploadFailureReason || '无' }。`,
        recommendations: ['先执行测试上传；若测试成功，再执行手动收件箱同步清空队列。'],
      };
    }
    if (phoneSmsAt && (!systemUploadAt || Date.parse(phoneSmsAt) > Date.parse(systemUploadAt))) {
      return {
        level: 'warning',
        title: '手机本地短信比系统入库更新',
        summary: '手机端已经看到更新的本地短信，但系统最近成功上传时间仍旧，需定位监听或同步链路。',
        recommendations: ['执行手动收件箱同步；若同步成功，优先排查自动短信监听是否失效。'],
      };
    }
    if (rawCreatedAt && !bankCreatedAt) {
      return {
        level: 'info',
        title: '系统已收到短信，但未形成银行交易',
        summary: '短信已经进入 sms_message_raw，但当前窗口未看到对应 bank_sms_transaction。',
        recommendations: ['检查短信分类规则和银行短信识别链路，不能据此直接确认资金。'],
      };
    }

    return {
      level: 'success',
      title: '设备在线，桥接链路暂未发现阻塞',
      summary: '心跳、后端目标、短信权限和上传队列均处于可继续诊断状态。',
      recommendations: ['如手机实际收到新银行短信但页面未更新，优先点击手动收件箱同步观察结果。'],
    };
  }

  private toCommandDiagnostic(command: MobileDeviceCommand, lastCommandPollAt: string | null) {
    const responsePayload = this.readObject(command.responsePayload);
    const requestedDate = this.readDate(command.requestedAt);
    const requestedAt = this.toIsoString(requestedDate);
    const executedAt = this.toIsoString(command.executedAt);
    const fetchedAt = this.readSnapshotString(responsePayload, 'fetchedAt');
    const lastFetchedAt = this.readSnapshotString(responsePayload, 'lastFetchedAt');
    const devicePolled =
      Boolean(fetchedAt || lastFetchedAt) ||
      Boolean(lastCommandPollAt && requestedDate && Date.parse(lastCommandPollAt) >= requestedDate.getTime());
    const backendReceivedResult = command.status === 'completed' || command.status === 'failed';
    const durationSeconds =
      command.executedAt === null
        ? null
        : this.deriveDurationSeconds(command.requestedAt, command.executedAt);
    const errorReason =
      command.status === 'failed'
        ? this.readSnapshotStringList(responsePayload, ['reason', 'error', 'message', 'note'])
        : null;
    const pendingReason =
      command.status === 'pending' && !devicePolled
        ? 'command_created_but_device_not_polled'
        : command.status === 'pending'
          ? 'device_polled_but_result_not_returned'
          : null;

    return {
      id: command.id,
      deviceId: command.deviceId,
      commandType: command.commandType,
      status: command.status,
      requestedAt,
      lastCommandPollAt,
      lastCommandPollAgeSeconds: this.deriveAgeSeconds(lastCommandPollAt),
      lastCommandPollBeforeRequest:
        lastCommandPollAt !== null && Date.parse(lastCommandPollAt) < command.requestedAt.getTime(),
      fetchedAt,
      lastFetchedAt,
      executedAt,
      commandCreated: true,
      devicePolled,
      phoneExecuted: backendReceivedResult,
      phoneExecutionSucceeded: command.status === 'completed',
      backendReceivedResult,
      durationSeconds,
      errorReason,
      pendingReason,
      responsePayload: this.sanitizeDiagnosticPayload(responsePayload),
    };
  }

  private deriveDeviceOnlineStatus(lastHeartbeatAt: string | null): DeviceOnlineStatus {
    const ageSeconds = this.deriveAgeSeconds(lastHeartbeatAt);
    if (ageSeconds === null) {
      return 'unknown';
    }
    if (ageSeconds <= DEVICE_ONLINE_SECONDS) {
      return 'online';
    }
    if (ageSeconds <= DEVICE_STALE_SECONDS) {
      return 'stale';
    }
    return 'offline';
  }

  private buildCarrierRiskSummary(rawSmsList: SmsMessageRaw[]) {
    const carrierMessages = rawSmsList
      .filter((item) => this.isCarrierMessage(item.sender, item.body))
      .slice(0, 50);

    const analyzedMessages = carrierMessages.map((item) => {
      const balanceAmount = this.extractCarrierBalanceAmountNormalized(item.body);
      const signal = this.collectCarrierSignalsNormalized(item.body, balanceAmount);
      return {
        sender: this.maskPotentialSensitiveIdentifier(item.sender),
        receivedAt: this.toIsoString(this.readDate(item.receivedAt)),
        category: this.resolveCarrierCategoryNormalized(item.body, balanceAmount),
        balanceAmount,
        matchedRules: signal.matchedRules,
        sourcePath: item.ingestSource,
        deviceSmsId: item.deviceSmsId,
        summary: this.summarizeBody(item.body),
      };
    });
    const latestBalanceSample =
      analyzedMessages.find((item) => item.balanceAmount !== null) ??
      analyzedMessages.find((item) =>
        ['balance_info', 'low_balance_candidate', 'arrears_candidate', 'stop_service_candidate'].includes(
          item.category,
        ),
      ) ??
      null;
    const rechargeSample = analyzedMessages.find((item) => item.category === 'recharge') ?? null;
    const lowBalanceCandidate = analyzedMessages.some((item) =>
      ['low_balance_candidate', 'arrears_candidate', 'stop_service_candidate'].includes(item.category),
    );
    const arrearsCandidate = analyzedMessages.some((item) =>
      ['arrears_candidate', 'stop_service_candidate'].includes(item.category),
    );
    const stopServiceCandidate = analyzedMessages.some(
      (item) => item.category === 'stop_service_candidate',
    );

    return {
      balanceSmsDetected: analyzedMessages.some(
        (item) => item.balanceAmount !== null || item.matchedRules.includes('balance_keyword'),
      ),
      lowBalanceCandidate,
      arrearsCandidate,
      stopServiceCandidate,
      lowBalanceRisk: lowBalanceCandidate,
      stopServiceRisk: stopServiceCandidate,
      latestBalanceAmount: latestBalanceSample?.balanceAmount ?? null,
      latestBalanceObservedAt: latestBalanceSample?.receivedAt ?? null,
      lastRechargeSmsTime: rechargeSample?.receivedAt ?? null,
      classificationRules: {
        carrier: '10086',
        lowBalanceCandidateRule:
          'balance amount <= 10 CNY, or low-balance keywords are present',
        arrearsCandidateRule:
          'balance amount < 0 CNY, or arrears keywords are present',
        stopServiceCandidateRule:
          'stop-service keywords are present',
        thresholds: {
          lowBalanceLessThanOrEqualCny: LOW_BALANCE_THRESHOLD_CNY,
          arrearsLessThanCny: 0,
        },
      },
      recentCarrierAlertSummary: analyzedMessages.slice(0, 10),
    };
  }

  private buildDuplicateDiagnostics(
    bridgeEvents: MobileSmsEvent[],
    rawSmsList: SmsMessageRaw[],
    diagnostic: MobileDeviceDiagnostic | null,
  ) {
    const bridgeStrictGroups = this.groupBy(bridgeEvents, (item) => this.buildFrozenBridgeEventKey(item));
    const rawStrictGroups = this.groupBy(rawSmsList, (item) => this.buildFrozenRawSmsKey(item));
    const rawLooseGroups = this.groupBy(rawSmsList, (item) => this.buildLooseRawSmsKey(item));
    const bridgeEventsByLooseKey = this.groupBy(bridgeEvents, (item) => this.buildLooseBridgeEventKey(item));

    const bridgeDuplicateGroups = Array.from(bridgeStrictGroups.entries()).filter(([, items]) => items.length > 1);
    const rawDuplicateGroups = Array.from(rawStrictGroups.entries()).filter(([, items]) => items.length > 1);
    const rawLooseDuplicateGroups = Array.from(rawLooseGroups.entries()).filter(([, items]) => items.length > 1);
    const dualPathGroups = Array.from(rawLooseGroups.entries()).filter(([, items]) => {
      if (items.length < 2) {
        return false;
      }
      return new Set(items.map((item) => item.ingestSource)).size > 1;
    });
    const retryDuplicateGroups = Array.from(rawLooseGroups.entries()).filter(([, items]) => {
      if (items.length < 2) {
        return false;
      }
      return new Set(items.map((item) => item.ingestSource)).size === 1;
    });
    const dualPathGroupKeys = new Set(dualPathGroups.map(([key]) => key));
    const rawLooseGroupKeys = new Set(rawLooseDuplicateGroups.map(([key]) => key));
    const matchedLooseGroupCount = Array.from(dualPathGroupKeys).filter((key) => rawLooseGroupKeys.has(key)).length;
    const queueItemCountDetail = this.buildQueueItemCountDetail(bridgeEvents, rawSmsList, diagnostic);

    return {
      uiProjectionDuplicate: {
        count: 0,
        note: 'Current diagnostics intentionally project the same ids into bridge, raw, and trace panels. This is not a storage duplicate.',
      },
      dualPathDuplicate: {
        groupCount: dualPathGroups.length,
        proof:
          'Each dual-path group contains both live_broadcast and inbox_sync rows under the same loose content key.',
        sampleGroups: dualPathGroups.map(([key, items]) =>
          this.toRawDuplicateSample(key, items, bridgeEventsByLooseKey, 'dual_path_candidate'),
        ),
      },
      uploadRetryDuplicate: {
        groupCount: retryDuplicateGroups.length,
        pendingUploadQueueCount: diagnostic?.pendingUploadQueueCount ?? 0,
        lastUploadFailureReason: this.readSnapshotString(diagnostic?.runtimeSnapshotJson, 'lastUploadFailureReason'),
        queueItemCountDetail,
        sampleGroups: retryDuplicateGroups.slice(0, 10).map(([key, items]) =>
          this.toRawDuplicateSample(key, items, bridgeEventsByLooseKey, 'retry_candidate'),
        ),
      },
      databaseTrueDuplicate: {
        bridgeEventGroupCount: bridgeDuplicateGroups.length,
        rawSmsGroupCount: rawDuplicateGroups.length,
        note:
          'True DB duplicates require the frozen primary/fallback key to collide. Loose dual-path groups are tracked separately.',
        bridgeEventSamples: bridgeDuplicateGroups.slice(0, 10).map(([key, items]) =>
          this.toBridgeDuplicateSample(key, items, 'exact_key_conflict'),
        ),
        rawSmsSamples: rawDuplicateGroups.slice(0, 10).map(([key, items]) =>
          this.toRawDuplicateSample(key, items, bridgeEventsByLooseKey, 'exact_key_conflict'),
        ),
      },
      dualPathVsRawLooseComparison: {
        legacyRawDbLooseGroupCount: rawLooseDuplicateGroups.length,
        dualPathGroupCount: dualPathGroups.length,
        matchedGroupCount: matchedLooseGroupCount,
        oneToOne:
          matchedLooseGroupCount === dualPathGroups.length &&
          matchedLooseGroupCount === rawLooseDuplicateGroups.length,
        note:
          'The previously reported raw DB duplicate groups were loose-key groups. In the current sample window they align one-to-one with dual-path groups.',
      },
      dedupeKeyPolicy: {
        primary: 'deviceId + deviceSmsId',
        fallback: 'deviceId + simSlot + sender + deviceReceivedAt + normalizedBody',
        singleUpsertEntry:
          'MobileBridgeService.createSmsEvent -> MessageHubService.processInboundSms -> ingestSmsMessage',
        singleUpsertProof:
          'Both live_broadcast and inbox_sync converge on POST /mobile-bridge/sms-events and then reuse the same backend upsert path.',
        safeHistoricalDedupPlan: [
          'Review legacy dual-path groups one by one and keep the earliest evidence row as the survivor.',
          'Backfill deviceSmsId or dedupeFingerprint only when the original device evidence is trustworthy.',
          'Do not run bulk delete in SAFE mode; archive or soft-merge only after sample review.',
        ],
      },
      queueItemCountDetail,
      duplicateGroupSamples: dualPathGroups.map(([key, items]) =>
        this.toRawDuplicateSample(key, items, bridgeEventsByLooseKey, 'dual_path_candidate'),
      ),
    };
  }

  private isCarrierMessage(sender: string, body: string) {
    const normalizedSender = normalizeMobileSmsSender(sender);
    if (CARRIER_SENDERS.has(normalizedSender)) {
      return true;
    }

    return ['中国移动', '中国联通', '中国电信', '话费', '停机', '充值'].some((keyword) =>
      body.includes(keyword),
    );
  }

  private resolveCarrierCategory(body: string) {
    if (STOP_SERVICE_KEYWORDS.some((keyword) => body.includes(keyword))) {
      return 'stop_service_risk';
    }
    if (LOW_BALANCE_KEYWORDS.some((keyword) => body.includes(keyword))) {
      return 'low_balance_risk';
    }
    if (RECHARGE_KEYWORDS.some((keyword) => body.includes(keyword))) {
      return 'recharge';
    }
    if (BALANCE_KEYWORDS.some((keyword) => body.includes(keyword))) {
      return 'balance';
    }
    return 'carrier_alert';
  }

  private summarizeBody(body: string | null | undefined) {
    const length = typeof body === 'string' ? body.length : 0;
    return `redacted_sms_body:length=${length}`;
  }

  private maskPotentialSensitiveIdentifier(value: string | null | undefined) {
    if (!value) {
      return 'unknown';
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return 'unknown';
    }
    return trimmed.replace(/\d{5,}/g, (matched) => {
      if (matched.length <= 6) {
        return `${matched.slice(0, 2)}***`;
      }
      return `${matched.slice(0, 3)}***${matched.slice(-2)}`;
    });
  }

  private redactDiagnosticText(value: string | null | undefined) {
    if (!value?.trim()) {
      return null;
    }
    return `redacted_text:length=${value.trim().length}`;
  }

  private sanitizeDiagnosticPayload(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeDiagnosticPayload(item));
    }
    if (!value || typeof value !== 'object') {
      return this.redactSensitiveDiagnosticString(value);
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const normalizedKey = key.toLowerCase();
      if (this.isSmsBodyLikeKey(normalizedKey)) {
        sanitized[key] = this.summarizeBody(typeof entry === 'string' ? entry : null);
        continue;
      }
      if (this.isSecretLikeKey(normalizedKey)) {
        sanitized[key] = '<redacted>';
        continue;
      }
      if (this.isIdentifierLikeKey(normalizedKey) && typeof entry === 'string') {
        sanitized[key] = this.maskPotentialSensitiveIdentifier(entry);
        continue;
      }
      sanitized[key] = this.sanitizeDiagnosticPayload(entry);
    }
    return sanitized;
  }

  private isSmsBodyLikeKey(key: string) {
    return (
      key === 'body' ||
      key === 'bodypreview' ||
      key === 'messagebody' ||
      key === 'smsbody' ||
      key === 'rawbody'
    );
  }

  private isSecretLikeKey(key: string) {
    return (
      key.includes('token') ||
      key.includes('secret') ||
      key.includes('password') ||
      key.includes('authorization') ||
      key.includes('credential')
    );
  }

  private isIdentifierLikeKey(key: string) {
    return (
      key.includes('phone') ||
      key.includes('sender') ||
      key.includes('account') ||
      key.includes('card') ||
      key.includes('credential')
    );
  }

  private redactSensitiveDiagnosticString(value: unknown) {
    if (typeof value !== 'string') {
      return value;
    }
    return value
      .replace(/\b\d{11,}\b/g, (matched) => this.maskPotentialSensitiveIdentifier(matched))
      .replace(/(token|password|secret|authorization)\s*[:=]\s*[^,\s)]+/gi, '$1=<redacted>');
  }

  private collectCarrierSignalsNormalized(body: string, balanceAmount: number | null) {
    const hasStopServiceKeyword = STOP_SERVICE_KEYWORDS_NORMALIZED.some((keyword) => body.includes(keyword));
    const hasArrearsKeyword = ARREARS_KEYWORDS.some((keyword) => body.includes(keyword));
    const hasLowBalanceKeyword = LOW_BALANCE_KEYWORDS_NORMALIZED.some((keyword) => body.includes(keyword));
    const hasRechargeKeyword = RECHARGE_KEYWORDS_NORMALIZED.some((keyword) => body.includes(keyword));
    const hasBalanceKeyword =
      BALANCE_KEYWORDS_NORMALIZED.some((keyword) => body.includes(keyword)) || balanceAmount !== null;
    const matchedRules: string[] = [];
    if (hasBalanceKeyword) {
      matchedRules.push('balance_keyword');
    }
    if (hasLowBalanceKeyword || (balanceAmount !== null && balanceAmount <= LOW_BALANCE_THRESHOLD_CNY)) {
      matchedRules.push('low_balance_candidate');
    }
    if (hasArrearsKeyword || (balanceAmount !== null && balanceAmount < 0)) {
      matchedRules.push('arrears_candidate');
    }
    if (hasStopServiceKeyword) {
      matchedRules.push('stop_service_candidate');
    }
    if (hasRechargeKeyword) {
      matchedRules.push('recharge');
    }

    return {
      matchedRules,
      hasStopServiceKeyword,
      hasArrearsKeyword,
      hasLowBalanceKeyword,
      hasRechargeKeyword,
      hasBalanceKeyword,
    };
  }

  private extractCarrierBalanceAmountNormalized(body: string) {
    const patterns = [
      /\u8bdd\u8d39\u4f59\u989d(?:\u4e3a)?[\s\uff1a:]*([\-－−]?\d+(?:\.\d+)?)\s*\u5143/u,
      /\u53ef\u7528\u4f59\u989d(?:\u4e3a)?[\s\uff1a:]*([\-－−]?\d+(?:\.\d+)?)\s*\u5143/u,
      /\u4f59\u989d(?:\u4e3a)?[\s\uff1a:]*([\-－−]?\d+(?:\.\d+)?)\s*\u5143/u,
    ];
    for (const pattern of patterns) {
      const matched = body.match(pattern);
      if (!matched) {
        continue;
      }
      const value = Number(matched[1].replace(/[－−]/g, '-'));
      if (!Number.isNaN(value)) {
        return value;
      }
    }
    return null;
  }

  private resolveCarrierCategoryNormalized(
    body: string,
    balanceAmount: number | null,
  ): CarrierCategory {
    const signal = this.collectCarrierSignalsNormalized(body, balanceAmount);
    if (signal.hasStopServiceKeyword) {
      return 'stop_service_candidate';
    }
    if (signal.hasArrearsKeyword || (balanceAmount !== null && balanceAmount < 0)) {
      return 'arrears_candidate';
    }
    if (signal.hasLowBalanceKeyword || (balanceAmount !== null && balanceAmount <= LOW_BALANCE_THRESHOLD_CNY)) {
      return 'low_balance_candidate';
    }
    if (signal.hasRechargeKeyword) {
      return 'recharge';
    }
    if (signal.hasBalanceKeyword) {
      return 'balance_info';
    }
    return 'carrier_alert';
  }

  private toDuplicateSample(
    key: string,
    items: Array<MobileSmsEvent | SmsMessageRaw>,
  ): DuplicateSample {
    const first = items[0];
    const sender = 'senderAddress' in first ? first.senderAddress : first.sender;
    const body = 'messageBody' in first ? first.messageBody : first.body;
    const sources = items.map((item) => ('ingestSource' in item ? item.ingestSource : 'bridge_event'));

    return {
      key,
      count: items.length,
      sources: Array.from(new Set(sources)),
      sender: this.maskPotentialSensitiveIdentifier(sender),
      bodyPreview: this.summarizeBody(body),
    };
  }

  private toRawDuplicateSample(
    key: string,
    items: SmsMessageRaw[],
    bridgeEventsByLooseKey: Map<string, MobileSmsEvent[]>,
    dedupeHit: string,
  ): DuplicateGroupSample {
    const first = items[0];
    const bridgeEvents = bridgeEventsByLooseKey.get(key) ?? [];

    return {
      key,
      count: items.length,
      sourcePaths: Array.from(new Set(items.map((item) => item.ingestSource))),
      sender: this.maskPotentialSensitiveIdentifier(first.sender),
      bodyPreview: this.summarizeBody(first.body),
      rawSmsIds: items.map((item) => item.id),
      bridgeEventIds: bridgeEvents.map((item) => item.id),
      deviceSmsIds: Array.from(
        new Set(
          items
            .map((item) => item.deviceSmsId?.trim() || null)
            .filter((item): item is string => Boolean(item)),
        ),
      ),
      dedupeFingerprints: Array.from(
        new Set(
          items
            .map((item) => item.dedupeFingerprint?.trim() || null)
            .filter((item): item is string => Boolean(item)),
        ),
      ),
      sampleRecords: items.map((item) => {
        const relatedBridgeEvent =
          bridgeEvents.find((bridgeEvent) => this.readBridgeEventSourcePathNormalized(bridgeEvent) === item.ingestSource) ??
          bridgeEvents[0] ??
          null;

        return {
          rawSmsId: item.id,
          bridgeEventId: relatedBridgeEvent?.id ?? null,
          sourcePath: item.ingestSource,
          deviceSmsId: item.deviceSmsId,
          dedupeFingerprint: item.dedupeFingerprint,
          deviceReceivedAt: this.toIsoString(this.readDate(item.receivedAt)),
          rawCreatedAt: this.toIsoString(this.readDate(item.createdAt)),
          queueEnqueuedAt: readParsedString(relatedBridgeEvent?.rawPayloadJson ?? null, 'queueEnqueuedAt'),
          dedupeHit,
        };
      }),
    };
  }

  private toBridgeDuplicateSample(
    key: string,
    items: MobileSmsEvent[],
    dedupeHit: string,
  ): DuplicateGroupSample {
    const first = items[0];
    const sourcePaths = new Set<string>();
    for (const item of items) {
      const sourcePath = this.readBridgeEventSourcePathNormalized(item);
      if (sourcePath) {
        sourcePaths.add(sourcePath);
      }
    }

    return {
      key,
      count: items.length,
      sourcePaths: Array.from(sourcePaths),
      sender: this.maskPotentialSensitiveIdentifier(first.senderAddress),
      bodyPreview: this.summarizeBody(first.messageBody),
      rawSmsIds: [],
      bridgeEventIds: items.map((item) => item.id),
      deviceSmsIds: Array.from(
        new Set(
          items
            .map((item) => item.deviceSmsId?.trim() || null)
            .filter((item): item is string => Boolean(item)),
        ),
      ),
      dedupeFingerprints: Array.from(
        new Set(
          items
            .map((item) => item.dedupeFingerprint?.trim() || null)
            .filter((item): item is string => Boolean(item)),
        ),
      ),
      sampleRecords: items.map((item) => ({
        rawSmsId: null,
        bridgeEventId: item.id,
        sourcePath: this.readBridgeEventSourcePathNormalized(item),
        deviceSmsId: item.deviceSmsId,
        dedupeFingerprint: item.dedupeFingerprint,
        deviceReceivedAt: this.toIsoString(this.readDate(item.receivedAtDevice)),
        rawCreatedAt: this.toIsoString(this.readDate(item.createdAt)),
        queueEnqueuedAt: readParsedString(item.rawPayloadJson, 'queueEnqueuedAt'),
        dedupeHit,
      })),
    };
  }

  private buildStrictBridgeEventKey(item: MobileSmsEvent) {
    return item.deviceSmsId?.trim() || item.dedupeFingerprint?.trim() || this.buildLooseBridgeEventKey(item);
  }

  private buildStrictRawSmsKey(item: SmsMessageRaw) {
    return item.deviceSmsId?.trim() || item.dedupeFingerprint?.trim() || this.buildLooseRawSmsKey(item);
  }

  private buildLooseBridgeEventKey(item: MobileSmsEvent) {
    return [
      item.deviceId,
      normalizeMobileSmsSender(item.senderAddress),
      normalizeMobileSmsBody(item.messageBody),
    ].join('|');
  }

  private buildLooseRawSmsKey(item: SmsMessageRaw) {
    return [
      item.deviceId,
      normalizeMobileSmsSender(item.sender),
      normalizeMobileSmsBody(item.body),
    ].join('|');
  }

  private buildFrozenBridgeEventKey(item: MobileSmsEvent) {
    if (item.deviceSmsId?.trim()) {
      return `primary|${item.deviceId}|${item.deviceSmsId.trim()}`;
    }
    if (item.dedupeFingerprint?.trim()) {
      return `fingerprint|${item.deviceId}|${item.dedupeFingerprint.trim()}`;
    }
    return [
      'exact',
      item.deviceId,
      this.readBridgeEventSimSlotNormalized(item)?.toString() ?? 'null',
      normalizeMobileSmsSender(item.senderAddress),
      this.toIsoString(this.readDate(item.receivedAtDevice)) ?? 'unknown_time',
      normalizeMobileSmsBody(item.messageBody),
    ].join('|');
  }

  private buildFrozenRawSmsKey(item: SmsMessageRaw) {
    if (item.deviceSmsId?.trim()) {
      return `primary|${item.deviceId}|${item.deviceSmsId.trim()}`;
    }
    if (item.dedupeFingerprint?.trim()) {
      return `fingerprint|${item.deviceId}|${item.dedupeFingerprint.trim()}`;
    }
    return [
      'exact',
      item.deviceId,
      item.simSlot?.toString() ?? 'null',
      normalizeMobileSmsSender(item.sender),
      this.toIsoString(this.readDate(item.receivedAt)) ?? 'unknown_time',
      normalizeMobileSmsBody(item.body),
    ].join('|');
  }

  private buildQueueItemCountDetail(
    bridgeEvents: MobileSmsEvent[],
    rawSmsList: SmsMessageRaw[],
    diagnostic: MobileDeviceDiagnostic | null,
  ) {
    const uploadStatusCounts = new Map<string, number>();
    for (const item of rawSmsList) {
      uploadStatusCounts.set(item.uploadStatus, (uploadStatusCounts.get(item.uploadStatus) ?? 0) + 1);
    }

    return {
      runtimePendingUploadQueueCount: diagnostic?.pendingUploadQueueCount ?? 0,
      recentBridgeEventsWithQueueTimestamp: bridgeEvents.filter((item) =>
        Boolean(readParsedString(item.rawPayloadJson, 'queueEnqueuedAt')),
      ).length,
      recentRawSmsWithoutDeviceSmsId: rawSmsList.filter((item) => !item.deviceSmsId?.trim()).length,
      recentRawSmsByUploadStatus: Array.from(uploadStatusCounts.entries()).map(([status, count]) => ({
        status,
        count,
      })),
    };
  }

  private readBridgeEventSourcePathNormalized(item: MobileSmsEvent) {
    const ingestPaths = Array.isArray(item.rawPayloadJson?.ingestPaths)
      ? item.rawPayloadJson.ingestPaths.filter((entry): entry is string => typeof entry === 'string')
      : [];
    if (ingestPaths.length > 1) {
      return ingestPaths.join(' + ');
    }
    if (ingestPaths.length === 1) {
      return ingestPaths[0];
    }
    return readParsedString(item.rawPayloadJson, 'ingestSource') ?? 'unknown';
  }

  private readBridgeEventSimSlotNormalized(item: MobileSmsEvent) {
    return readParsedNumber(item.rawPayloadJson, 'simSlot');
  }

  private buildRawDedupeHitIndex(rawSmsList: SmsMessageRaw[]) {
    const hitIndex = new Map<number, string>();
    const strictGroups = this.groupBy(rawSmsList, (item) => this.buildFrozenRawSmsKey(item));
    for (const [, items] of strictGroups.entries()) {
      if (items.length < 2) {
        continue;
      }
      for (const item of items) {
        hitIndex.set(item.id, 'exact_key_conflict');
      }
    }

    const looseGroups = this.groupBy(rawSmsList, (item) => this.buildLooseRawSmsKey(item));
    for (const [, items] of looseGroups.entries()) {
      if (items.length < 2) {
        continue;
      }
      const sourceCount = new Set(items.map((item) => item.ingestSource)).size;
      const hitLabel = sourceCount > 1 ? 'dual_path_candidate' : 'retry_candidate';
      for (const item of items) {
        if (!hitIndex.has(item.id)) {
          hitIndex.set(item.id, hitLabel);
        }
      }
    }

    return hitIndex;
  }

  private buildBridgeDedupeHitIndex(
    bridgeEvents: MobileSmsEvent[],
    rawSmsList: SmsMessageRaw[],
  ) {
    const hitIndex = new Map<number, string>();
    const strictGroups = this.groupBy(bridgeEvents, (item) => this.buildFrozenBridgeEventKey(item));
    for (const [, items] of strictGroups.entries()) {
      if (items.length < 2) {
        continue;
      }
      for (const item of items) {
        hitIndex.set(item.id, 'exact_key_conflict');
      }
    }

    const dualPathLooseKeys = new Set(
      Array.from(this.groupBy(rawSmsList, (item) => this.buildLooseRawSmsKey(item)).entries())
        .filter(([, items]) => items.length > 1 && new Set(items.map((item) => item.ingestSource)).size > 1)
        .map(([key]) => key),
    );
    for (const item of bridgeEvents) {
      if (hitIndex.has(item.id)) {
        continue;
      }
      if (dualPathLooseKeys.has(this.buildLooseBridgeEventKey(item))) {
        hitIndex.set(item.id, 'dual_path_candidate');
      }
    }

    return hitIndex;
  }

  private buildRawLooseSourcePathIndex(rawSmsList: SmsMessageRaw[]) {
    const index = new Map<string, string[]>();
    const looseGroups = this.groupBy(rawSmsList, (item) => this.buildLooseRawSmsKey(item));
    for (const [key, items] of looseGroups.entries()) {
      index.set(
        key,
        Array.from(new Set(items.map((item) => item.ingestSource))),
      );
    }
    return index;
  }

  private buildRemainingBridgeSteps(input: {
    dependsOnAdbReverse: boolean;
    targetReachable: boolean;
    pendingUploadQueueCount: number;
    lastUploadSuccessAt?: string | null;
    lastUploadFailureAt?: string | null;
    lastUploadFailureReason: string | null;
    currentActiveTarget?: string | null;
    lastFailureTarget?: string | null;
    targetSubnetMismatch?: boolean;
    pendingQueueBoundToLegacyTarget?: boolean;
    pendingQueueQuarantinedCount?: number | null;
    pendingQueueManualReviewNeeded?: boolean;
    pendingQueueStillActiveAfterBoundedScan?: boolean;
  }) {
    const steps: string[] = [];
    const historicalOldTargetFailure =
      Boolean(input.currentActiveTarget && input.lastFailureTarget) &&
      this.normalizeTargetForComparison(input.currentActiveTarget ?? null) !==
        this.normalizeTargetForComparison(input.lastFailureTarget ?? null);
    const successNewerThanFailure = this.isTimestampAtOrAfter(
      input.lastUploadSuccessAt ?? null,
      input.lastUploadFailureAt ?? null,
    );
    if (input.dependsOnAdbReverse) {
      steps.push('Replace localhost target with a reachable LAN, VPN, or public backend address.');
    }
    if (input.targetSubnetMismatch) {
      steps.push('Detected stale backend target from another LAN subnet; run backend rediscovery before retrying uploads.');
    }
    if (input.pendingQueueBoundToLegacyTarget) {
      steps.push('Pending upload queue still reports a legacy target binding; upload worker must resolve the active target at send time.');
    }
    if (!input.targetReachable) {
      steps.push('Verify the configured backend target is reachable from the device at runtime.');
    }
    if (input.pendingUploadQueueCount > 0) {
      if (input.pendingQueueStillActiveAfterBoundedScan) {
        steps.push('Keep scan-window misses active; use a deeper safe scan or future worker retry before considering quarantine.');
      } else {
        steps.push('Force retry the pending upload queue against the current active target and confirm queue size decreases after success.');
      }
    }
    if (input.pendingUploadQueueCount === 0 && input.pendingQueueManualReviewNeeded) {
      steps.push(
        `Review ${input.pendingQueueQuarantinedCount ?? 0} quarantined unreplayable pending queue item(s) before closing them.`,
      );
    }
    const payloadValidationFailure = this.resolveUploadPayloadValidationFailure(input.lastUploadFailureReason);
    if (payloadValidationFailure) {
      if (!(input.targetReachable && successNewerThanFailure && input.pendingUploadQueueCount === 0)) {
        steps.push(`Fix or normalize ${payloadValidationFailure.field} before forcing the pending queue retry again.`);
      }
    } else if (input.lastUploadFailureReason && !(input.targetReachable && successNewerThanFailure && historicalOldTargetFailure)) {
      steps.push(`Clear the latest upload failure: ${input.lastUploadFailureReason}`);
    }
    return steps;
  }

  private resolveUploadPayloadValidationFailure(reason: string | null) {
    if (!reason?.trim()) {
      return null;
    }
    const normalizedReason = reason.toLowerCase();
    if (
      normalizedReason.includes('ingestsource') &&
      normalizedReason.includes('live_broadcast') &&
      normalizedReason.includes('inbox_sync')
    ) {
      return {
        type: 'payload_validation_error',
        field: 'ingestSource',
      };
    }

    return null;
  }

  private deriveTransportMode(resolvedBaseUrl: string | null) {
    if (!resolvedBaseUrl) {
      return 'unknown';
    }

    try {
      const parsed = new URL(resolvedBaseUrl);
      const host = parsed.hostname.toLowerCase();
      if (host === '127.0.0.1' || host === 'localhost' || host === '::1') {
        return 'adb_reverse';
      }
      if (
        host.includes('tailscale') ||
        host.includes('zerotier') ||
        host.includes('vpn') ||
        host.includes('wg')
      ) {
        return 'vpn_tunnel';
      }
      if (/^10\.\d+\.\d+\.\d+$/.test(host) || /^192\.168\.\d+\.\d+$/.test(host) || host.endsWith('.local')) {
        return 'wifi_lan';
      }
      if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) {
        return 'wifi_lan';
      }
      return 'public_url';
    } catch {
      return 'unknown';
    }
  }

  private deriveAutoDiscoveryStatus(snapshot: Record<string, unknown> | null) {
    const startedAt = this.readSnapshotString(snapshot, 'autoDiscoveryLastStartedAt');
    const finishedAt = this.readSnapshotString(snapshot, 'autoDiscoveryLastFinishedAt');
    const errorCategory = this.readSnapshotString(snapshot, 'autoDiscoveryErrorCategory');
    if (!startedAt) {
      return 'not_run';
    }
    const startedTime = Date.parse(startedAt);
    const finishedTime = finishedAt ? Date.parse(finishedAt) : Number.NaN;
    if (!Number.isNaN(startedTime) && (Number.isNaN(finishedTime) || startedTime > finishedTime)) {
      return 'running';
    }
    return errorCategory === 'auto_discovery_succeeded' ? 'success' : 'failure';
  }

  private deriveTargetReachable(snapshot: Record<string, unknown> | null) {
    const targetReachable = this.readSnapshotBoolean(snapshot, 'targetReachable');
    if (targetReachable !== null) {
      return targetReachable;
    }

    const successAt = this.readSnapshotString(snapshot, 'lastApiSuccessAt');
    const failureAt = this.readSnapshotString(snapshot, 'lastApiFailureAt');
    const successInstant = successAt ? Date.parse(successAt) : Number.NaN;
    const failureInstant = failureAt ? Date.parse(failureAt) : Number.NaN;
    if (Number.isNaN(successInstant)) {
      return false;
    }
    if (Number.isNaN(failureInstant)) {
      return true;
    }
    return successInstant >= failureInstant;
  }

  private deriveAgeSeconds(timestamp: string | null) {
    if (!timestamp) {
      return null;
    }

    const value = Date.parse(timestamp);
    if (Number.isNaN(value)) {
      return null;
    }

    return Math.max(0, Math.round((Date.now() - value) / 1000));
  }

  private isTimestampAtOrAfter(left: string | null, right: string | null) {
    const leftTime = left ? Date.parse(left) : Number.NaN;
    const rightTime = right ? Date.parse(right) : Number.NaN;
    if (Number.isNaN(leftTime)) {
      return false;
    }
    if (Number.isNaN(rightTime)) {
      return true;
    }
    return leftTime >= rightTime;
  }

  private isTimestampAfter(left: string | null, right: string | null) {
    const leftTime = left ? Date.parse(left) : Number.NaN;
    const rightTime = right ? Date.parse(right) : Number.NaN;
    if (Number.isNaN(leftTime)) {
      return false;
    }
    if (Number.isNaN(rightTime)) {
      return true;
    }
    return leftTime > rightTime;
  }

  private pickLatestIsoString(values: Array<string | null | undefined>) {
    let latestValue: string | null = null;
    let latestTime = Number.NaN;
    for (const value of values) {
      if (!value) {
        continue;
      }
      const time = Date.parse(value);
      if (Number.isNaN(time)) {
        continue;
      }
      if (!latestValue || Number.isNaN(latestTime) || time > latestTime) {
        latestValue = value;
        latestTime = time;
      }
    }
    return latestValue;
  }

  private normalizeTargetForComparison(value: string | null) {
    if (!value) {
      return '';
    }
    try {
      const parsed = new URL(value.includes('://') ? value : `http://${value}`);
      const port =
        parsed.port ||
        (parsed.protocol === 'https:' ? '443' : parsed.protocol === 'http:' ? '80' : '');
      return `${parsed.protocol}//${parsed.hostname.toLowerCase()}:${port}`.replace(/\/+$/, '');
    } catch {
      return value.trim().replace(/\/+$/, '').toLowerCase();
    }
  }

  private deriveDurationSeconds(start: Date | string | null | undefined, end: Date | string | null | undefined) {
    const startAt = this.readDate(start);
    const endAt = this.readDate(end);
    if (!startAt || !endAt) {
      return null;
    }
    return Math.max(0, Math.round((endAt.getTime() - startAt.getTime()) / 1000));
  }

  private deriveBodyBusinessDate(body: string, referenceDate: Date) {
    const matched = body.match(/于(\d{2})月(\d{2})日/);
    if (!matched) {
      return null;
    }

    const [, month, day] = matched;
    return `${referenceDate.getFullYear()}-${month}-${day}`;
  }

  private groupBy<T>(items: T[], resolver: (item: T) => string) {
    const grouped = new Map<string, T[]>();
    for (const item of items) {
      const key = resolver(item);
      const list = grouped.get(key);
      if (list) {
        list.push(item);
      } else {
        grouped.set(key, [item]);
      }
    }
    return grouped;
  }

  private buildHeartbeatRuntimePatch(
    dto: CreateMobileDiagnosticHeartbeatDto,
    runtimeSnapshot: Record<string, unknown> | null,
  ) {
    const patch: Record<string, unknown> = {
      ...(runtimeSnapshot ?? {}),
    };
    const putString = (key: string, value: string | undefined) => {
      if (value?.trim()) {
        patch[key] = value.trim();
      }
    };

    putString('lastCommandPollAt', dto.lastCommandPollAt);
    putString('lastLocalSmsReceivedAt', dto.lastLocalSmsReceivedAt);
    putString('lastUploadSuccessAt', dto.lastUploadSuccessAt);
    putString('lastUploadFailureAt', dto.lastUploadFailureAt);
    putString('lastUploadFailureReason', dto.lastUploadFailureReason);
    putString('lastApiSuccessAt', dto.lastApiSuccessAt);
    putString('lastApiFailureAt', dto.lastApiFailureAt);
    putString('lastApiFailureReason', dto.lastApiFailureReason);
    putString('batteryOptimizationStatus', dto.batteryOptimizationStatus);
    putString('appVisibilityStatus', dto.appVisibilityStatus);
    putString('serviceRunningStatus', dto.serviceRunningStatus);

    if (dto.lastUploadSuccessAt?.trim() && !dto.lastUploadFailureReason?.trim()) {
      patch.lastUploadFailureAt = null;
      patch.lastUploadFailureReason = null;
    }

    if (dto.lastApiSuccessAt?.trim() && !dto.lastApiFailureReason?.trim()) {
      patch.lastApiFailureAt = null;
      patch.lastApiFailureReason = null;
    }

    return patch;
  }

  private async mergeDiagnosticRuntimeSnapshot(
    deviceId: string,
    patch: Record<string, unknown>,
    mutateRecord?: (record: MobileDeviceDiagnostic) => void,
  ) {
    const normalizedDeviceId = deviceId.trim();
    let record =
      (await this.mobileDeviceDiagnosticRepository.findOne({
        where: { deviceId: normalizedDeviceId },
      })) ?? this.mobileDeviceDiagnosticRepository.create({ deviceId: normalizedDeviceId });

    record.runtimeSnapshotJson = {
      ...(this.readObject(record.runtimeSnapshotJson) ?? {}),
      ...patch,
    };
    mutateRecord?.(record);
    record = await this.mobileDeviceDiagnosticRepository.save(record);
    return record;
  }

  private readObject(value: unknown) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  }

  private readSnapshotString(snapshot: Record<string, unknown> | null | undefined, key: string) {
    return readParsedString(snapshot ?? null, key);
  }

  private readSnapshotStringList(
    snapshot: Record<string, unknown> | null | undefined,
    keys: string[],
  ) {
    for (const key of keys) {
      const value = this.readSnapshotString(snapshot, key);
      if (value) {
        return value;
      }
    }
    return null;
  }

  private readSnapshotStringArray(
    snapshot: Record<string, unknown> | null | undefined,
    key: string,
  ) {
    const value = snapshot?.[key];
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
  }

  private readSnapshotNumber(snapshot: Record<string, unknown> | null | undefined, key: string) {
    const value = snapshot?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    return null;
  }

  private readSnapshotNumberList(
    snapshot: Record<string, unknown> | null | undefined,
    keys: string[],
  ) {
    for (const key of keys) {
      const value = this.readSnapshotNumber(snapshot, key);
      if (value !== null) {
        return value;
      }
    }
    return null;
  }

  private readSnapshotBoolean(snapshot: Record<string, unknown> | null | undefined, key: string) {
    const value = snapshot?.[key];
    return typeof value === 'boolean' ? value : null;
  }

  private inferSimPresent(simState: string) {
    if (simState === 'absent') {
      return false;
    }
    if (!simState || simState === 'unknown') {
      return null;
    }
    return true;
  }

  private inferSmsReceiveCapability(input: {
    simPresent: boolean | null;
    serviceState: string;
    receiveSmsPermission: boolean | null;
  }) {
    if (input.receiveSmsPermission !== true) {
      return 'unknown';
    }
    if (input.simPresent === false) {
      return 'unavailable';
    }
    if (
      input.serviceState === 'out_of_service' ||
      input.serviceState === 'emergency_only' ||
      input.serviceState === 'power_off'
    ) {
      return 'unavailable';
    }
    if (input.simPresent === null || input.serviceState === 'unknown') {
      return 'unknown';
    }
    return 'can_receive';
  }

  private inferSmsReceiveUnavailableReason(input: {
    simPresent: boolean | null;
    serviceState: string;
    receiveSmsPermission: boolean | null;
  }) {
    if (input.receiveSmsPermission !== true) {
      return 'sms_receive_permission_unknown';
    }
    if (input.simPresent === false) {
      return 'no_sim';
    }
    if (
      input.serviceState === 'out_of_service' ||
      input.serviceState === 'emergency_only' ||
      input.serviceState === 'power_off'
    ) {
      return 'sim_no_signal';
    }
    return null;
  }

  private readDate(value: Date | string | null | undefined) {
    if (!value) {
      return null;
    }
    if (value instanceof Date) {
      return value;
    }
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? null : new Date(timestamp);
  }

  private toIsoString(value: Date | null | undefined) {
    return value ? value.toISOString() : null;
  }

  private assertReadable(currentUser: CurrentUser) {
    if (
      currentUser.roleCodes.some((roleCode) =>
        READ_ROLES.includes(roleCode as (typeof READ_ROLES)[number]),
      )
    ) {
      return;
    }

    throw new ForbiddenException('Current role cannot view mobile diagnostics.');
  }

  private assertWritable(currentUser: CurrentUser) {
    if (
      currentUser.roleCodes.some((roleCode) =>
        WRITE_ROLES.includes(roleCode as (typeof WRITE_ROLES)[number]),
      )
    ) {
      return;
    }

    throw new ForbiddenException('Current role cannot issue mobile diagnostics commands.');
  }
}
