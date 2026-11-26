import http from './http';

export interface MaterialPreparationPayload {
  materialId: number;
  supplierId?: number;
  warehouseId?: number;
  quantity: string;
  unitPrice: string;
  linkedWorkOrderId?: number;
  responsibleUserId?: number;
  preparedAt?: string;
  bindDeadlineAt?: string;
  remark?: string;
}

export interface MaterialPreparationQuery {
  responsibleUserId?: number;
  supplierId?: number;
  materialId?: number;
  warehouseId?: number;
  bindStatus?: 'unbound' | 'bound';
  dateFrom?: string;
  dateTo?: string;
  isOverdue?: boolean;
}

export function createMaterialPreparation(payload: MaterialPreparationPayload) {
  return http.post('/material-preparations', payload);
}

export function getMaterialPreparations(params?: MaterialPreparationQuery) {
  return http.get('/material-preparations', { params });
}

export function getMaterialPreparationDetail(id: string | number) {
  return http.get(`/material-preparations/${id}`);
}

export function getMaterialPreparationAudit(id: string | number) {
  return http.get(`/material-preparations/${id}/audit`);
}

export function bindMaterialPreparation(id: string | number, payload: { workOrderId: number }) {
  return http.post(`/material-preparations/${id}/bind-work-order`, payload);
}
