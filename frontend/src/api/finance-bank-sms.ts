import http from './http';

export interface FinanceBankSmsQuery {
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
  rawSmsId?: number;
  companyId?: number;
  bankName?: string;
  accountTail?: string;
  direction?: 'income' | 'expense';
  reconcileStatus?: 'pending_binding' | 'pending' | 'pending_evidence' | 'suggested' | 'confirmed' | 'ignored';
}

export interface PendingFinanceBankSmsQuery {
  page?: number;
  pageSize?: number;
}

export function getFinanceBankSmsOverview(requestConfig?: Record<string, unknown>) {
  return http.get('/finance/bank-sms/overview', requestConfig ?? {});
}

export function getFinanceBankSmsPending(
  params?: PendingFinanceBankSmsQuery,
  requestConfig?: Record<string, unknown>,
) {
  return http.get('/finance/bank-sms/pending', { params, ...(requestConfig ?? {}) });
}

export function getFinanceBankSmsTransactions(params?: FinanceBankSmsQuery, requestConfig?: Record<string, unknown>) {
  return http.get('/finance/bank-sms/transactions', { params, ...(requestConfig ?? {}) });
}

export function getFinanceBankSmsTransactionDetail(id: number | string, requestConfig?: Record<string, unknown>) {
  return http.get(`/finance/bank-sms/transactions/${id}`, requestConfig ?? {});
}

export function reconcileFinanceBankSmsTransaction(
  id: number | string,
  payload?: {
    linkType?:
      | 'receipt_item'
      | 'approval_order'
      | 'manual_fee'
      | 'wechat_settlement_batch'
      | 'internal_fund_flow'
      | 'receivable_tracking';
    linkId?: number;
    note?: string;
  },
) {
  return http.post(`/finance/bank-sms/transactions/${id}/reconcile`, payload ?? {});
}

export function confirmApplyFinanceBankSmsTransaction(
  id: number | string,
  payload?: {
    reconciliationLinkId?: number;
    confirmedAmount?: string;
    verificationCode?: string;
    note?: string;
  },
) {
  return http.post(`/finance/bank-sms/transactions/${id}/confirm-apply`, payload ?? {});
}

export function ignoreFinanceBankSmsTransaction(
  id: number | string,
  payload?: {
    note?: string;
  },
) {
  return http.post(`/finance/bank-sms/transactions/${id}/ignore`, payload ?? {});
}
