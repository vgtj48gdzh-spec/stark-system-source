import http from './http';

export function getOperationLogs(params?: {
  page?: number;
  pageSize?: number;
  module?: string;
  action?: string;
  targetId?: number;
  operatorId?: number;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}, signal?: AbortSignal) {
  return http.get('/operation-logs', { params, signal, headers: { 'x-suppress-global-error': '1' } });
}
