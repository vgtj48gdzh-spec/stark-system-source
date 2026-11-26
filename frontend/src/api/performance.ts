import http from './http';

export function getEmployees(params?: Record<string, unknown>) {
  return http.get('/performance/employees', { params });
}

export function createEmployee(payload: Record<string, unknown>) {
  return http.post('/performance/employees', payload);
}

export function updateEmployee(id: number, payload: Record<string, unknown>) {
  return http.patch(`/performance/employees/${id}`, payload);
}

export function getEmployeeSourceBindings(params?: Record<string, unknown>) {
  return http.get('/performance/employee-source-bindings', { params });
}

export function createEmployeeSourceBinding(payload: Record<string, unknown>) {
  return http.post('/performance/employee-source-bindings', payload);
}

export function updateEmployeeSourceBinding(id: number, payload: Record<string, unknown>) {
  return http.patch(`/performance/employee-source-bindings/${id}`, payload);
}

export function getPerformanceRules(params?: Record<string, unknown>) {
  return http.get('/performance/rules', { params });
}

export function createPerformanceRule(payload: Record<string, unknown>) {
  return http.post('/performance/rules', payload);
}

export function updatePerformanceRule(id: number, payload: Record<string, unknown>) {
  return http.patch(`/performance/rules/${id}`, payload);
}

export function generatePerformanceEvents(payload: Record<string, unknown>) {
  return http.post('/performance/events/generate', payload);
}

export function getPerformanceEvents(params?: Record<string, unknown>) {
  return http.get('/performance/events', { params });
}

export function generatePerformanceSummaries(payload: Record<string, unknown>) {
  return http.post('/performance/summaries/generate', payload);
}

export function getPerformanceSummaries(params?: Record<string, unknown>) {
  return http.get('/performance/summaries', { params });
}

export function getPerformanceSummaryDetail(id: number, params?: Record<string, unknown>) {
  return http.get(`/performance/summaries/${id}/detail`, { params });
}

export function confirmPerformanceSummaryCustomerBinding(
  id: number,
  payload: Record<string, unknown>,
) {
  return http.post(`/performance/summaries/${id}/confirm-customer-binding`, payload);
}

export function decidePerformanceSummaryManualDecision(
  id: number,
  payload: Record<string, unknown>,
) {
  return http.post(`/performance/summaries/${id}/manual-decision`, payload);
}

export function getPendingPerformanceItems(params?: Record<string, unknown>) {
  return http.get('/performance/pending-items', { params });
}

export function rebindPendingPerformanceItem(id: number, payload: Record<string, unknown>) {
  return http.post(`/performance/pending-items/${id}/rebind`, payload);
}

export function confirmPendingPerformanceItem(id: number, payload: Record<string, unknown>) {
  return http.post(`/performance/pending-items/${id}/confirm`, payload);
}

export function ignorePendingPerformanceItem(id: number, payload: Record<string, unknown>) {
  return http.post(`/performance/pending-items/${id}/ignore`, payload);
}
