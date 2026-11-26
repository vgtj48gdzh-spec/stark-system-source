import http from './http';

export interface WorkOrderPayload {
  title: string;
  customerName: string;
  customerMobile?: string;
  amountDue: string;
  responsibleUserId?: number;
  remark?: string;
}

export interface WorkOrderMaterialPayload {
  requestIdempotencyKey: string;
  materialId: number;
  sourceType: 'manual' | 'warehouse' | 'preparation';
  warehouseId?: number;
  preparationId?: number;
  quantity: string;
  unitPrice: string;
  remark?: string;
}

export interface UpdateWorkOrderMaterialPayload {
  quantity?: string;
  unitPrice?: string;
  remark?: string;
}

export interface WorkOrderMaterialsQuery {
  includeDeleted?: boolean;
}

export function createWorkOrder(payload: WorkOrderPayload) {
  return http.post('/work-orders', payload);
}

export function getWorkOrders(params?: { page?: number; pageSize?: number }) {
  return http.get('/work-orders', { params });
}

export function getWorkOrderDetail(id: string | number) {
  return http.get(`/work-orders/${id}`);
}

export function updateWorkOrder(id: string | number, payload: Record<string, unknown>) {
  return http.patch(`/work-orders/${id}`, payload);
}

export function getWorkOrderMaterials(id: string | number, params?: WorkOrderMaterialsQuery) {
  return http.get(`/work-orders/${id}/materials`, { params });
}

export function createWorkOrderMaterial(
  id: string | number,
  payload: WorkOrderMaterialPayload,
) {
  return http.post(`/work-orders/${id}/materials`, payload);
}

export function updateWorkOrderMaterial(
  workOrderId: string | number,
  id: string | number,
  payload: UpdateWorkOrderMaterialPayload,
) {
  return http.patch(`/work-orders/${workOrderId}/materials/${id}`, payload);
}

export function deleteWorkOrderMaterial(workOrderId: string | number, id: string | number) {
  return http.delete(`/work-orders/${workOrderId}/materials/${id}`);
}

export function getWorkOrderMaterialAudit(workOrderId: string | number, id: string | number) {
  return http.get(`/work-orders/${workOrderId}/materials/${id}/audit`);
}
