import http from './http';

export function getVirtualAmountCheck(requestConfig?: Record<string, unknown>) {
  return http.get('/finance/reconciliation/virtual-amount-check', requestConfig ?? {});
}
