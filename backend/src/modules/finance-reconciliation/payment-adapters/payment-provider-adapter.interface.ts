import { FinanceCollectionOrder } from '../entities/finance-collection-order.entity';
import {
  FinancePaymentRequest,
  type FinancePaymentRequestProvider,
} from '../entities/finance-payment-request.entity';

export interface PaymentProviderCreatePaymentRequestInput {
  paymentRequest: FinancePaymentRequest;
  collectionOrder: FinanceCollectionOrder;
  providerRequestId?: string;
  requestPayload?: Record<string, unknown>;
}

export interface PaymentProviderCreatePaymentRequestResult {
  provider: FinancePaymentRequestProvider;
  providerRequestId: string;
  providerStatus: 'qr_generated' | 'waiting_payment';
  qrUrl: string;
  paymentUrl: string;
  channelPrepayId?: string | null;
  responsePayload: Record<string, unknown>;
}

export interface PaymentProviderCallbackVerificationInput {
  payload: Record<string, unknown>;
  signature?: string | null;
  headers?: Record<string, string | undefined>;
}

export interface PaymentProviderParsedCallback {
  provider: FinancePaymentRequestProvider;
  paymentRequestNo?: string | null;
  idempotencyKey?: string | null;
  channelTradeNo?: string | null;
  channelPrepayId?: string | null;
  amount: string;
  paidAt?: string | null;
  payerPhone?: string | null;
  callbackPayload: Record<string, unknown>;
}

export interface PaymentProviderAdapter {
  getProviderCode(): FinancePaymentRequestProvider;

  createPaymentRequest(
    input: PaymentProviderCreatePaymentRequestInput,
  ): Promise<PaymentProviderCreatePaymentRequestResult>;

  parseCallback(payload: Record<string, unknown>): PaymentProviderParsedCallback;

  verifyCallbackSignature(input: PaymentProviderCallbackVerificationInput): boolean;
}
