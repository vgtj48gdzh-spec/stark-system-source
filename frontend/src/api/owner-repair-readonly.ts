import http from './http';

export interface OwnerRepairWorkOrder {
  id: number;
  workOrderNo: string;
  title: string;
  customerName: string;
  customerMobile?: string | null;
  amountDue: string;
  amountReceived: string;
  materialCostTotal: string;
  status: string;
  responsibleUserId?: number | null;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerRepairWorkOrderPage {
  list: OwnerRepairWorkOrder[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OwnerRepairWorkspace {
  workOrder: Record<string, unknown>;
  profile: Record<string, any> | null;
  vehicle?: Record<string, any> | null;
  documents?: Array<Record<string, any>>;
  confirmationRequests?: Array<Record<string, any>>;
  tasks?: Array<Record<string, any>>;
  laborItems?: Array<Record<string, any>>;
  partLinks?: Array<Record<string, any>>;
  qualityInspections?: Array<Record<string, any>>;
  delivery?: Record<string, any> | null;
  warranties?: Array<Record<string, any>>;
  aiDrafts?: Array<Record<string, any>>;
  financeReadiness?: Record<string, any> | null;
  boundaries?: Record<string, any> | null;
}

export function getOwnerRepairWorkOrders(params: { page: number; pageSize: number }) {
  return http.get<{ success: boolean; data: OwnerRepairWorkOrderPage }>('/work-orders', {
    params,
  });
}

export function getOwnerRepairWorkOrder(id: string | number) {
  return http.get<{ success: boolean; data: OwnerRepairWorkOrder }>(`/work-orders/${id}`);
}

export function getOwnerRepairWorkspace(id: string | number) {
  return http.get<{ success: boolean; data: OwnerRepairWorkspace }>(
    `/repair-shop/work-orders/${id}/workspace`,
    { headers: { 'x-suppress-global-error': '1' } },
  );
}
