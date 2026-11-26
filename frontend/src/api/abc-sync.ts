import http from './http';

export function getAbcSyncOrders(params?: Record<string, unknown>) {
  return http.get('/abc-sync/orders', { params });
}

export function getAbcSyncDashboard(params?: Record<string, unknown>) {
  return http.get('/abc-sync/dashboard', { params });
}

export function getAbcSyncFunds(params?: Record<string, unknown>) {
  return http.get('/abc-sync/funds', { params });
}

export function getAbcSyncCards(params?: Record<string, unknown>) {
  return http.get('/abc-sync/cards', { params });
}

export function getAbcSyncCardLedger(params?: Record<string, unknown>) {
  return http.get('/abc-sync/card-ledger', { params });
}

export function getAbcSyncMaterials(params?: Record<string, unknown>) {
  return http.get('/abc-sync/materials', { params });
}

export function getAbcSyncSuppliers(params?: Record<string, unknown>) {
  return http.get('/abc-sync/suppliers', { params });
}

export function getAbcSyncWarehouses(params?: Record<string, unknown>) {
  return http.get('/abc-sync/warehouses', { params });
}

export function getAbcSyncInventoryLedger(params?: Record<string, unknown>) {
  return http.get('/abc-sync/inventory-ledger', { params });
}

export function getAbcSyncJobRuns(params?: Record<string, unknown>) {
  return http.get('/abc-sync/job-runs', { params });
}

export function getAbcSyncCheckpoints(params?: Record<string, unknown>) {
  return http.get('/abc-sync/checkpoints', { params });
}

export function getAbcSyncMappingExceptions(params?: Record<string, unknown>) {
  return http.get('/abc-sync/mapping-exceptions', { params });
}

export function getAbcSyncCardMappingExceptions(params?: Record<string, unknown>) {
  return http.get('/abc-sync/card-mapping-exceptions', { params });
}

export function getAbcSyncInventoryMappingExceptions(params?: Record<string, unknown>) {
  return http.get('/abc-sync/inventory-mapping-exceptions', { params });
}

export function getAbcStatusMappings(params?: Record<string, unknown>) {
  return http.get('/abc-sync/status-mappings', { params });
}

export function createAbcStatusMapping(payload: Record<string, unknown>) {
  return http.post('/abc-sync/status-mappings', payload);
}

export function updateAbcStatusMapping(id: number, payload: Record<string, unknown>) {
  return http.patch(`/abc-sync/status-mappings/${id}`, payload);
}

export function toggleAbcStatusMapping(id: number, isActive: boolean) {
  return http.post(`/abc-sync/status-mappings/${id}/toggle`, { isActive });
}

export function getAbcAmountRules(params?: Record<string, unknown>) {
  return http.get('/abc-sync/amount-rules', { params });
}

export function createAbcAmountRule(payload: Record<string, unknown>) {
  return http.post('/abc-sync/amount-rules', payload);
}

export function updateAbcAmountRule(id: number, payload: Record<string, unknown>) {
  return http.patch(`/abc-sync/amount-rules/${id}`, payload);
}

export function toggleAbcAmountRule(id: number, isActive: boolean) {
  return http.post(`/abc-sync/amount-rules/${id}/toggle`, { isActive });
}

export function rerunAbcNormalization(payload: Record<string, unknown>) {
  return http.post('/abc-sync/normalizations/re-run', payload);
}
