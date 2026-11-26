import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { FinanceBankSmsService } from '../finance-bank-sms/finance-bank-sms.service';
import { FinanceSafetyService } from '../finance-safety/finance-safety.service';
import { MobileSmsEvent } from '../mobile-bridge/entities/mobile-sms-event.entity';
import { MobileDiagnosticsService } from '../mobile-diagnostics/mobile-diagnostics.service';
import { VerificationForwardService } from '../verification-forward/verification-forward.service';
import { SmsMessageClassification } from './entities/sms-message-classification.entity';
import { SmsMessageRaw } from './entities/sms-message-raw.entity';
import { classifySmsMessage } from './utils/sms-classifier.util';
import {
  buildMobileSmsDedupeFingerprint,
  normalizeMobileSmsSender,
} from '../mobile-bridge/utils/mobile-sms-dedupe.util';
import { isSameBankSmsPromotionRawEvidence } from '../finance-bank-sms/utils/bank-sms-promotion-policy.util';
import {
  buildSecurityCredentialBlockedMetadata,
  isOtpOrVerificationSms,
  maskSmsSender,
  OTP_OR_VERIFICATION_BLOCK_REASON,
  REDACTED_SECURITY_CREDENTIAL_BODY,
} from './utils/sms-security.util';

export interface IngestSmsMessageInput {
  deviceId: string;
  simSlot?: number | null;
  sender: string;
  body: string;
  receivedAt: Date;
  deviceSmsId?: string | null;
  dedupeFingerprint?: string | null;
  ingestSource: 'live_broadcast' | 'inbox_sync' | 'manual_import';
}

export interface IngestSmsMessageOptions {
  manager?: EntityManager;
  mobileEvent?: MobileSmsEvent | null;
  eventCreatedNow?: boolean;
}

export interface ProcessInboundSmsOptions extends IngestSmsMessageOptions {
  recordDiagnostics?: boolean;
}

@Injectable()
export class MessageHubService {
  constructor(
    @InjectRepository(SmsMessageRaw)
    private readonly smsMessageRawRepository: Repository<SmsMessageRaw>,
    @InjectRepository(SmsMessageClassification)
    private readonly smsMessageClassificationRepository: Repository<SmsMessageClassification>,
    private readonly verificationForwardService: VerificationForwardService,
    private readonly financeBankSmsService: FinanceBankSmsService,
    private readonly mobileDiagnosticsService: MobileDiagnosticsService,
    private readonly financeSafetyService: FinanceSafetyService,
  ) {}

  async ingestSmsMessage(
    input: IngestSmsMessageInput,
    options: IngestSmsMessageOptions = {},
  ) {
    const rawRepository = options.manager
      ? options.manager.getRepository(SmsMessageRaw)
      : this.smsMessageRawRepository;
    const classificationRepository = options.manager
      ? options.manager.getRepository(SmsMessageClassification)
      : this.smsMessageClassificationRepository;
    const mobileSmsEventId = options.mobileEvent?.id ?? null;
    // live_broadcast and inbox_sync must converge here so raw SMS dedupe uses one backend upsert path.
    const deviceId = input.deviceId.trim();
    const sender = normalizeMobileSmsSender(input.sender);
    const body = input.body.trim();
    const receivedAt = input.receivedAt;
    const deviceSmsId = input.deviceSmsId?.trim() || null;
    const dedupeFingerprint =
      input.dedupeFingerprint?.trim() ||
      buildMobileSmsDedupeFingerprint({
        deviceId,
        deviceSmsId,
        simSlot: input.simSlot ?? null,
        senderAddress: sender,
        messageBody: body,
        receivedAtDevice: receivedAt,
      });

    if (isOtpOrVerificationSms(body)) {
      const safeSender = maskSmsSender(sender);
      const blockedMetadata = buildSecurityCredentialBlockedMetadata({
        sender,
        body,
        deviceId,
        receivedAt,
      });
      let existingRaw = await rawRepository.findOne({
        where: {
          deviceId,
          dedupeFingerprint,
        },
      });

      if (existingRaw) {
        const existingClassification = await classificationRepository.findOne({
          where: {
            rawSmsId: existingRaw.id,
          },
        });

        return {
          raw: existingRaw,
          classification: existingClassification,
          deduplicated: true,
          rawCreatedNow: false,
          classificationCreatedNow: false,
        };
      }

      const raw = rawRepository.create({
        deviceId,
        simSlot: input.simSlot ?? null,
        sender: safeSender,
        body: REDACTED_SECURITY_CREDENTIAL_BODY,
        receivedAt,
        deviceSmsId: null,
        dedupeFingerprint,
        mobileSmsEventId,
        ingestSource: input.ingestSource,
        uploadStatus: 'blocked',
        classifyStatus: 'blocked_security_credential',
      });
      existingRaw = await rawRepository.save(raw);
      const classification = await classificationRepository.save(
        classificationRepository.create({
          rawSmsId: existingRaw.id,
          classifyType: 'verification_code',
          confidence: '1.00',
          parsedJson: blockedMetadata,
          parserPolicyVersion: null,
          evidenceFingerprint: null,
        }),
      );

      return {
        raw: existingRaw,
        classification,
        deduplicated: false,
        rawCreatedNow: true,
        classificationCreatedNow: true,
      };
    }

    let existingRaw =
      mobileSmsEventId
        ? await rawRepository.findOne({
            where: {
              mobileSmsEventId,
            },
          })
        : null;

    if (!existingRaw && deviceSmsId) {
      existingRaw = await rawRepository.findOne({
            where: {
              deviceId,
              deviceSmsId,
            },
          });
    }

    if (!existingRaw && dedupeFingerprint) {
      existingRaw = await rawRepository.findOne({
        where: {
          deviceId,
          dedupeFingerprint,
        },
      });
    }

    if (!existingRaw) {
      existingRaw = await rawRepository.findOne({
        where: {
          deviceId,
          simSlot: input.simSlot ?? IsNull(),
          sender,
          body,
          receivedAt,
        } as any,
      });
    }

    if (existingRaw) {
      if (existingRaw.promotionAdmissionKey) {
        this.assertImmutablePromotionRawRetry(existingRaw, {
          mobileSmsEventId,
          simSlot: input.simSlot ?? null,
          sender,
          body,
          receivedAt,
          deviceSmsId,
          dedupeFingerprint,
        });
      }
      let shouldPersistExistingRaw = false;
      if (!existingRaw.promotionAdmissionKey && !existingRaw.deviceSmsId && deviceSmsId) {
        existingRaw.deviceSmsId = deviceSmsId;
        shouldPersistExistingRaw = true;
      }
      if (
        !existingRaw.promotionAdmissionKey &&
        !existingRaw.dedupeFingerprint &&
        dedupeFingerprint
      ) {
        existingRaw.dedupeFingerprint = dedupeFingerprint;
        shouldPersistExistingRaw = true;
      }
      if (shouldPersistExistingRaw) {
        await rawRepository.save(existingRaw);
      }

      const existingClassification = await classificationRepository.findOne({
        where: {
          rawSmsId: existingRaw.id,
        },
      });

      return {
        raw: existingRaw,
        classification: existingClassification,
        deduplicated: true,
        rawCreatedNow: false,
        classificationCreatedNow: false,
      };
    }

    const raw = rawRepository.create({
      deviceId,
      simSlot: input.simSlot ?? null,
      sender,
      body,
      receivedAt,
      deviceSmsId,
      dedupeFingerprint,
      mobileSmsEventId,
      ingestSource: input.ingestSource,
      uploadStatus: 'stored',
      classifyStatus: 'pending',
    });
    const savedRaw = await rawRepository.save(raw);

    const classified = classifySmsMessage({
      sender,
      body,
      receivedAt,
    });

    const classification = classificationRepository.create({
      rawSmsId: savedRaw.id,
      classifyType: classified.classifyType,
      confidence: classified.confidence,
      parsedJson: classified.parsedJson,
      parserPolicyVersion: classified.parserPolicyVersion,
      evidenceFingerprint: null,
    });
    const savedClassification = await classificationRepository.save(classification);

    savedRaw.classifyStatus =
      classified.classifyType === 'other' ? 'classified_other' : `classified_${classified.classifyType}`;
    await rawRepository.save(savedRaw);

    return {
      raw: savedRaw,
      classification: savedClassification,
      deduplicated: false,
      rawCreatedNow: true,
      classificationCreatedNow: true,
    };
  }

  async processInboundSms(
    input: IngestSmsMessageInput,
    options: ProcessInboundSmsOptions = {},
  ) {
    const hubResult = await this.ingestSmsMessage(input, options);
    const classification = hubResult.classification;

    const verificationDispatches =
      classification?.classifyType === 'verification_code' &&
      !hubResult.deduplicated &&
      !this.isSecurityCredentialBlockedClassification(classification)
        ? await this.verificationForwardService.dispatchVerificationCode(
            hubResult.raw,
            classification,
          )
        : [];

    const promotionWindow = this.financeSafetyService.getBankSmsPromotionWindow();
    const bankSmsPromotionEnabled = promotionWindow.enabled;
    const bankSmsPromotionSkipped =
      classification?.classifyType === 'bank_transaction' && !bankSmsPromotionEnabled;
    const bankSmsTransaction =
      classification?.classifyType === 'bank_transaction'
        ? await this.financeBankSmsService.syncClassifiedBankSms(
            hubResult.raw,
            classification,
            {
              manager: options.manager,
              mobileEvent: options.mobileEvent ?? null,
              eventCreatedNow: options.eventCreatedNow ?? false,
              rawCreatedNow: hubResult.rawCreatedNow,
              classificationCreatedNow: hubResult.classificationCreatedNow,
              deduplicated: hubResult.deduplicated,
              ingestSource: input.ingestSource,
              promotionWindow,
            },
          )
        : null;

    if (options?.recordDiagnostics && input.ingestSource !== 'manual_import') {
      await this.mobileDiagnosticsService.recordSmsIngestResult({
        deviceId: input.deviceId,
        ingestSource: input.ingestSource,
        result: hubResult.deduplicated ? 'duplicate' : 'stored',
        receivedAt: input.receivedAt,
      });
    }

    return {
      ...hubResult,
      verificationDispatches,
      bankSmsTransaction,
      downstreamSummary: {
        verificationDispatchCount: verificationDispatches.length,
        verificationChannels: verificationDispatches.map((item) => item.channel),
        bankSmsTransactionId: bankSmsTransaction?.id ?? null,
        bankSmsPromotionEnabled,
        bankSmsPromotionSkipped,
        bankSmsReconcileStatus: bankSmsTransaction?.reconcileStatus ?? null,
      },
    };
  }

  async importRawMessage(
    dto: {
      sender: string;
      body: string;
      receivedAt: Date;
      source?: 'manual_import';
    },
    currentUser: CurrentUser,
  ) {
    if (!currentUser.roleCodes.includes('owner') && !currentUser.roleCodes.includes('super_admin')) {
      throw new ForbiddenException('Only owner and super_admin can import raw SMS manually.');
    }

    return this.processInboundSms(
      {
        deviceId: 'manual-import',
        simSlot: null,
        sender: dto.sender.trim(),
        body: dto.body,
        receivedAt: dto.receivedAt,
        ingestSource: 'manual_import',
      },
      {
        recordDiagnostics: false,
      },
    );
  }

  async findRecentRawMessages(deviceId?: string, take = 20) {
    const rows = await this.smsMessageRawRepository.find({
      where: deviceId?.trim() ? { deviceId: deviceId.trim() } : undefined,
      order: {
        receivedAt: 'DESC',
        id: 'DESC',
      },
      take,
    });

    return rows.map((row) => ({
      id: row.id,
      deviceId: row.deviceId,
      simSlot: row.simSlot,
      sender: maskSmsSender(row.sender),
      body: null,
      bodyRedacted: Boolean(row.body),
      rawBodyReturned: false,
      receivedAt: row.receivedAt,
      deviceSmsId: row.deviceSmsId,
      ingestSource: row.ingestSource,
      uploadStatus: row.uploadStatus,
      classifyStatus: row.classifyStatus,
      createdAt: row.createdAt,
    }));
  }

  private assertImmutablePromotionRawRetry(
    existingRaw: SmsMessageRaw,
    incoming: {
      mobileSmsEventId: number | null;
      simSlot: number | null;
      sender: string;
      body: string;
      receivedAt: Date;
      deviceSmsId: string | null;
      dedupeFingerprint: string;
    },
  ) {
    if (!isSameBankSmsPromotionRawEvidence(existingRaw, incoming)) {
      throw new ConflictException({
        code: 'promotion_evidence_conflict',
        message: 'Stored bank SMS promotion evidence conflicts with this retry; no fields were changed.',
      });
    }
  }

  private isSecurityCredentialBlockedClassification(classification: SmsMessageClassification) {
    return classification.parsedJson?.reason === OTP_OR_VERIFICATION_BLOCK_REASON;
  }
}
