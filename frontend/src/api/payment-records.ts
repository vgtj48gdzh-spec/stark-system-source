import http from './http';

export function createPaymentRecord(payload: Record<string, unknown>) {
  return http.post('/payment-records', payload);
}

export function getPaymentRecords(params?: { page?: number; pageSize?: number }) {
  return http.get('/payment-records', { params });
}

export function getPaymentRecordDetail(id: string | number) {
  return http.get(`/payment-records/${id}`);
}

export function getPaymentRecordPrecheck(id: string | number) {
  return http.get(`/payment-records/${id}/precheck`);
}
