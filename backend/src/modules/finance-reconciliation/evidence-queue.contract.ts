export type FinanceEvidenceQueueType =
  | 'pending_account_evidence'
  | 'unmatched_exception'
  | 'pending_binding';

export type FinanceEvidenceDirection = 'income' | 'expense';

export type FinanceEvidenceRiskLevel = 'low' | 'medium' | 'high';

export interface PendingAccountEvidenceQueueItem {
  queueType: 'pending_account_evidence' | 'pending_binding';
  transactionId: number | null;
  sourceId: number;
  sourceTable: 'bank_sms_transaction' | 'sms_message_classification';
  bankName: string | null;
  direction: FinanceEvidenceDirection | null;
  amount: string | null;
  balanceAfter: string | null;
  accountTail: string | null;
  accountAliasMasked: string | null;
  evidenceStatus: 'pending_account_evidence' | 'pending_binding';
  missingEvidence: string[];
  suggestedAction: string;
  sourceCreatedAt: string | null;
  lastClassifiedAt: string | null;
  riskLevel: FinanceEvidenceRiskLevel;
  canPromoteToBankTransaction: false | 'candidate_only';
  canConfirm: false;
  canAffectLedger: false;
}

export interface UnmatchedExceptionPoolItem {
  queueType: 'unmatched_exception';
  transactionId: number;
  bankName: string;
  direction: FinanceEvidenceDirection;
  amount: string;
  balanceAfter: string;
  accountTail: string | null;
  companyId: number;
  accountRegistryId: number | null;
  reconcileStatus: string;
  unmatchedReason: string[];
  possibleMatchHints: string[];
  suggestedNextAction: string;
  canConfirm: false;
  canAffectLedger: false;
  createdAt: string | null;
  updatedAt: string | null;
}

export type FinanceEvidenceQueueItem =
  | PendingAccountEvidenceQueueItem
  | UnmatchedExceptionPoolItem;

export interface FinanceEvidenceQueueSafetyFlags {
  readOnly: true;
  canConfirm: false;
  canAffectLedger: false;
  writesBankSmsTransaction: false;
  createsConfirmedReconciliation: false;
  mutatesPaymentRecords: false;
  mutatesWorkOrders: false;
  writesVirtualLedger: false;
  redacted: true;
}
