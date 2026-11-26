import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  LobsterHomeClimateContextControlDto,
  LobsterHomeClimateControlDto,
} from './dto/home-climate.dto';

export const HOME_CLIMATE_LOBSTER_PATH = '/api/home-climate/lobster/control';
export const HOME_CLIMATE_LOBSTER_CONTEXT_PATH =
  '/api/home-climate/lobster/context-control';
export const HOME_CLIMATE_PRESENCE_SOURCE = 'trusted_wifi';
export const HOME_CLIMATE_PRESENCE_DEFAULT_MAX_AGE_MS = 5 * 60_000;
export const HOME_CLIMATE_TEMP_MIN = 17;
export const HOME_CLIMATE_TEMP_MAX = 30;
export const OFFICE_AC_COMPANION_MODEL = 'lumi.acpartner.mcn02';
export const OFFICE_AC_POWER_OFF_MIN_WATTS = 5;
export const OFFICE_AC_POWER_OFF_MAX_WATTS = 40;
export const OFFICE_AC_ACTIVE_POWER_MIN_EXCLUSIVE_WATTS =
  OFFICE_AC_POWER_OFF_MAX_WATTS;

const ALLOWED_PROPERTY_KEYS = [
  'power',
  'mode',
  'target_temperature',
  'fan_speed',
  'vertical_swing',
] as const;
const ALLOWED_MODES = ['cool', 'heat', 'dry', 'fan'] as const;
const OFFICE_AC_ALLOWED_MODES = [...ALLOWED_MODES, 'auto'] as const;
const ALLOWED_FAN_SPEEDS = ['auto', 'low', 'medium', 'high'] as const;
const BLOCKED_IDENTITY_VALUES = new Set(['*', 'all', 'any', 'default', 'unknown']);
const HOME_CLIMATE_CONTEXT_ROUTES = Object.freeze({
  home: Object.freeze({
    deviceCode: 'home-main-ac',
    presets: Object.freeze({
      on: 'cool-26',
      off: 'power-off',
      cool: 'cool-26',
      dry: 'dry-default',
      heat: 'heat-22',
    }),
  }),
  office: Object.freeze({
    deviceCode: 'office-main-ac',
    presets: Object.freeze({
      on: 'cool-26',
      off: 'power-off',
      cool: 'cool-26',
      dry: 'dry-24',
      heat: 'heat-26',
    }),
  }),
});
const LOBSTER_PRESET_CONTRACTS: Record<
  string,
  { model: string; presets: Record<string, Record<string, unknown>> }
> = {
  'home-main-ac': {
    model: 'xiaomi.aircondition.mt8',
    presets: {
      'cool-26': {
        power: true,
        mode: 'cool',
        target_temperature: 26,
        fan_speed: 'auto',
        vertical_swing: false,
      },
      'power-off': { power: false },
      'dry-default': {
        power: true,
        mode: 'dry',
        target_temperature: 24,
        fan_speed: 'auto',
      },
      'heat-22': {
        power: true,
        mode: 'heat',
        target_temperature: 22,
        fan_speed: 'auto',
      },
    },
  },
  'office-main-ac': {
    model: OFFICE_AC_COMPANION_MODEL,
    presets: {
      'cool-26': {
        power: true,
        mode: 'cool',
        target_temperature: 26,
        fan_speed: 'auto',
        vertical_swing: false,
      },
      'power-off': { power: false },
      'dry-24': {
        power: true,
        mode: 'dry',
        target_temperature: 24,
        fan_speed: 'auto',
      },
      'heat-26': {
        power: true,
        mode: 'heat',
        target_temperature: 26,
        fan_speed: 'auto',
      },
    },
  },
};

export interface HomeClimateGatewayHeaders {
  serviceId: string;
  ownerPeerId: string;
  requestId: string;
  timestamp: string;
  nonce: string;
  signature: string;
}

export interface HomeClimateGatewayConfig {
  serviceId: string;
  ownerPeerId: string;
  hmacSecret: string;
  maxClockSkewMs: number;
}

export interface VerifiedHomeClimateGatewayRequest {
  requestId: string;
  requestedAt: Date;
  nonceHash: string;
  serviceIdHash: string;
  ownerPeerHash: string;
  requestFingerprint: string;
}

export interface HomeClimatePresenceCandidate {
  zone: unknown;
  source: unknown;
  observedAt: unknown;
  lastHeartbeatAt: Date | string | null;
}

export type HomeClimatePresenceResolution =
  | { zone: 'home' | 'office'; reason: 'resolved' }
  | { zone: null; reason: 'unknown' | 'conflict' };

export class HomeClimatePolicyError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'HomeClimatePolicyError';
  }
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const source = value as Record<string, unknown>;
  return `{${Object.keys(source)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(source[key])}`)
    .join(',')}}`;
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function validateHomeClimateProperties(
  input: unknown,
  model: string | null = null,
): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new HomeClimatePolicyError('home_climate_properties_invalid');
  }

  const source = input as Record<string, unknown>;
  const keys = Object.keys(source);
  if (keys.length === 0 || keys.length > ALLOWED_PROPERTY_KEYS.length) {
    throw new HomeClimatePolicyError('home_climate_properties_empty_or_oversized');
  }

  const normalized: Record<string, unknown> = {};
  for (const key of keys.sort()) {
    if (!(ALLOWED_PROPERTY_KEYS as readonly string[]).includes(key)) {
      throw new HomeClimatePolicyError('home_climate_property_not_allowed');
    }

    const value = source[key];
    if (key === 'power' || key === 'vertical_swing') {
      if (typeof value !== 'boolean') {
        throw new HomeClimatePolicyError('home_climate_boolean_property_invalid');
      }
    } else if (key === 'mode') {
      const allowedModes =
        model === OFFICE_AC_COMPANION_MODEL ? OFFICE_AC_ALLOWED_MODES : ALLOWED_MODES;
      if (
        typeof value !== 'string' ||
        !(allowedModes as readonly string[]).includes(value)
      ) {
        throw new HomeClimatePolicyError('home_climate_mode_invalid');
      }
    } else if (key === 'fan_speed') {
      if (
        typeof value !== 'string' ||
        !(ALLOWED_FAN_SPEEDS as readonly string[]).includes(value)
      ) {
        throw new HomeClimatePolicyError('home_climate_fan_speed_invalid');
      }
    } else if (
      key === 'target_temperature' &&
      (typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < HOME_CLIMATE_TEMP_MIN ||
        value > HOME_CLIMATE_TEMP_MAX)
    ) {
      throw new HomeClimatePolicyError('home_climate_temperature_invalid');
    }
    normalized[key] = value;
  }

  if (normalized.power === false && keys.length > 1) {
    throw new HomeClimatePolicyError('home_climate_power_off_must_be_standalone');
  }
  return normalized;
}

export function assertHomeClimateLobsterPresetContract(input: {
  deviceCode: string;
  model: string | null;
  presetCode: string;
  properties: Record<string, unknown>;
}): void {
  const contract = LOBSTER_PRESET_CONTRACTS[input.deviceCode];
  const expected = contract?.presets[input.presetCode];
  if (
    !contract ||
    input.model !== contract.model ||
    !expected ||
    stableStringify(input.properties) !== stableStringify(expected)
  ) {
    throw new HomeClimatePolicyError('home_climate_lobster_preset_contract_drift');
  }
}

export function buildHomeClimateSignature(
  body: LobsterHomeClimateControlDto | LobsterHomeClimateContextControlDto,
  headers: Omit<HomeClimateGatewayHeaders, 'signature'>,
  secret: string,
  path: typeof HOME_CLIMATE_LOBSTER_PATH | typeof HOME_CLIMATE_LOBSTER_CONTEXT_PATH =
    HOME_CLIMATE_LOBSTER_PATH,
): string {
  const bodyHash = sha256(stableStringify(body));
  const canonical = [
    'v1',
    'POST',
    path,
    headers.serviceId,
    headers.ownerPeerId,
    headers.requestId,
    headers.timestamp,
    headers.nonce,
    bodyHash,
  ].join('\n');
  return `v1=${createHmac('sha256', secret).update(canonical, 'utf8').digest('hex')}`;
}

export function verifyHomeClimateGatewayRequest(input: {
  body: LobsterHomeClimateControlDto | LobsterHomeClimateContextControlDto;
  headers: HomeClimateGatewayHeaders;
  config: HomeClimateGatewayConfig;
  now?: number;
  path?: typeof HOME_CLIMATE_LOBSTER_PATH | typeof HOME_CLIMATE_LOBSTER_CONTEXT_PATH;
}): VerifiedHomeClimateGatewayRequest {
  const { body, headers, config } = input;
  assertGatewayConfig(config);

  if (!constantTimeTextEqual(headers.serviceId, config.serviceId)) {
    throw new HomeClimatePolicyError('home_climate_service_identity_rejected');
  }
  if (!constantTimeTextEqual(headers.ownerPeerId, config.ownerPeerId)) {
    throw new HomeClimatePolicyError('home_climate_owner_peer_rejected');
  }
  if (!/^[A-Za-z0-9._:-]{8,96}$/.test(headers.requestId)) {
    throw new HomeClimatePolicyError('home_climate_request_id_invalid');
  }
  if (!/^[A-Za-z0-9._-]{16,96}$/.test(headers.nonce)) {
    throw new HomeClimatePolicyError('home_climate_nonce_invalid');
  }
  if (!/^\d{13}$/.test(headers.timestamp)) {
    throw new HomeClimatePolicyError('home_climate_timestamp_invalid');
  }

  const requestedAtMs = Number(headers.timestamp);
  const now = input.now ?? Date.now();
  if (!Number.isSafeInteger(requestedAtMs) || Math.abs(now - requestedAtMs) > config.maxClockSkewMs) {
    throw new HomeClimatePolicyError('home_climate_request_expired');
  }
  if (!/^v1=[a-f0-9]{64}$/.test(headers.signature)) {
    throw new HomeClimatePolicyError('home_climate_signature_invalid');
  }

  const expected = buildHomeClimateSignature(
    body,
    {
      serviceId: headers.serviceId,
      ownerPeerId: headers.ownerPeerId,
      requestId: headers.requestId,
      timestamp: headers.timestamp,
      nonce: headers.nonce,
    },
    config.hmacSecret,
    input.path ?? HOME_CLIMATE_LOBSTER_PATH,
  );
  if (!constantTimeTextEqual(headers.signature, expected)) {
    throw new HomeClimatePolicyError('home_climate_signature_invalid');
  }

  const requestFingerprint = sha256(
    stableStringify({
      serviceId: headers.serviceId,
      ownerPeerId: headers.ownerPeerId,
      body,
    }),
  );
  return {
    requestId: headers.requestId,
    requestedAt: new Date(requestedAtMs),
    nonceHash: sha256(headers.nonce),
    serviceIdHash: sha256(headers.serviceId),
    ownerPeerHash: sha256(headers.ownerPeerId),
    requestFingerprint,
  };
}

export function resolveHomeClimatePresence(
  candidates: readonly HomeClimatePresenceCandidate[],
  now = Date.now(),
  maxAgeMs = HOME_CLIMATE_PRESENCE_DEFAULT_MAX_AGE_MS,
): HomeClimatePresenceResolution {
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(maxAgeMs) || maxAgeMs < 60_000) {
    throw new HomeClimatePolicyError('home_climate_presence_config_invalid');
  }
  const futureToleranceMs = 30_000;
  const zones = new Set<'home' | 'office'>();
  for (const candidate of candidates) {
    if (candidate.source !== HOME_CLIMATE_PRESENCE_SOURCE) continue;
    if (candidate.zone !== 'home' && candidate.zone !== 'office') continue;
    const observedAt = Date.parse(String(candidate.observedAt ?? ''));
    const heartbeatAt =
      candidate.lastHeartbeatAt instanceof Date
        ? candidate.lastHeartbeatAt.getTime()
        : Date.parse(String(candidate.lastHeartbeatAt ?? ''));
    if (
      !Number.isFinite(observedAt) ||
      !Number.isFinite(heartbeatAt) ||
      observedAt < now - maxAgeMs ||
      heartbeatAt < now - maxAgeMs ||
      observedAt > now + futureToleranceMs ||
      heartbeatAt > now + futureToleranceMs
    ) {
      continue;
    }
    zones.add(candidate.zone);
  }
  if (zones.size === 0) return { zone: null, reason: 'unknown' };
  if (zones.size > 1) return { zone: null, reason: 'conflict' };
  return { zone: [...zones][0], reason: 'resolved' };
}

export function resolveHomeClimateContextRoute(input: {
  zone: 'home' | 'office';
  intent: LobsterHomeClimateContextControlDto['intent'];
}): { deviceCode: string; presetCode: string } {
  const route = HOME_CLIMATE_CONTEXT_ROUTES[input.zone];
  const presetCode = route?.presets[input.intent];
  if (!route || !presetCode) {
    throw new HomeClimatePolicyError('home_climate_context_route_invalid');
  }
  return { deviceCode: route.deviceCode, presetCode };
}

export function stateMatchesRequestedProperties(
  state: Record<string, unknown> | null,
  requested: Record<string, unknown>,
  model: string | null = null,
): boolean {
  if (!state) {
    return false;
  }
  const requestedProperties = Object.entries(requested).filter(
    ([key]) =>
      !(
        model === OFFICE_AC_COMPANION_MODEL &&
        requested.power === true &&
        key === 'target_temperature'
      ),
  );
  if (!requestedProperties.every(([key, value]) => state[key] === value)) {
    return false;
  }
  if (
    model !== OFFICE_AC_COMPANION_MODEL ||
    typeof requested.power !== 'boolean'
  ) {
    return true;
  }

  const loadPower = state.load_power;
  if (typeof loadPower !== 'number' || !Number.isFinite(loadPower)) {
    return false;
  }
  return requested.power
    ? loadPower > OFFICE_AC_ACTIVE_POWER_MIN_EXCLUSIVE_WATTS
    : loadPower >= OFFICE_AC_POWER_OFF_MIN_WATTS &&
        loadPower <= OFFICE_AC_POWER_OFF_MAX_WATTS;
}

export function sanitizeHomeClimateState(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }
  const source = input as Record<string, unknown>;
  const allowedReadKeys = new Set([
    ...ALLOWED_PROPERTY_KEYS,
    'temperature',
    'load_power',
  ]);
  const result: Record<string, unknown> = {};
  for (const key of allowedReadKeys) {
    const value = source[key];
    if (
      typeof value === 'boolean' ||
      typeof value === 'string' ||
      (typeof value === 'number' && Number.isFinite(value))
    ) {
      result[key] = value;
    }
  }
  return result;
}

function assertGatewayConfig(config: HomeClimateGatewayConfig) {
  const serviceId = config.serviceId.trim();
  const ownerPeerId = config.ownerPeerId.trim();
  if (
    !/^[A-Za-z0-9._:-]{3,96}$/.test(serviceId) ||
    !/^[A-Za-z0-9._:@-]{3,160}$/.test(ownerPeerId) ||
    /replace-with|example|changeme/i.test(serviceId) ||
    /replace-with|example|changeme/i.test(ownerPeerId) ||
    BLOCKED_IDENTITY_VALUES.has(serviceId.toLowerCase()) ||
    BLOCKED_IDENTITY_VALUES.has(ownerPeerId.toLowerCase())
  ) {
    throw new HomeClimatePolicyError('home_climate_gateway_identity_not_configured');
  }
  if (
    config.hmacSecret.length < 32 ||
    /replace-with|example|changeme/i.test(config.hmacSecret)
  ) {
    throw new HomeClimatePolicyError('home_climate_hmac_secret_not_configured');
  }
  if (
    !Number.isInteger(config.maxClockSkewMs) ||
    config.maxClockSkewMs < 10_000 ||
    config.maxClockSkewMs > 300_000
  ) {
    throw new HomeClimatePolicyError('home_climate_clock_skew_invalid');
  }
}

function constantTimeTextEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return (
    leftBuffer.length === rightBuffer.length &&
    leftBuffer.length > 0 &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
