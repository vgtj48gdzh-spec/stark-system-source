import http from './http';

export function generateStatTags(payload: Record<string, unknown>) {
  return http.post('/stat-tags/generate', payload);
}

export function getStatTags(params?: Record<string, unknown>) {
  return http.get('/stat-tags', { params });
}

export function getStatTag(id: number) {
  return http.get(`/stat-tags/${id}`);
}

export function updateStatTag(id: number, payload: Record<string, unknown>) {
  return http.patch(`/stat-tags/${id}`, payload);
}

export function generateRewardEvents(payload: Record<string, unknown>) {
  return http.post('/reward-events/generate', payload);
}

export function getRewardEvents(params?: Record<string, unknown>) {
  return http.get('/reward-events', { params });
}

export function getRewardEvent(id: number) {
  return http.get(`/reward-events/${id}`);
}

export function confirmRewardEvent(id: number, payload: Record<string, unknown>) {
  return http.post(`/reward-events/${id}/confirm`, payload);
}

export function ignoreRewardEvent(id: number, payload: Record<string, unknown>) {
  return http.post(`/reward-events/${id}/ignore`, payload);
}

export function reassignRewardEvent(id: number, payload: Record<string, unknown>) {
  return http.post(`/reward-events/${id}/reassign`, payload);
}

export function getRewardRules(params?: Record<string, unknown>) {
  return http.get('/reward-rules', { params });
}

export function createRewardRule(payload: Record<string, unknown>) {
  return http.post('/reward-rules', payload);
}

export function updateRewardRule(id: number, payload: Record<string, unknown>) {
  return http.patch(`/reward-rules/${id}`, payload);
}

export function toggleRewardRule(id: number, isActive: boolean) {
  return http.post(`/reward-rules/${id}/toggle`, { isActive });
}

export function generateStatSummaries(payload: Record<string, unknown>) {
  return http.post('/stat-summaries/generate', payload);
}

export function getStatSummaries(params?: Record<string, unknown>) {
  return http.get('/stat-summaries', { params });
}

export function getStatSummaryDetail(id: number, params?: Record<string, unknown>) {
  return http.get(`/stat-summaries/${id}/detail`, { params });
}

export function confirmStatSummary(id: number, payload: Record<string, unknown>) {
  return http.post(`/stat-summaries/${id}/confirm`, payload);
}

export function getStatPendingItems(params?: Record<string, unknown>) {
  return http.get('/stat-pending-items', { params });
}
