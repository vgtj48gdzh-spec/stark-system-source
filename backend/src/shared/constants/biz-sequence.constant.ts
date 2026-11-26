export const BIZ_SEQUENCE_CONFIG = {
  WORK_ORDER: {
    bizType: 'work_order',
    prefix: 'WO',
  },
  PAYMENT_RECORD: {
    bizType: 'payment_record',
    prefix: 'PAY',
  },
  FINANCE_COLLECTION_ORDER: {
    bizType: 'finance_collection_order',
    prefix: 'FCO',
  },
  FINANCE_PAYMENT_REQUEST: {
    bizType: 'finance_payment_request',
    prefix: 'FPR',
  },
  TEMPORARY_SERVICE_ORDER: {
    bizType: 'temporary_service_order',
    prefix: 'TSO',
  },
  APPROVAL_REQUEST: {
    bizType: 'approval_request',
    prefix: 'APR',
  },
  APPROVAL_REQUEST_DRAFT: {
    bizType: 'approval_request_draft',
    prefix: 'APD',
  },
  PAYOUT_RECORD: {
    bizType: 'payout_record',
    prefix: 'PO',
  },
  WAREHOUSE: {
    bizType: 'warehouse',
    prefix: 'WH',
  },
  SUPPLIER: {
    bizType: 'supplier',
    prefix: 'SUP',
  },
  MATERIAL: {
    bizType: 'material',
    prefix: 'MAT',
  },
  INVENTORY_TRANSACTION: {
    bizType: 'inventory_transaction',
    prefix: 'INV',
  },
  MATERIAL_PREPARATION: {
    bizType: 'material_preparation',
    prefix: 'PRE',
  },
} as const;

export type BizSequenceType =
  (typeof BIZ_SEQUENCE_CONFIG)[keyof typeof BIZ_SEQUENCE_CONFIG]['bizType'];

export type BizSequencePrefix =
  (typeof BIZ_SEQUENCE_CONFIG)[keyof typeof BIZ_SEQUENCE_CONFIG]['prefix'];
