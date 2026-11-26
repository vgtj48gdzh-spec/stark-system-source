export const WECHAT_PAY_PREFLIGHT_ENV_KEYS = [
  'WECHAT_PAY_PROVIDER_ENABLED',
  'WECHAT_PAY_SANDBOX_MODE',
  'WECHAT_PAY_APP_ID',
  'WECHAT_PAY_MCH_ID',
  'WECHAT_PAY_API_V3_KEY',
  'WECHAT_PAY_PRIVATE_KEY_PATH',
  'WECHAT_PAY_CERT_SERIAL_NO',
  'WECHAT_PAY_PLATFORM_CERT_PATH',
  'WECHAT_PAY_NOTIFY_URL',
  'WECHAT_PAY_REFUND_NOTIFY_URL',
] as const;

export type WechatPayPreflightEnvKey = (typeof WECHAT_PAY_PREFLIGHT_ENV_KEYS)[number];

type EnvSource = Partial<Record<WechatPayPreflightEnvKey, string | undefined>>;

export interface WechatPayPreflightConfig {
  providerEnabled: boolean;
  sandboxMode: boolean;
  appId: string | null;
  mchId: string | null;
  apiV3KeyConfigured: boolean;
  privateKeyPath: string | null;
  certSerialNo: string | null;
  platformCertPath: string | null;
  notifyUrl: string | null;
  refundNotifyUrl: string | null;
  configuredKeys: WechatPayPreflightEnvKey[];
  dummyValueKeys: WechatPayPreflightEnvKey[];
}

export interface WechatPayPreflightEvaluation {
  failClosed: boolean;
  readyForRealProvider: boolean;
  readyForDummySelfCheck: boolean;
  missingRequiredKeys: WechatPayPreflightEnvKey[];
  dummyValueKeys: WechatPayPreflightEnvKey[];
  failClosedReasons: string[];
}

export interface WechatPayPreflightEvaluationOptions {
  allowDummyValues?: boolean;
}

const REQUIRED_REAL_PROVIDER_KEYS: WechatPayPreflightEnvKey[] = [
  'WECHAT_PAY_APP_ID',
  'WECHAT_PAY_MCH_ID',
  'WECHAT_PAY_API_V3_KEY',
  'WECHAT_PAY_PRIVATE_KEY_PATH',
  'WECHAT_PAY_CERT_SERIAL_NO',
  'WECHAT_PAY_PLATFORM_CERT_PATH',
  'WECHAT_PAY_NOTIFY_URL',
  'WECHAT_PAY_REFUND_NOTIFY_URL',
];

function normalizeConfigString(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function readBoolean(value: string | undefined, fallback: boolean) {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
}

function isDummyValue(value: string | null) {
  if (!value) {
    return false;
  }

  const normalized = value.toUpperCase();

  return [
    'SELF_CHECK',
    'DUMMY',
    'DO_NOT_USE',
    'FIXTURE',
    'TEST_ONLY',
    'EXAMPLE',
  ].some((marker) => normalized.includes(marker));
}

export function readWechatPayPreflightConfig(
  source: EnvSource = process.env,
): WechatPayPreflightConfig {
  const appId = normalizeConfigString(source.WECHAT_PAY_APP_ID);
  const mchId = normalizeConfigString(source.WECHAT_PAY_MCH_ID);
  const apiV3Key = normalizeConfigString(source.WECHAT_PAY_API_V3_KEY);
  const privateKeyPath = normalizeConfigString(source.WECHAT_PAY_PRIVATE_KEY_PATH);
  const certSerialNo = normalizeConfigString(source.WECHAT_PAY_CERT_SERIAL_NO);
  const platformCertPath = normalizeConfigString(source.WECHAT_PAY_PLATFORM_CERT_PATH);
  const notifyUrl = normalizeConfigString(source.WECHAT_PAY_NOTIFY_URL);
  const refundNotifyUrl = normalizeConfigString(source.WECHAT_PAY_REFUND_NOTIFY_URL);

  const valuesByKey: Record<WechatPayPreflightEnvKey, string | null> = {
    WECHAT_PAY_PROVIDER_ENABLED: normalizeConfigString(source.WECHAT_PAY_PROVIDER_ENABLED),
    WECHAT_PAY_SANDBOX_MODE: normalizeConfigString(source.WECHAT_PAY_SANDBOX_MODE),
    WECHAT_PAY_APP_ID: appId,
    WECHAT_PAY_MCH_ID: mchId,
    WECHAT_PAY_API_V3_KEY: apiV3Key,
    WECHAT_PAY_PRIVATE_KEY_PATH: privateKeyPath,
    WECHAT_PAY_CERT_SERIAL_NO: certSerialNo,
    WECHAT_PAY_PLATFORM_CERT_PATH: platformCertPath,
    WECHAT_PAY_NOTIFY_URL: notifyUrl,
    WECHAT_PAY_REFUND_NOTIFY_URL: refundNotifyUrl,
  };

  return {
    providerEnabled: readBoolean(source.WECHAT_PAY_PROVIDER_ENABLED, false),
    sandboxMode: readBoolean(source.WECHAT_PAY_SANDBOX_MODE, true),
    appId,
    mchId,
    apiV3KeyConfigured: Boolean(apiV3Key),
    privateKeyPath,
    certSerialNo,
    platformCertPath,
    notifyUrl,
    refundNotifyUrl,
    configuredKeys: WECHAT_PAY_PREFLIGHT_ENV_KEYS.filter((key) => Boolean(valuesByKey[key])),
    dummyValueKeys: WECHAT_PAY_PREFLIGHT_ENV_KEYS.filter((key) =>
      isDummyValue(valuesByKey[key]),
    ),
  };
}

export function evaluateWechatPayPreflightConfig(
  config: WechatPayPreflightConfig,
  options: WechatPayPreflightEvaluationOptions = {},
): WechatPayPreflightEvaluation {
  const missingRequiredKeys = REQUIRED_REAL_PROVIDER_KEYS.filter((key) => {
    switch (key) {
      case 'WECHAT_PAY_APP_ID':
        return !config.appId;
      case 'WECHAT_PAY_MCH_ID':
        return !config.mchId;
      case 'WECHAT_PAY_API_V3_KEY':
        return !config.apiV3KeyConfigured;
      case 'WECHAT_PAY_PRIVATE_KEY_PATH':
        return !config.privateKeyPath;
      case 'WECHAT_PAY_CERT_SERIAL_NO':
        return !config.certSerialNo;
      case 'WECHAT_PAY_PLATFORM_CERT_PATH':
        return !config.platformCertPath;
      case 'WECHAT_PAY_NOTIFY_URL':
        return !config.notifyUrl;
      case 'WECHAT_PAY_REFUND_NOTIFY_URL':
        return !config.refundNotifyUrl;
      default:
        return true;
    }
  });

  const failClosedReasons: string[] = [];

  if (!config.providerEnabled) {
    failClosedReasons.push('wechat_pay_provider_disabled');
  }

  if (missingRequiredKeys.length) {
    failClosedReasons.push('missing_required_wechat_pay_credentials');
  }

  if (config.dummyValueKeys.length && !options.allowDummyValues) {
    failClosedReasons.push('dummy_values_present');
  }

  const readyForDummySelfCheck =
    missingRequiredKeys.length === 0 && config.dummyValueKeys.length > 0 && Boolean(options.allowDummyValues);
  const readyForRealProvider =
    config.providerEnabled &&
    missingRequiredKeys.length === 0 &&
    config.dummyValueKeys.length === 0;

  return {
    failClosed: !readyForRealProvider,
    readyForRealProvider,
    readyForDummySelfCheck,
    missingRequiredKeys,
    dummyValueKeys: [...config.dummyValueKeys],
    failClosedReasons,
  };
}

export function buildWechatPayPreflightSafeSummary(
  config: WechatPayPreflightConfig,
  evaluation: WechatPayPreflightEvaluation,
) {
  return {
    providerEnabled: config.providerEnabled,
    sandboxMode: config.sandboxMode,
    appIdConfigured: Boolean(config.appId),
    mchIdConfigured: Boolean(config.mchId),
    apiV3KeyConfigured: config.apiV3KeyConfigured,
    privateKeyPathConfigured: Boolean(config.privateKeyPath),
    certSerialNoConfigured: Boolean(config.certSerialNo),
    platformCertPathConfigured: Boolean(config.platformCertPath),
    notifyUrlConfigured: Boolean(config.notifyUrl),
    refundNotifyUrlConfigured: Boolean(config.refundNotifyUrl),
    configuredKeys: config.configuredKeys,
    dummyValueKeys: evaluation.dummyValueKeys,
    missingRequiredKeys: evaluation.missingRequiredKeys,
    failClosed: evaluation.failClosed,
    readyForRealProvider: evaluation.readyForRealProvider,
    readyForDummySelfCheck: evaluation.readyForDummySelfCheck,
    failClosedReasons: evaluation.failClosedReasons,
    noRealCredentialValuesReturned: true,
  };
}
