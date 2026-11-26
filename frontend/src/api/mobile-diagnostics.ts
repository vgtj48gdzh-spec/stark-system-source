import http from './http';

export function getMobileSmsDiagnosticsOverview(deviceId?: string, requestConfig?: Record<string, unknown>) {
  return http.get('/mobile-diagnostics/overview', {
    params: {
      deviceId: deviceId || undefined,
    },
    timeout: 30000,
    ...(requestConfig ?? {}),
  });
}

export function requestMobileInboxSync(deviceId: string) {
  return http.post(`/mobile-diagnostics/devices/${encodeURIComponent(deviceId)}/request-inbox-sync`);
}

export function requestMobileTestUpload(deviceId: string) {
  return http.post(`/mobile-diagnostics/devices/${encodeURIComponent(deviceId)}/request-test-upload`);
}

export function requestMobileBackendRediscovery(deviceId: string) {
  return http.post(`/mobile-diagnostics/devices/${encodeURIComponent(deviceId)}/request-backend-rediscovery`);
}

export function requestMobileSwitchDiscoveredBackend(deviceId: string) {
  return http.post(`/mobile-diagnostics/devices/${encodeURIComponent(deviceId)}/request-switch-discovered-backend`);
}

export function requestMobilePendingQueueRetry(deviceId: string) {
  return http.post(`/mobile-diagnostics/devices/${encodeURIComponent(deviceId)}/request-pending-queue-retry`);
}

export function clearMobileTargetFailure(deviceId: string) {
  return http.post(`/mobile-diagnostics/devices/${encodeURIComponent(deviceId)}/clear-target-failure`);
}

export function importRawSmsMessage(payload: {
  sender: string;
  body: string;
  receivedAt: string;
  source: 'manual_import';
}, requestConfig?: Record<string, unknown>) {
  return http.post('/message-hub/raw-import', payload, requestConfig ?? {});
}
