import http from './http';

export interface SupplierPayload {
  name: string;
  contactName?: string;
  contactMobile?: string;
  address?: string;
  status?: string;
  remark?: string;
  score?: string;
}

export function createSupplier(payload: SupplierPayload) {
  return http.post('/suppliers', payload);
}

export function getSuppliers() {
  return http.get('/suppliers');
}

export function getSupplierDetail(id: string | number) {
  return http.get(`/suppliers/${id}`);
}

export function updateSupplier(id: string | number, payload: Partial<SupplierPayload>) {
  return http.patch(`/suppliers/${id}`, payload);
}
