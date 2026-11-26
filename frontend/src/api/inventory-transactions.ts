import http from './http';

export interface InventoryTransactionPayload {
  requestIdempotencyKey: string;
  warehouseId: number;
  materialId: number;
  quantity: string;
  unitPrice: string;
  relatedWorkOrderId?: number;
  relatedPreparationId?: number;
  remark?: string;
}

export function createInventoryInbound(payload: InventoryTransactionPayload) {
  return http.post('/inventory-transactions/inbound', payload);
}

export function createInventoryOutbound(payload: InventoryTransactionPayload) {
  return http.post('/inventory-transactions/outbound', payload);
}

export function getInventoryTransactions(params?: {
  page?: number;
  pageSize?: number;
  transactionType?: string;
  relatedWorkOrderMaterialId?: number;
  materialId?: number;
  warehouseId?: number;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  return http.get('/inventory-transactions', { params });
}

export function getInventoryTransactionDetail(id: string | number) {
  return http.get(`/inventory-transactions/${id}`);
}

export function requestInventoryAdjustmentApproval(
  id: string | number,
  payload: {
    requestIdempotencyKey: string;
    action: 'reverse' | 'adjust';
    reason: string;
    targetQuantity?: string;
    targetUnitPrice?: string;
  },
) {
  return http.post(`/inventory-transactions/${id}/adjustment-approval-requests`, payload);
}

export function applyApprovedInventoryAdjustment(
  id: string | number,
  payload: { approvalRequestId: number; requestIdempotencyKey: string },
) {
  return http.post(`/inventory-transactions/${id}/adjustments/apply`, payload);
}
