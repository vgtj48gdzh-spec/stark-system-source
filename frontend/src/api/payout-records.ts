import http from './http';

export function createPayoutRecord(payload: Record<string, unknown>) {
  return http.post('/payout-records', payload);
}

export function getPayoutRecords(params?: { page?: number; pageSize?: number }) {
  return http.get('/payout-records', { params });
}

export function getPayoutRecordDetail(id: string | number) {
  return http.get(`/payout-records/${id}`);
}
