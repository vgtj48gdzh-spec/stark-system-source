import http from './http';

export interface BankAccountRegistryQuery {
  page?: number;
  pageSize?: number;
  companyId?: number;
  bankName?: string;
  smsSender?: string;
  accountTail?: string;
  status?: 'active' | 'inactive';
}

export interface SaveBankAccountRegistryPayload {
  companyId: number;
  bankName: string;
  smsSender: string;
  accountTail: string;
  accountAlias: string;
  accountHolder?: string;
  virtualLedgerId?: number;
  deviceId?: string;
  simSlot?: number;
  status?: 'active' | 'inactive';
}

export function getBankAccountRegistries(params?: BankAccountRegistryQuery, requestConfig?: Record<string, unknown>) {
  return http.get('/finance/bank-accounts', { params, ...(requestConfig ?? {}) });
}

export function getPendingBankAccountMessages(params?: BankAccountRegistryQuery, requestConfig?: Record<string, unknown>) {
  return http.get('/finance/bank-accounts/pending-messages', { params, ...(requestConfig ?? {}) });
}

export function createBankAccountRegistry(payload: SaveBankAccountRegistryPayload) {
  return http.post('/finance/bank-accounts', payload);
}

export function updateBankAccountRegistry(id: number | string, payload: SaveBankAccountRegistryPayload) {
  return http.put(`/finance/bank-accounts/${id}`, payload);
}

export function rebindBankAccountRegistryHistory(id: number | string) {
  return http.post(`/finance/bank-accounts/${id}/rebind-history`);
}

export function backfillBankAccountRegistry(id: number | string) {
  return rebindBankAccountRegistryHistory(id);
}
