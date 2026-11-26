import http from './http';

export interface MaterialPayload {
  name: string;
  specification?: string;
  unit: string;
  category?: string;
  defaultSupplierId?: number;
  defaultUnitPrice?: string;
  warningQuantity?: string;
  status?: string;
  remark?: string;
}

export function createMaterial(payload: MaterialPayload) {
  return http.post('/materials', payload);
}

export function getMaterials() {
  return http.get('/materials');
}

export function getMaterialDetail(id: string | number) {
  return http.get(`/materials/${id}`);
}

export function updateMaterial(id: string | number, payload: Partial<MaterialPayload>) {
  return http.patch(`/materials/${id}`, payload);
}
