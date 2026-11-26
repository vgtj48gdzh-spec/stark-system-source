import http from './http';

export interface WarehousePayload {
  name: string;
  code: string;
  managerUserId?: number;
  address?: string;
  status?: string;
  remark?: string;
}

export function createWarehouse(payload: WarehousePayload) {
  return http.post('/warehouses', payload);
}

export function getWarehouses() {
  return http.get('/warehouses');
}

export function getWarehouseDetail(id: string | number) {
  return http.get(`/warehouses/${id}`);
}

export function updateWarehouse(id: string | number, payload: Partial<WarehousePayload>) {
  return http.patch(`/warehouses/${id}`, payload);
}
