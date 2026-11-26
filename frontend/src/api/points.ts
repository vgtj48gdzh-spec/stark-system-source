import http from './http';

export function createPointsCommandDraft(payload: Record<string, unknown>) {
  return http.post('/points/commands/draft', payload);
}

export function confirmPointsCommand(id: number | string, payload?: Record<string, unknown>) {
  return http.post(`/points/commands/${id}/confirm`, payload ?? {});
}

export function executePointsCommand(id: number | string, payload?: Record<string, unknown>) {
  return http.post(`/points/commands/${id}/execute`, payload ?? {});
}

export function cancelPointsCommand(id: number | string, payload?: Record<string, unknown>) {
  return http.post(`/points/commands/${id}/cancel`, payload ?? {});
}

export function getPointsCommands(params?: Record<string, unknown>) {
  return http.get('/points/commands', { params });
}

export function getPointsCommandDetail(
  id: number | string,
  params?: Record<string, unknown>,
) {
  return http.get(`/points/commands/${id}`, { params });
}

export function getPointsLedger(params?: Record<string, unknown>) {
  return http.get('/points/ledger', { params });
}

export function getPointsRedeemables(params?: Record<string, unknown>) {
  return http.get('/points/redeemables', { params });
}

export function createPointsRedemptionDraft(payload: Record<string, unknown>) {
  return http.post('/points/redemptions/draft', payload);
}

export function confirmPointsRedemption(
  id: number | string,
  payload?: Record<string, unknown>,
) {
  return http.post(`/points/redemptions/${id}/confirm`, payload ?? {});
}

export function markPointsRedemptionFulfilled(
  id: number | string,
  payload: Record<string, unknown>,
) {
  return http.post(`/points/redemptions/${id}/mark-fulfilled`, payload);
}

export function cancelPointsRedemption(
  id: number | string,
  payload?: Record<string, unknown>,
) {
  return http.post(`/points/redemptions/${id}/cancel`, payload ?? {});
}

export function getPointsRedemptions(params?: Record<string, unknown>) {
  return http.get('/points/redemptions', { params });
}

export function getPointsRedemptionDetail(
  id: number | string,
  params?: Record<string, unknown>,
) {
  return http.get(`/points/redemptions/${id}`, { params });
}

export function getPointsWelfarePreview(params?: Record<string, unknown>) {
  return http.get('/points/welfare/preview', { params });
}

export function createPointsWelfareBatchDraft(payload: Record<string, unknown>) {
  return http.post('/points/welfare/batches/draft', payload);
}

export function confirmPointsWelfareBatch(
  id: number | string,
  payload?: Record<string, unknown>,
) {
  return http.post(`/points/welfare/batches/${id}/confirm`, payload ?? {});
}

export function executePointsWelfareBatch(
  id: number | string,
  payload?: Record<string, unknown>,
) {
  return http.post(`/points/welfare/batches/${id}/execute`, payload ?? {});
}

export function cancelPointsWelfareBatch(
  id: number | string,
  payload?: Record<string, unknown>,
) {
  return http.post(`/points/welfare/batches/${id}/cancel`, payload ?? {});
}

export function getPointsWelfareBatches(params?: Record<string, unknown>) {
  return http.get('/points/welfare/batches', { params });
}

export function getPointsWelfareBatchDetail(
  id: number | string,
  params?: Record<string, unknown>,
) {
  return http.get(`/points/welfare/batches/${id}`, { params });
}

export function getPointsWelfareBatchItems(
  id: number | string,
  params?: Record<string, unknown>,
) {
  return http.get(`/points/welfare/batches/${id}/items`, { params });
}

export function patchPointsWelfareBatchItem(
  batchId: number | string,
  itemId: number | string,
  payload: Record<string, unknown>,
) {
  return http.patch(`/points/welfare/batches/${batchId}/items/${itemId}`, payload);
}

export function movePointsWelfareBatchItem(
  batchId: number | string,
  itemId: number | string,
  payload: Record<string, unknown>,
) {
  return http.post(`/points/welfare/batches/${batchId}/items/${itemId}/move`, payload);
}

export function getAbcPointsOverview() {
  return http.get('/abc-points/overview');
}

export function getAbcPointsLedger(params?: Record<string, unknown>) {
  return http.get('/abc-points/ledger', { params });
}

export function createAbcPointsCommandDraft(payload: Record<string, unknown>) {
  return http.post('/abc-points/commands/draft', payload);
}

export function confirmAbcPointsCommand(
  id: number | string,
  payload?: Record<string, unknown>,
) {
  return http.post(`/abc-points/commands/${id}/confirm`, payload ?? {});
}

export function executeAbcPointsCommand(
  id: number | string,
  payload?: Record<string, unknown>,
) {
  return http.post(`/abc-points/commands/${id}/execute`, payload ?? {});
}

export function cancelAbcPointsCommand(
  id: number | string,
  payload?: Record<string, unknown>,
) {
  return http.post(`/abc-points/commands/${id}/cancel`, payload ?? {});
}

export function getAbcPointsCommands(params?: Record<string, unknown>) {
  return http.get('/abc-points/commands', { params });
}

export function getAbcPointsCommandDetail(
  id: number | string,
  params?: Record<string, unknown>,
) {
  return http.get(`/abc-points/commands/${id}`, { params });
}

export function getAbcPointsCommandPrecheck(
  id: number | string,
  params?: Record<string, unknown>,
) {
  return http.get(`/abc-points/commands/${id}/precheck`, { params });
}
