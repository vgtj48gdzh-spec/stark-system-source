import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { MobileDiagnosticsService } from '../mobile-diagnostics/mobile-diagnostics.service';
import {
  ControlHomeClimateDeviceDto,
  CreateHomeClimatePresetDto,
  ListHomeClimateControlLogsDto,
  LobsterHomeClimateContextControlDto,
  LobsterHomeClimateControlDto,
  RegisterHomeClimateDeviceDto,
  UpdateHomeClimateDeviceDto,
  UpdateHomeClimatePresetDto,
} from './dto/home-climate.dto';
import {
  HomeClimateControlLog,
  HomeClimateDeliveryStatus,
  HomeClimateDevice,
  HomeClimatePreset,
  HomeClimateTriggerSource,
} from './entities/home-climate.entities';
import {
  assertHomeClimateLobsterPresetContract,
  HOME_CLIMATE_LOBSTER_CONTEXT_PATH,
  HOME_CLIMATE_PRESENCE_DEFAULT_MAX_AGE_MS,
  HomeClimateGatewayHeaders,
  HomeClimatePolicyError,
  OFFICE_AC_POWER_OFF_MAX_WATTS,
  OFFICE_AC_POWER_OFF_MIN_WATTS,
  resolveHomeClimateContextRoute,
  resolveHomeClimatePresence,
  sanitizeHomeClimateState,
  sha256,
  stableStringify,
  stateMatchesRequestedProperties,
  validateHomeClimateProperties,
  verifyHomeClimateGatewayRequest,
} from './home-climate-security.policy';

const MODULE_NAME = 'home-climate';
const DEFAULT_BRIDGE_TIMEOUT_MS = 30_000;
const DEFAULT_READBACK_DELAY_MS = 750;
const DEFAULT_READBACK_ATTEMPTS = 2;

interface BridgeResponse {
  ok?: boolean;
  properties?: Record<string, unknown>;
}

interface ControlResult {
  requestId: string;
  idempotentReplay: boolean;
  deviceCode: string;
  presetCode: string;
  presetName: string;
  deliveryStatus: HomeClimateDeliveryStatus;
  bridgeAccepted: boolean;
  deviceConfirmed: boolean;
  replyText: string;
  state: Record<string, unknown> | null;
}

interface ReadbackConfig {
  attempts: number;
  delayMs: number;
}

class HomeClimateBridgeError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'HomeClimateBridgeError';
  }
}

@Injectable()
export class HomeClimateService {
  private readonly logger = new Logger(HomeClimateService.name);

  constructor(
    @InjectRepository(HomeClimateDevice)
    private readonly deviceRepository: Repository<HomeClimateDevice>,
    @InjectRepository(HomeClimatePreset)
    private readonly presetRepository: Repository<HomeClimatePreset>,
    @InjectRepository(HomeClimateControlLog)
    private readonly controlLogRepository: Repository<HomeClimateControlLog>,
    private readonly configService: ConfigService,
    private readonly operationLogsService: OperationLogsService,
    private readonly mobileDiagnosticsService: MobileDiagnosticsService,
  ) {}

  async listDevices() {
    const devices = await this.deviceRepository.find({ order: { id: 'ASC' } });
    return devices.map((device) => this.toSafeDevice(device));
  }

  async registerDevice(dto: RegisterHomeClimateDeviceDto, currentUser: CurrentUser) {
    const deviceCode = dto.deviceCode.trim().toLowerCase();
    const did = dto.did.trim();
    const conflict = await this.deviceRepository.findOne({
      where: [{ deviceCode }, { did }],
    });
    if (conflict) {
      throw new ConflictException('[home_climate_device_conflict] 设备代码或设备标识已登记');
    }

    const record = await this.deviceRepository.save(
      this.deviceRepository.create({
        deviceCode,
        name: dto.name.trim(),
        did,
        model: dto.model?.trim() || null,
        location: dto.location?.trim() || null,
        enabled: true,
        createdBy: currentUser.id,
        updatedBy: null,
      }),
    );
    await this.operationLogsService.create({
      module: MODULE_NAME,
      targetId: record.id,
      action: 'device.register',
      detail: `家居空调设备已登记: ${record.deviceCode}`,
      detailJson: { deviceCode: record.deviceCode, didRef: this.safeRef(record.did) },
      operatorId: currentUser.id,
    });
    return this.toSafeDevice(record);
  }

  async updateDevice(
    deviceId: number,
    dto: UpdateHomeClimateDeviceDto,
    currentUser: CurrentUser,
  ) {
    const device = await this.requireDeviceById(deviceId);
    if (dto.name !== undefined) {
      device.name = dto.name.trim();
    }
    if (dto.location !== undefined) {
      device.location = dto.location.trim() || null;
    }
    if (dto.enabled !== undefined) {
      device.enabled = dto.enabled;
    }
    device.updatedBy = currentUser.id;
    const saved = await this.deviceRepository.save(device);
    await this.operationLogsService.create({
      module: MODULE_NAME,
      targetId: saved.id,
      action: 'device.update',
      detail: `家居空调设备已更新: ${saved.deviceCode}`,
      detailJson: { deviceCode: saved.deviceCode, enabled: saved.enabled },
      operatorId: currentUser.id,
    });
    return this.toSafeDevice(saved);
  }

  async listPresets(deviceId: number) {
    await this.requireDeviceById(deviceId);
    const presets = await this.presetRepository.find({
      where: { deviceId },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    return presets.map((preset) => this.toSafePreset(preset));
  }

  async createPreset(
    deviceId: number,
    dto: CreateHomeClimatePresetDto,
    currentUser: CurrentUser,
  ) {
    const device = await this.requireDeviceById(deviceId);
    const presetCode = dto.presetCode.trim().toLowerCase();
    const existing = await this.presetRepository.findOne({ where: { deviceId, presetCode } });
    if (existing) {
      throw new ConflictException('[home_climate_preset_conflict] 同一设备的预设代码已存在');
    }
    const properties = this.validatePropertiesOrThrow(dto.properties, device.model);
    const record = await this.presetRepository.save(
      this.presetRepository.create({
        deviceId,
        presetCode,
        presetName: dto.presetName.trim(),
        properties,
        enabled: true,
        sortOrder: dto.sortOrder ?? 0,
        createdBy: currentUser.id,
        updatedBy: null,
      }),
    );
    await this.operationLogsService.create({
      module: MODULE_NAME,
      targetId: record.id,
      action: 'preset.create',
      detail: `家居空调预设已创建: ${record.presetCode}`,
      detailJson: {
        deviceId,
        presetCode: record.presetCode,
        propertyKeys: Object.keys(record.properties).sort(),
      },
      operatorId: currentUser.id,
    });
    return this.toSafePreset(record);
  }

  async updatePreset(
    presetId: number,
    dto: UpdateHomeClimatePresetDto,
    currentUser: CurrentUser,
  ) {
    const preset = await this.presetRepository.findOne({ where: { id: presetId } });
    if (!preset) {
      throw new NotFoundException('[home_climate_preset_not_found] 控制预设不存在');
    }
    if (dto.presetName !== undefined) {
      preset.presetName = dto.presetName.trim();
    }
    if (dto.properties !== undefined) {
      const device = await this.requireDeviceById(preset.deviceId);
      preset.properties = this.validatePropertiesOrThrow(dto.properties, device.model);
    }
    if (dto.enabled !== undefined) {
      preset.enabled = dto.enabled;
    }
    if (dto.sortOrder !== undefined) {
      preset.sortOrder = dto.sortOrder;
    }
    preset.updatedBy = currentUser.id;
    const saved = await this.presetRepository.save(preset);
    await this.operationLogsService.create({
      module: MODULE_NAME,
      targetId: saved.id,
      action: 'preset.update',
      detail: `家居空调预设已更新: ${saved.presetCode}`,
      detailJson: {
        deviceId: saved.deviceId,
        presetCode: saved.presetCode,
        enabled: saved.enabled,
        propertyKeys: Object.keys(saved.properties).sort(),
      },
      operatorId: currentUser.id,
    });
    return this.toSafePreset(saved);
  }

  async readState(deviceId: number, currentUser: CurrentUser) {
    const device = await this.requireDeviceById(deviceId);
    const state = await this.readBridgeState(device.did);
    await this.operationLogsService.create({
      module: MODULE_NAME,
      targetId: device.id,
      action: 'device.read_state',
      detail: `家居空调状态已读取: ${device.deviceCode}`,
      detailJson: { deviceCode: device.deviceCode },
      operatorId: currentUser.id,
    });
    return { deviceCode: device.deviceCode, state };
  }

  async controlFromWeb(
    deviceId: number,
    dto: ControlHomeClimateDeviceDto,
    currentUser: CurrentUser,
  ) {
    const device = await this.requireDeviceById(deviceId);
    if (!device.enabled) {
      throw new NotFoundException('[home_climate_device_unavailable] 目标设备不存在或已停用');
    }
    const preset = await this.requirePreset(dto.presetId, device);
    const requestedAt = new Date();
    const requestId = `web:${currentUser.id}:${dto.requestIdempotencyKey}`;
    const fingerprint = sha256(
      stableStringify({
        actorId: currentUser.id,
        deviceCode: device.deviceCode,
        presetCode: preset.presetCode,
      }),
    );
    const existing = await this.controlLogRepository.findOne({ where: { requestId } });
    if (existing) {
      return this.replayExisting(existing, fingerprint);
    }
    let record: HomeClimateControlLog;
    try {
      record = await this.createPendingControlLog({
        device,
        preset,
        triggerSource: 'web',
        operatorUserId: currentUser.id,
        requestId,
        requestFingerprint: fingerprint,
        nonceHash: null,
        serviceIdHash: null,
        ownerPeerHash: null,
        requestedAt,
      });
    } catch (error) {
      if (!this.isDuplicateKeyError(error)) {
        throw error;
      }
      const raced = await this.controlLogRepository.findOne({ where: { requestId } });
      if (raced) {
        return this.replayExisting(raced, fingerprint);
      }
      throw new ConflictException('[home_climate_request_id_conflict] 重复请求已拒绝');
    }
    return this.executePersistedControl(record, device, preset, false);
  }

  async controlFromLobster(
    dto: LobsterHomeClimateControlDto,
    rawHeaders: Record<string, string | string[] | undefined>,
  ) {
    const headers = this.readGatewayHeaders(rawHeaders);
    let verified: ReturnType<typeof verifyHomeClimateGatewayRequest>;
    try {
      verified = verifyHomeClimateGatewayRequest({
        body: dto,
        headers,
        config: this.gatewayConfig(),
      });
    } catch (error) {
      const code = this.policyErrorCode(error, 'home_climate_auth_rejected');
      this.recordPreAuthSecurityTelemetry(code, headers.requestId);
      if (
        code.endsWith('_not_configured') ||
        code === 'home_climate_clock_skew_invalid' ||
        code === 'home_climate_numeric_config_invalid'
      ) {
        throw new ServiceUnavailableException(
          '[home_climate_gateway_unavailable] 家居空调网关未安全配置',
        );
      }
      throw new UnauthorizedException('[home_climate_auth_rejected] 小龙虾设备控制鉴权失败');
    }

    return this.controlVerifiedLobsterRoute(dto, verified);
  }

  async controlFromLobsterContext(
    dto: LobsterHomeClimateContextControlDto,
    rawHeaders: Record<string, string | string[] | undefined>,
  ) {
    const headers = this.readGatewayHeaders(rawHeaders);
    let verified: ReturnType<typeof verifyHomeClimateGatewayRequest>;
    try {
      verified = verifyHomeClimateGatewayRequest({
        body: dto,
        headers,
        config: this.gatewayConfig(),
        path: HOME_CLIMATE_LOBSTER_CONTEXT_PATH,
      });
    } catch (error) {
      const code = this.policyErrorCode(error, 'home_climate_auth_rejected');
      this.recordPreAuthSecurityTelemetry(code, headers.requestId);
      if (
        code.endsWith('_not_configured') ||
        code === 'home_climate_clock_skew_invalid' ||
        code === 'home_climate_numeric_config_invalid'
      ) {
        throw new ServiceUnavailableException(
          '[home_climate_gateway_unavailable] 家居空调网关未安全配置',
        );
      }
      throw new UnauthorizedException('[home_climate_auth_rejected] 小龙虾设备控制鉴权失败');
    }

    const presenceCandidates =
      (await this.mobileDiagnosticsService?.getHomeClimatePresenceCandidates?.()) ?? [];
    const presence = resolveHomeClimatePresence(
      presenceCandidates,
      Date.now(),
      this.numberConfig(
        'HOME_CLIMATE_PRESENCE_MAX_AGE_MS',
        HOME_CLIMATE_PRESENCE_DEFAULT_MAX_AGE_MS,
        60_000,
        30 * 60_000,
      ),
    );
    if (!presence.zone) {
      const code =
        presence.reason === 'conflict'
          ? 'home_climate_presence_conflict'
          : 'home_climate_presence_unknown';
      await this.auditSecurityOutcome(
        'lobster.context_rejected',
        code,
        verified.requestId,
      );
      throw new ConflictException({
        statusCode: 409,
        code,
        message: '无法从最新可信场景确定唯一空调位置，未发送设备指令',
        requestRef: this.safeRef(verified.requestId),
      });
    }

    return this.controlVerifiedLobsterRoute(
      resolveHomeClimateContextRoute({ zone: presence.zone, intent: dto.intent }),
      verified,
    );
  }

  private async controlVerifiedLobsterRoute(
    dto: LobsterHomeClimateControlDto,
    verified: ReturnType<typeof verifyHomeClimateGatewayRequest>,
  ) {
    const deviceCode = dto.deviceCode.trim().toLowerCase();
    const presetCode = dto.presetCode.trim().toLowerCase();
    const device = await this.deviceRepository.findOne({ where: { deviceCode } });
    if (!device || !device.enabled) {
      await this.auditSecurityOutcome(
        'lobster.command_rejected',
        'home_climate_device_unavailable',
        verified.requestId,
      );
      throw new NotFoundException('[home_climate_device_unavailable] 目标设备不存在或已停用');
    }
    const preset = await this.presetRepository.findOne({
      where: { deviceId: device.id, presetCode },
    });
    if (!preset || !preset.enabled) {
      await this.auditSecurityOutcome(
        'lobster.command_rejected',
        'home_climate_preset_unavailable',
        verified.requestId,
        device.id,
      );
      throw new NotFoundException('[home_climate_preset_unavailable] 控制预设不存在或已停用');
    }
    let controlPreset = preset;
    try {
      preset.properties = validateHomeClimateProperties(preset.properties, device.model);
      assertHomeClimateLobsterPresetContract({
        deviceCode: device.deviceCode,
        model: device.model,
        presetCode: preset.presetCode,
        properties: preset.properties,
      });
      controlPreset = this.parameterizeLobsterTemperaturePreset(
        preset,
        dto.temperature,
        device.model,
      );
    } catch (error) {
      const code = this.policyErrorCode(
        error,
        'home_climate_lobster_preset_contract_drift',
      );
      await this.auditSecurityOutcome(
        'lobster.command_rejected',
        code,
        verified.requestId,
        device.id,
      );
      throw new ServiceUnavailableException({
        statusCode: 503,
        code,
        message: '空调固定预设与审核契约不一致，未发送设备指令',
        requestRef: this.safeRef(verified.requestId),
      });
    }

    const existing = await this.controlLogRepository.findOne({
      where: { requestId: verified.requestId },
    });
    if (existing) {
      return this.replayExisting(existing, verified.requestFingerprint);
    }
    const nonceReplay = await this.controlLogRepository.findOne({
      where: { nonceHash: verified.nonceHash },
    });
    if (nonceReplay) {
      await this.auditSecurityOutcome(
        'lobster.replay_rejected',
        'home_climate_nonce_replayed',
        verified.requestId,
        device.id,
      );
      throw new ConflictException('[home_climate_replay_rejected] 请求随机数已使用');
    }

    let record: HomeClimateControlLog;
    try {
      record = await this.createPendingControlLog({
        device,
        preset: controlPreset,
        triggerSource: 'wechat_lobster',
        operatorUserId: null,
        requestId: verified.requestId,
        requestFingerprint: verified.requestFingerprint,
        nonceHash: verified.nonceHash,
        serviceIdHash: verified.serviceIdHash,
        ownerPeerHash: verified.ownerPeerHash,
        requestedAt: verified.requestedAt,
      });
    } catch (error) {
      if (!this.isDuplicateKeyError(error)) {
        throw error;
      }
      const raced = await this.controlLogRepository.findOne({
        where: { requestId: verified.requestId },
      });
      if (raced) {
        return this.replayExisting(raced, verified.requestFingerprint);
      }
      throw new ConflictException('[home_climate_replay_rejected] 重复请求已拒绝');
    }
    return this.executePersistedControl(record, device, controlPreset, false);
  }

  async listControlLogs(query: ListHomeClimateControlLogsDto) {
    const logs = await this.controlLogRepository.find({
      where: query.deviceId ? { deviceId: query.deviceId } : {},
      order: { id: 'DESC' },
      take: query.limit ?? 50,
    });
    return logs.map((record) => ({
      id: record.id,
      requestRef: this.safeRef(record.requestId),
      deviceId: record.deviceId,
      deviceCode: record.deviceCodeSnapshot,
      presetId: record.presetId,
      presetCode: record.presetCodeSnapshot,
      presetName: record.presetNameSnapshot,
      triggerSource: record.triggerSource,
      deliveryStatus: record.deliveryStatus,
      bridgeAccepted: record.bridgeAccepted,
      deviceConfirmed: record.deviceConfirmed,
      errorCode: record.errorCode,
      requestedAt: record.requestedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));
  }

  private async executePersistedControl(
    record: HomeClimateControlLog,
    device: HomeClimateDevice,
    preset: HomeClimatePreset,
    idempotentReplay: boolean,
  ): Promise<ControlResult> {
    if (process.env.HOME_CLIMATE_CONTROL_ENABLED !== 'true') {
      return this.failPersistedControl(
        record,
        device,
        preset,
        'home_climate_control_disabled',
        idempotentReplay,
      );
    }

    let readbackConfig: ReadbackConfig;
    try {
      readbackConfig = this.readbackConfig();
    } catch (error) {
      return this.failPersistedControl(
        record,
        device,
        preset,
        this.policyErrorCode(error, 'home_climate_readback_config_invalid'),
        idempotentReplay,
      );
    }

    let result: BridgeResponse;
    try {
      result = await this.callBridge(
        `/devices/${encodeURIComponent(device.did)}/properties`,
        'POST',
        { properties: preset.properties },
      );
      if (result.ok !== true) {
        throw new HomeClimateBridgeError('home_climate_bridge_write_rejected');
      }
    } catch (error) {
      const code =
        error instanceof HomeClimateBridgeError
          ? error.code
          : 'home_climate_bridge_unavailable';
      return this.failPersistedControl(record, device, preset, code, idempotentReplay);
    }

    record.bridgeAccepted = true;
    record.deliveryStatus = 'command_sent';
    const readback = await this.readBackAfterWrite(
      device,
      preset.properties,
      readbackConfig,
    );
    record.readbackSnapshot = readback.state;
    record.deviceConfirmed = readback.confirmed;
    record.deliveryStatus = readback.confirmed ? 'device_confirmed' : 'command_sent';
    record.errorCode = readback.errorCode;

    let saved: HomeClimateControlLog;
    try {
      saved = await this.controlLogRepository.save(record);
    } catch {
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: 'home_climate_result_persistence_failed',
        message: '指令已发送，但结果审计持久化失败；请使用相同请求编号重试查询',
        requestRef: this.safeRef(record.requestId),
      });
    }
    try {
      await this.auditControl(saved);
    } catch {
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: 'home_climate_operation_audit_failed',
        message: '指令结果已持久化，但操作日志写入失败；请使用相同请求编号重试查询',
        requestRef: this.safeRef(saved.requestId),
      });
    }
    return this.toControlResult(saved, idempotentReplay);
  }

  private async failPersistedControl(
    record: HomeClimateControlLog,
    _device: HomeClimateDevice,
    _preset: HomeClimatePreset,
    errorCode: string,
    _idempotentReplay: boolean,
  ): Promise<never> {
    record.deliveryStatus = 'failed';
    record.bridgeAccepted = false;
    record.deviceConfirmed = false;
    record.errorCode = errorCode;
    const saved = await this.controlLogRepository.save(record);
    await this.auditControl(saved).catch(() => undefined);
    throw new ServiceUnavailableException({
      statusCode: 503,
      code: errorCode,
      message:
        errorCode === 'home_climate_bridge_write_result_unknown'
          ? '空调写入结果未确认，设备可能已执行；请先查看设备状态，不要立即重复发送'
          : '空调控制未执行或未被桥接服务接受',
      requestRef: this.safeRef(saved.requestId),
    });
  }

  private async replayExisting(record: HomeClimateControlLog, fingerprint: string) {
    if (record.requestFingerprint !== fingerprint) {
      await this.auditSecurityOutcome(
        'lobster.idempotency_conflict',
        'home_climate_request_id_conflict',
        record.requestId,
        record.deviceId,
      );
      throw new ConflictException('[home_climate_request_id_conflict] 请求编号已用于不同指令');
    }
    if (record.deliveryStatus === 'failed') {
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: record.errorCode ?? 'home_climate_control_failed',
        message: '相同请求此前未成功执行，本次未重复发送',
        requestRef: this.safeRef(record.requestId),
        idempotentReplay: true,
      });
    }
    return this.toControlResult(record, true);
  }

  private async createPendingControlLog(input: {
    device: HomeClimateDevice;
    preset: HomeClimatePreset;
    triggerSource: HomeClimateTriggerSource;
    operatorUserId: number | null;
    requestId: string;
    requestFingerprint: string;
    nonceHash: string | null;
    serviceIdHash: string | null;
    ownerPeerHash: string | null;
    requestedAt: Date;
  }) {
    return this.controlLogRepository.save(
      this.controlLogRepository.create({
        deviceId: input.device.id,
        presetId: input.preset.id,
        deviceCodeSnapshot: input.device.deviceCode,
        presetCodeSnapshot: input.preset.presetCode,
        presetNameSnapshot: input.preset.presetName,
        propertiesSnapshot: input.preset.properties,
        triggerSource: input.triggerSource,
        operatorUserId: input.operatorUserId,
        requestId: input.requestId,
        requestFingerprint: input.requestFingerprint,
        nonceHash: input.nonceHash,
        serviceIdHash: input.serviceIdHash,
        ownerPeerHash: input.ownerPeerHash,
        deliveryStatus: 'pending',
        bridgeAccepted: false,
        deviceConfirmed: false,
        readbackSnapshot: null,
        errorCode: null,
        requestedAt: input.requestedAt,
      }),
    );
  }

  private async readBackAfterWrite(
    device: HomeClimateDevice,
    properties: Record<string, unknown>,
    config: ReadbackConfig,
  ) {
    let lastState: Record<string, unknown> | null = null;
    let errorCode: string | null = null;
    for (let attempt = 0; attempt < config.attempts; attempt += 1) {
      if (config.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, config.delayMs));
      }
      try {
        lastState = await this.readBridgeState(device.did);
        errorCode = null;
        if (stateMatchesRequestedProperties(lastState, properties, device.model)) {
          return { confirmed: true, state: lastState, errorCode: null };
        }
      } catch (error) {
        errorCode =
          error instanceof HomeClimateBridgeError
            ? error.code
            : 'home_climate_readback_unavailable';
      }
    }
    return {
      confirmed: false,
      state: lastState,
      errorCode: errorCode ?? 'home_climate_readback_not_confirmed',
    };
  }

  private readbackConfig(): ReadbackConfig {
    return {
      attempts: this.numberConfig(
        'HOME_CLIMATE_READBACK_ATTEMPTS',
        DEFAULT_READBACK_ATTEMPTS,
        1,
        3,
      ),
      delayMs: this.numberConfig(
        'HOME_CLIMATE_READBACK_DELAY_MS',
        DEFAULT_READBACK_DELAY_MS,
        0,
        3_000,
      ),
    };
  }

  private async readBridgeState(did: string) {
    const response = await this.callBridge(
      `/devices/${encodeURIComponent(did)}/state`,
      'GET',
      null,
    );
    if (response.ok !== true) {
      throw new HomeClimateBridgeError('home_climate_bridge_read_rejected');
    }
    const state = sanitizeHomeClimateState(response.properties);
    if (!state) {
      throw new HomeClimateBridgeError('home_climate_bridge_state_invalid');
    }
    return state;
  }

  private async callBridge(
    path: string,
    method: 'GET' | 'POST',
    body: Record<string, unknown> | null,
  ): Promise<BridgeResponse> {
    const { baseUrl, token, timeoutMs } = this.bridgeConfig();
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${token}`,
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new HomeClimateBridgeError(
        method === 'POST'
          ? 'home_climate_bridge_write_result_unknown'
          : 'home_climate_bridge_unreachable',
      );
    }
    if (!response.ok) {
      throw new HomeClimateBridgeError(`home_climate_bridge_http_${response.status}`);
    }
    const text = await response.text();
    if (text.length > 65_536) {
      throw new HomeClimateBridgeError('home_climate_bridge_response_oversized');
    }
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('not an object');
      }
      return parsed as BridgeResponse;
    } catch {
      throw new HomeClimateBridgeError('home_climate_bridge_response_invalid');
    }
  }

  private bridgeConfig() {
    const rawUrl = this.configService.get<string>('HOME_CLIMATE_BRIDGE_URL')?.trim() ?? '';
    const token = this.configService.get<string>('HOME_CLIMATE_BRIDGE_TOKEN')?.trim() ?? '';
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new HomeClimateBridgeError('home_climate_bridge_url_invalid');
    }
    const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
    if (
      url.protocol !== 'http:' ||
      !loopbackHosts.has(url.hostname) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== '/' && url.pathname !== '')
    ) {
      throw new HomeClimateBridgeError('home_climate_bridge_must_be_loopback');
    }
    if (token.length < 32 || /replace-with|example|changeme/i.test(token)) {
      throw new HomeClimateBridgeError('home_climate_bridge_token_not_configured');
    }
    const hmacSecret =
      this.configService.get<string>('HOME_CLIMATE_LOBSTER_HMAC_SECRET')?.trim() ?? '';
    if (hmacSecret && token === hmacSecret) {
      throw new HomeClimateBridgeError('home_climate_secrets_must_be_separate');
    }
    return {
      baseUrl: url.origin,
      token,
      timeoutMs: this.numberConfig(
        'HOME_CLIMATE_BRIDGE_TIMEOUT_MS',
        DEFAULT_BRIDGE_TIMEOUT_MS,
        1_000,
        30_000,
      ),
    };
  }

  private gatewayConfig() {
    return {
      serviceId:
        this.configService.get<string>('HOME_CLIMATE_LOBSTER_SERVICE_ID')?.trim() ?? '',
      ownerPeerId:
        this.configService.get<string>('HOME_CLIMATE_OWNER_PEER_ID')?.trim() ?? '',
      hmacSecret:
        this.configService.get<string>('HOME_CLIMATE_LOBSTER_HMAC_SECRET')?.trim() ?? '',
      maxClockSkewMs: this.numberConfig(
        'HOME_CLIMATE_MAX_CLOCK_SKEW_MS',
        60_000,
        10_000,
        300_000,
      ),
    };
  }

  private readGatewayHeaders(
    headers: Record<string, string | string[] | undefined>,
  ): HomeClimateGatewayHeaders {
    return {
      serviceId: this.firstHeader(headers['x-home-climate-service-id']).trim(),
      ownerPeerId: this.firstHeader(headers['x-home-climate-owner-peer-id']).trim(),
      requestId: this.firstHeader(headers['x-home-climate-request-id']).trim(),
      timestamp: this.firstHeader(headers['x-home-climate-timestamp']).trim(),
      nonce: this.firstHeader(headers['x-home-climate-nonce']).trim(),
      signature: this.firstHeader(headers['x-home-climate-signature']).trim(),
    };
  }

  private firstHeader(value: string | string[] | undefined) {
    return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
  }

  private numberConfig(key: string, fallback: number, min: number, max: number) {
    const raw = this.configService.get<string>(key);
    if (raw === undefined || raw === null || String(raw).trim() === '') {
      return fallback;
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new HomeClimatePolicyError('home_climate_numeric_config_invalid');
    }
    return value;
  }

  private validatePropertiesOrThrow(properties: unknown, model: string | null = null) {
    try {
      return validateHomeClimateProperties(properties, model);
    } catch (error) {
      const code = this.policyErrorCode(error, 'home_climate_properties_invalid');
      throw new BadRequestException(`[${code}] 控制属性不符合家居空调白名单`);
    }
  }

  private parameterizeLobsterTemperaturePreset(
    preset: HomeClimatePreset,
    temperature: number | undefined,
    model: string | null,
  ): HomeClimatePreset {
    if (temperature === undefined) return preset;
    if (
      preset.presetCode !== 'cool-26' ||
      !Number.isInteger(temperature) ||
      temperature < 17 ||
      temperature > 30
    ) {
      throw new HomeClimatePolicyError('home_climate_temperature_route_invalid');
    }
    const properties = validateHomeClimateProperties(
      { ...preset.properties, target_temperature: temperature },
      model,
    );
    return Object.assign(Object.create(Object.getPrototypeOf(preset)), preset, {
      presetName: `${temperature}度制冷`,
      properties,
    });
  }

  private async requireDeviceById(deviceId: number) {
    const device = await this.deviceRepository.findOne({ where: { id: deviceId } });
    if (!device) {
      throw new NotFoundException('[home_climate_device_not_found] 设备不存在');
    }
    return device;
  }

  private async requirePreset(presetId: number, device: HomeClimateDevice) {
    const preset = await this.presetRepository.findOne({
      where: { id: presetId, deviceId: device.id },
    });
    if (!preset || !preset.enabled) {
      throw new NotFoundException('[home_climate_preset_unavailable] 控制预设不存在或已停用');
    }
    preset.properties = this.validatePropertiesOrThrow(preset.properties, device.model);
    return preset;
  }

  private toSafeDevice(device: HomeClimateDevice) {
    return {
      id: device.id,
      deviceCode: device.deviceCode,
      name: device.name,
      didRef: this.safeRef(device.did),
      model: device.model,
      location: device.location,
      enabled: device.enabled,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    };
  }

  private toSafePreset(preset: HomeClimatePreset) {
    return {
      id: preset.id,
      deviceId: preset.deviceId,
      presetCode: preset.presetCode,
      presetName: preset.presetName,
      properties: preset.properties,
      enabled: preset.enabled,
      sortOrder: preset.sortOrder,
      createdAt: preset.createdAt,
      updatedAt: preset.updatedAt,
    };
  }

  private toControlResult(
    record: HomeClimateControlLog,
    idempotentReplay: boolean,
  ): ControlResult {
    const officePowerOnStateAccepted =
      record.deviceCodeSnapshot === 'office-main-ac' &&
      record.deliveryStatus === 'command_sent' &&
      record.propertiesSnapshot?.power === true &&
      record.readbackSnapshot !== null &&
      Object.entries(record.propertiesSnapshot)
        .filter(([key]) => key !== 'target_temperature')
        .every(([key, value]) => record.readbackSnapshot?.[key] === value) &&
      typeof record.readbackSnapshot.load_power === 'number' &&
      record.readbackSnapshot.load_power >= OFFICE_AC_POWER_OFF_MIN_WATTS &&
      record.readbackSnapshot.load_power <= OFFICE_AC_POWER_OFF_MAX_WATTS;
    const officeTargetTemperatureUnconfirmed =
      record.deviceCodeSnapshot === 'office-main-ac' &&
      ['command_sent', 'device_confirmed'].includes(record.deliveryStatus) &&
      typeof record.propertiesSnapshot?.target_temperature === 'number' &&
      record.readbackSnapshot?.target_temperature !==
        record.propertiesSnapshot.target_temperature;
    const replyText =
      record.deliveryStatus === 'device_confirmed'
        ? officeTargetTemperatureUnconfirmed
          ? '空调已启动，功率已离开待机；伴侣未确认设定温度'
          : `设备已确认：${record.presetNameSnapshot}`
        : record.deliveryStatus === 'command_sent'
          ? officePowerOnStateAccepted
            ? officeTargetTemperatureUnconfirmed
              ? '开机状态已写入伴侣；压缩机尚未进入运行功率，设定温度未由伴侣回读确认；无需重复发送'
              : '开机状态已写入伴侣；压缩机尚未进入运行功率；无需重复发送'
            : '指令已发送，设备状态待确认'
          : '相同请求正在处理中，未重复发送';
    return {
      requestId: record.requestId,
      idempotentReplay,
      deviceCode: record.deviceCodeSnapshot,
      presetCode: record.presetCodeSnapshot,
      presetName: record.presetNameSnapshot,
      deliveryStatus: record.deliveryStatus,
      bridgeAccepted: record.bridgeAccepted,
      deviceConfirmed: record.deviceConfirmed,
      replyText,
      state: record.readbackSnapshot,
    };
  }

  private async auditControl(record: HomeClimateControlLog) {
    const base = {
      module: MODULE_NAME,
      targetId: record.deviceId,
      action: 'device.control',
      detail: `家居空调控制结果: ${record.deviceCodeSnapshot}/${record.presetCodeSnapshot}/${record.deliveryStatus}`,
      detailJson: {
        requestRef: this.safeRef(record.requestId),
        deviceCode: record.deviceCodeSnapshot,
        presetCode: record.presetCodeSnapshot,
        triggerSource: record.triggerSource,
        deliveryStatus: record.deliveryStatus,
        bridgeAccepted: record.bridgeAccepted,
        deviceConfirmed: record.deviceConfirmed,
        errorCode: record.errorCode,
      },
    } as const;
    if (record.triggerSource === 'web' && record.operatorUserId) {
      await this.operationLogsService.create({ ...base, operatorId: record.operatorUserId });
    } else {
      await this.operationLogsService.create({
        ...base,
        actorType: 'system',
        actorRef: 'wechat_lobster_home_climate',
      });
    }
  }

  private async auditSecurityOutcome(
    action: string,
    reasonCode: string,
    requestId: string,
    targetId = 0,
  ) {
    await this.operationLogsService
      .create({
        module: MODULE_NAME,
        targetId,
        action,
        detail: `家居空调网关请求被拒绝: ${reasonCode}`,
        detailJson: {
          reasonCode,
          requestRef: this.safeRef(requestId || 'missing-request-id'),
        },
        actorType: 'system',
        actorRef: 'wechat_lobster_home_climate_security',
      })
      .catch(() => undefined);
  }

  private recordPreAuthSecurityTelemetry(reasonCode: string, requestId: string) {
    this.logger.warn(
      JSON.stringify({
        event: 'home_climate_gateway_auth_rejected',
        reasonCode,
        requestRef: this.safeRef(requestId || 'missing-request-id'),
      }),
    );
  }

  private policyErrorCode(error: unknown, fallback: string) {
    return error instanceof HomeClimatePolicyError ? error.code : fallback;
  }

  private safeRef(value: string) {
    return sha256(value).slice(0, 16);
  }

  private isDuplicateKeyError(error: unknown) {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const candidate = error as { code?: unknown; errno?: unknown };
    return candidate.code === 'ER_DUP_ENTRY' || candidate.errno === 1062;
  }
}
