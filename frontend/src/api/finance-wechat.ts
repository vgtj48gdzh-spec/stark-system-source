import http from './http';

export interface WechatMerchantQuery {
  page?: number;
  pageSize?: number;
  companyId?: number;
  merchantId?: string;
  status?: 'active' | 'inactive';
}

export interface SaveWechatMerchantPayload {
  companyId: number;
  merchantId: string;
  appId?: string;
  merchantName: string;
  settlementBankAccountRegistryId?: number;
  status?: 'active' | 'inactive';
}

export interface WechatReceiptQuery {
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
  companyId?: number;
  merchantId?: string;
  workOrderId?: number;
  paymentStatus?: 'paid_confirmed' | 'refunded' | 'closed';
  settlementStatus?: 'pending_settlement' | 'batched' | 'settled' | 'exception';
}

export interface ImportWechatReceiptPayload {
  companyId: number;
  merchantId: string;
  workOrderId?: number;
  outTradeNo: string;
  transactionId: string;
  payerRef?: string;
  amountPaid: string;
  paidAt: string;
  paymentStatus?: 'paid_confirmed' | 'refunded' | 'closed';
  settlementStatus?: 'pending_settlement' | 'batched' | 'settled' | 'exception';
  rawPayload?: Record<string, unknown>;
}

export interface WechatSettlementBatchQuery {
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
  companyId?: number;
  merchantId?: string;
  bankAccountRegistryId?: number;
  matchStatus?: 'pending_bank_match' | 'suggested' | 'confirmed' | 'exception';
}

export interface CreateWechatSettlementBatchPayload {
  companyId: number;
  merchantId: string;
  settlementDate: string;
  batchNo?: string;
  feeAmount?: string;
  bankAccountRegistryId?: number;
  paymentReceiptIds: number[];
  rawPayload?: Record<string, unknown>;
}

export function getWechatMerchants(params?: WechatMerchantQuery, requestConfig?: Record<string, unknown>) {
  return http.get('/finance/wechat/merchants', { params, ...(requestConfig ?? {}) });
}

export function createWechatMerchant(
  payload: SaveWechatMerchantPayload,
  requestConfig?: Record<string, unknown>,
) {
  return http.post('/finance/wechat/merchants', payload, requestConfig ?? {});
}

export function getWechatPaymentReceipts(params?: WechatReceiptQuery, requestConfig?: Record<string, unknown>) {
  return http.get('/finance/wechat/receipts', { params, ...(requestConfig ?? {}) });
}

export function getWechatPaymentReceiptDetail(id: number | string, requestConfig?: Record<string, unknown>) {
  return http.get(`/finance/wechat/receipts/${id}`, requestConfig ?? {});
}

export function importWechatPaymentReceipt(
  payload: ImportWechatReceiptPayload,
  requestConfig?: Record<string, unknown>,
) {
  return http.post('/finance/wechat/receipts/manual-import', payload, requestConfig ?? {});
}

export function getWechatSettlementBatches(params?: WechatSettlementBatchQuery, requestConfig?: Record<string, unknown>) {
  return http.get('/finance/wechat/settlement-batches', { params, ...(requestConfig ?? {}) });
}

export function getWechatSettlementBatchDetail(id: number | string, requestConfig?: Record<string, unknown>) {
  return http.get(`/finance/wechat/settlement-batches/${id}`, requestConfig ?? {});
}

export function createWechatSettlementBatch(
  payload: CreateWechatSettlementBatchPayload,
  requestConfig?: Record<string, unknown>,
) {
  return http.post('/finance/wechat/settlement-batches', payload, requestConfig ?? {});
}
