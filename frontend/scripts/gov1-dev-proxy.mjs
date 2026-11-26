export const GOV1_ACCEPTANCE_API_PREFIX = '/gov1-acceptance-api';

const GOV1_ACCEPTANCE_ENDPOINT_ALLOWLIST = [
  ['GET', /^\/gov1-acceptance-api\/repair-shop\/work-orders\/[1-9]\d*\/authority-capture\/(?:lineage|assignment|baseline)$/],
  ['POST', /^\/gov1-acceptance-api\/repair-shop\/authority-capture\/(?:lineage-propose|lineage-approve|assignment-draft|assignment-submit|assignment-decide|baseline-draft|baseline-submit|baseline-decide)$/],
  ['GET', /^\/gov1-acceptance-api\/auth\/current-user$/],
  ['GET', /^\/gov1-acceptance-api\/group-operations\/groups$/],
  ['POST', /^\/gov1-acceptance-api\/group-operations\/groups$/],
  ['GET', /^\/gov1-acceptance-api\/group-operations\/groups\/[1-9]\d*$/],
  ['POST', /^\/gov1-acceptance-api\/group-operations\/groups\/[1-9]\d*\/members$/],
  ['PATCH', /^\/gov1-acceptance-api\/group-operations\/members\/[1-9]\d*\/end$/],
  [
    'GET',
    /^\/gov1-acceptance-api\/group-operations\/employees\/[1-9]\d*\/compensation-profiles$/,
  ],
  [
    'POST',
    /^\/gov1-acceptance-api\/group-operations\/employees\/[1-9]\d*\/compensation-profiles$/,
  ],
  ['POST', /^\/gov1-acceptance-api\/group-operations\/payroll-calendar-rules$/],
  [
    'GET',
    /^\/gov1-acceptance-api\/group-operations\/groups\/[1-9]\d*\/payroll-calendar-rules\/\d{4}-(?:0[1-9]|1[0-2])$/,
  ],
  [
    'POST',
    /^\/gov1-acceptance-api\/group-operations\/groups\/[1-9]\d*\/target-policies$/,
  ],
  [
    'GET',
    /^\/gov1-acceptance-api\/group-operations\/groups\/[1-9]\d*\/target-policies\/\d{4}-(?:0[1-9]|1[0-2])$/,
  ],
  ['POST', /^\/gov1-acceptance-api\/group-operations\/groups\/[1-9]\d*\/targets$/],
  [
    'GET',
    /^\/gov1-acceptance-api\/group-operations\/groups\/[1-9]\d*\/targets\/\d{4}-(?:0[1-9]|1[0-2])$/,
  ],
  [
    'GET',
    /^\/gov1-acceptance-api\/group-operations\/contributions\/groups\/[1-9]\d*\/periods\/\d{4}-(?:0[1-9]|1[0-2])\/summary$/,
  ],
  [
    'POST',
    /^\/gov1-acceptance-api\/group-operations\/groups\/[1-9]\d*\/targets\/\d{4}-(?:0[1-9]|1[0-2])\/(?:calculation-input-preview|hiring-impact-preview)$/,
  ],
];

const UNTRUSTED_BROWSER_IDENTITY_HEADERS = [
  'authorization',
  'x-user-id',
  'x-stark-actor-username',
  'x-stark-actor-secret',
];

export function resolveGov1DevProxyIdentity(env = process.env) {
  const username = env.GOV1_DEV_PROXY_ACTOR_USERNAME?.trim() ?? '';
  const explicitProxySecret = env.GOV1_DEV_PROXY_ACTOR_SECRET?.trim() ?? '';
  const secret =
    explicitProxySecret ||
    (username ? env.FORMAL_ACTOR_IDENTITY_SHARED_SECRET?.trim() ?? '' : '');

  if (Boolean(username) !== Boolean(secret)) {
    throw new Error(
      'GOV1 local formal identity requires GOV1_DEV_PROXY_ACTOR_USERNAME and one server-side proxy secret',
    );
  }
  if (secret && secret.length < 32) {
    throw new Error('GOV1 proxy secret must contain at least 32 characters');
  }

  return username ? { username, secret } : null;
}

export function isGov1DevProxyLoopbackHost(host) {
  if (host === undefined || host === false) {
    return true;
  }
  if (host === true || typeof host !== 'string') {
    return false;
  }

  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host.trim().toLowerCase());
}

export function assertGov1DevProxyIdentityUsesLoopback({ identity, host }) {
  if (identity && !isGov1DevProxyLoopbackHost(host)) {
    throw new Error(
      'GOV1 formal identity proxy requires a loopback-only Vite host (localhost, 127.0.0.1 or ::1)',
    );
  }
}

export function createGov1DevProxyLoopbackGuardPlugin({
  identity = resolveGov1DevProxyIdentity(),
} = {}) {
  return {
    name: 'gov1-formal-identity-loopback-guard',
    apply: 'serve',
    configResolved(config) {
      assertGov1DevProxyIdentityUsesLoopback({
        identity,
        host: config.server.host,
      });
    },
  };
}

export function isGov1AcceptanceProxyRequestAllowed(method, requestUrl) {
  const normalizedMethod = method?.trim().toUpperCase() ?? '';
  const rawPath = (requestUrl ?? '').split(/[?#]/, 1)[0];
  if (rawPath.startsWith(`${GOV1_ACCEPTANCE_API_PREFIX}/repair-shop/`) && rawPath !== requestUrl) return false;

  if (
    !rawPath.startsWith(`${GOV1_ACCEPTANCE_API_PREFIX}/`) ||
    rawPath.includes('%') ||
    rawPath.includes('\\') ||
    rawPath.includes('//')
  ) {
    return false;
  }

  return GOV1_ACCEPTANCE_ENDPOINT_ALLOWLIST.some(
    ([allowedMethod, allowedPath]) =>
      normalizedMethod === allowedMethod && allowedPath.test(rawPath),
  );
}

export function createGov1AcceptanceProxyOptions({
  target,
  identity = resolveGov1DevProxyIdentity(),
} = {}) {
  const normalizedTarget = target?.trim();
  if (!normalizedTarget) {
    throw new Error('GOV1 acceptance proxy target is required');
  }
  const normalizedIdentity = identity
    ? resolveGov1DevProxyIdentity({
        GOV1_DEV_PROXY_ACTOR_USERNAME: identity.username,
        GOV1_DEV_PROXY_ACTOR_SECRET: identity.secret,
      })
    : null;

  return {
    target: normalizedTarget,
    changeOrigin: true,
    bypass(request) {
      return isGov1AcceptanceProxyRequestAllowed(request.method, request.url)
        ? undefined
        : false;
    },
    rewrite(path) {
      return path.replace(
        new RegExp(`^${GOV1_ACCEPTANCE_API_PREFIX}(?=/|$)`),
        '/api',
      );
    },
    configure(proxy) {
      proxy.on('proxyReq', (proxyRequest) => {
        for (const header of UNTRUSTED_BROWSER_IDENTITY_HEADERS) {
          proxyRequest.removeHeader(header);
        }

        if (normalizedIdentity) {
          proxyRequest.setHeader('x-stark-actor-username', normalizedIdentity.username);
          proxyRequest.setHeader('x-stark-actor-secret', normalizedIdentity.secret);
        }
      });
    },
  };
}
