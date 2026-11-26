import http from './http';

export function getAiNextActions(params?: Record<string, unknown>) {
  return http.get('/ai/next-actions', { params });
}

export function getAiConsoleOverview(params?: Record<string, unknown>) {
  return http.get('/ai/console/overview', { params });
}

export function getAiSummaryContext(id: number | string, params?: Record<string, unknown>) {
  return http.get(`/ai/context/summary/${id}`, { params });
}

export function getAiTaskContext(actionId: string, params?: Record<string, unknown>) {
  return http.get(`/ai/context/task/${encodeURIComponent(actionId)}`, { params });
}

export function getAiPointsCommandContext(
  id: number | string,
  params?: Record<string, unknown>,
) {
  return http.get(`/ai/context/points-command/${id}`, { params });
}

export function getAiPointsRedemptionContext(
  id: number | string,
  params?: Record<string, unknown>,
) {
  return http.get(`/ai/context/points-redemption/${id}`, { params });
}

export function getAiPageContext(params?: Record<string, unknown>) {
  return http.get('/ai/context/page', { params });
}

export function replyAiAssistant(payload: Record<string, unknown>) {
  return http.post('/ai/assistant/reply', payload);
}

export function markAiActionState(payload: Record<string, unknown>) {
  return http.post('/ai/action-states', payload);
}

export function getAiMemoryEntries(params?: Record<string, unknown>) {
  return http.get('/ai/memory', { params });
}

export function createAiMemoryEntry(payload: Record<string, unknown>) {
  return http.post('/ai/memory', payload);
}

export function updateAiMemoryEntry(id: number | string, payload: Record<string, unknown>) {
  return http.patch(`/ai/memory/${id}`, payload);
}

export function toggleAiMemoryEntry(id: number | string, payload: Record<string, unknown>) {
  return http.post(`/ai/memory/${id}/toggle`, payload);
}
