import http from './http';

export function generatePayrollTrials(payload: Record<string, unknown>) {
  return http.post('/payroll-trials/generate', payload);
}

export function getPayrollTrials(params?: Record<string, unknown>) {
  return http.get('/payroll-trials', { params });
}

export function getPayrollTrial(id: number) {
  return http.get(`/payroll-trials/${id}`);
}

export function getPayrollTrialDetail(id: number, params?: Record<string, unknown>) {
  return http.get(`/payroll-trials/${id}/detail`, { params });
}

export function confirmPayrollTrial(id: number, payload: Record<string, unknown>) {
  return http.post(`/payroll-trials/${id}/confirm`, payload);
}

export function getPayrollTrialPendingItems(params?: Record<string, unknown>) {
  return http.get('/payroll-trials/pending-items', { params });
}
