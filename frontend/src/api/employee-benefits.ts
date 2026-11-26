import http from './http';

export function createEmployeeBenefitIssue(payload: Record<string, unknown>) {
  return http.post('/employee-benefits/issues', payload);
}

export function getEmployeeBenefitIssues(params?: Record<string, unknown>) {
  return http.get('/employee-benefits/issues', { params });
}

export function getEmployeeBenefitIssue(id: number) {
  return http.get(`/employee-benefits/issues/${id}`);
}

export function confirmEmployeeBenefitIssue(id: number, payload: Record<string, unknown>) {
  return http.post(`/employee-benefits/issues/${id}/confirm`, payload);
}

export function issueEmployeeBenefitIssue(id: number, payload: Record<string, unknown>) {
  return http.post(`/employee-benefits/issues/${id}/issue`, payload);
}

export function getEmployeeBenefitAccountSummary(employeeId: number) {
  return http.get(`/employee-benefits/accounts/${employeeId}/summary`);
}

export function getEmployeeBenefitAccountLedger(
  employeeId: number,
  params?: Record<string, unknown>,
) {
  return http.get(`/employee-benefits/accounts/${employeeId}/ledger`, { params });
}

export function getEmployeeBenefitAccountExpiring(
  employeeId: number,
  params?: Record<string, unknown>,
) {
  return http.get(`/employee-benefits/accounts/${employeeId}/expiring`, { params });
}

export function getEmployeeBenefitNotifications(params?: Record<string, unknown>) {
  return http.get('/employee-benefits/notifications', { params });
}

export function readEmployeeBenefitNotification(id: number) {
  return http.post(`/employee-benefits/notifications/${id}/read`);
}

export function getEmployeeBenefitAiContext(employeeId: number) {
  return http.get(`/employee-benefits/ai-context/${employeeId}`);
}
