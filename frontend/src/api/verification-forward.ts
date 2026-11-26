import http from './http';

export interface VerificationCodeDispatchQuery {
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
  sender?: string;
  channel?: 'ai_alert' | 'email';
  status?: string;
}

export function getVerificationCodeDispatches(
  params?: VerificationCodeDispatchQuery,
  requestConfig?: Record<string, unknown>,
) {
  return http.get('/security/verification-codes', { params, ...(requestConfig ?? {}) });
}

export function getVerificationCodeDispatchDetail(
  id: number | string,
  requestConfig?: Record<string, unknown>,
) {
  return http.get(`/security/verification-codes/${id}`, requestConfig ?? {});
}
