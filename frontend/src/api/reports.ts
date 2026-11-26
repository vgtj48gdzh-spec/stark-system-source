import http from './http';

export function getWorkOrderMaterialCostReport(params?: Record<string, unknown>) {
  return http.get('/reports/work-order-material-costs', { params });
}

export function getInventoryAlertsReport(params?: Record<string, unknown>) {
  return http.get('/reports/inventory-alerts', { params });
}

export function getUnboundOverduePreparationsReport(params?: Record<string, unknown>) {
  return http.get('/reports/material-preparations/unbound-overdue', { params });
}

export function getSupplierMaterialUsageReport(params?: Record<string, unknown>) {
  return http.get('/reports/supplier-material-usage', { params });
}
