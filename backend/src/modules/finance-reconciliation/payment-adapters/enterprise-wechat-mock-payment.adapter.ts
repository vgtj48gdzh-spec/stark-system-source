import { BadRequestException, Injectable } from '@nestjs/common';
import {
  PaymentProviderAdapter,
  type PaymentProviderCallbackVerificationInput,
  type PaymentProviderCreatePaymentRequestInput,
  type PaymentProviderCreatePaymentRequestResult,
  type PaymentProviderParsedCallback,
} from './payment-provider-adapter.interface';

function readString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length ? normalized : null;
}

function normalizeMockAmount(value: unknown) {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) {
    throw new BadRequestException('Mock callback amount is invalid.');
  }

  return numericValue.toFixed(2);
}

function readPayloadObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

@Injectable()
export class EnterpriseWechatMockPaymentAdapter implements PaymentProviderAdapter {
  getProviderCode() {
    return 'enterprise_wechat_mock' as const;
  }

  async createPaymentRequest(
    input: PaymentProviderCreatePaymentRequestInput,
  ): Promise<PaymentProviderCreatePaymentRequestResult> {
    const paymentRequest = input.paymentRequest;
    const providerRequestId =
      readString(input.providerRequestId) ??
      `MOCK_PROVIDER_${paymentRequest.paymentRequestNo}`;
    const channelPrepayId = `MOCK_PREPAY_${paymentRequest.paymentRequestNo}`;
    const qrUrl = `mock://enterprise-wechat/qr/${paymentRequest.paymentRequestNo}`;
    const paymentUrl = `mock://enterprise-wechat/pay/${paymentRequest.paymentRequestNo}`;
    const generatedAt = new Date().toISOString();

    return {
      provider: this.getProviderCode(),
      providerRequestId,
      providerStatus: 'waiting_payment',
      qrUrl,
      paymentUrl,
      channelPrepayId,
      responsePayload: {
        adapter: this.getProviderCode(),
        providerRequestId,
        providerStatus: 'waiting_payment',
        qrUrl,
        paymentUrl,
        channelPrepayId,
        collectionOrderId: input.collectionOrder.id,
        collectionNo: input.collectionOrder.collectionNo,
        paymentRequestId: paymentRequest.id,
        paymentRequestNo: paymentRequest.paymentRequestNo,
        amount: normalizeMockAmount(paymentRequest.amount),
        generatedAt,
        requestPayload: input.requestPayload ?? null,
      },
    };
  }

  parseCallback(payload: Record<string, unknown>): PaymentProviderParsedCallback {
    const paymentRequestNo = readString(payload.paymentRequestNo);
    const amount = normalizeMockAmount(payload.amount);
    const callbackPayload = {
      adapter: this.getProviderCode(),
      parsedAt: new Date().toISOString(),
      ...payload,
    };

    return {
      provider: this.getProviderCode(),
      paymentRequestNo,
      idempotencyKey: readString(payload.idempotencyKey),
      channelTradeNo: readString(payload.channelTradeNo),
      channelPrepayId: readString(payload.channelPrepayId),
      amount,
      paidAt: readString(payload.paidAt),
      payerPhone: readString(payload.payerPhone),
      callbackPayload,
    };
  }

  verifyCallbackSignature(input: PaymentProviderCallbackVerificationInput) {
    const payload = readPayloadObject(input.payload);
    const signature =
      readString(input.signature) ??
      readString(input.headers?.['x-mock-signature']) ??
      readString(input.headers?.['X-Mock-Signature']) ??
      readString(payload.signature);

    return ['valid', 'mock_valid_signature', 'SELF_CHECK_VALID_SIGNATURE'].includes(
      signature ?? '',
    );
  }
}
