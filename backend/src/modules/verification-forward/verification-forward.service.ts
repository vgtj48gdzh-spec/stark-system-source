import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { buildPaginationResult, getPagination } from '../../common/utils/pagination.util';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { OperationLogAction } from '../../shared/enums/operation-log-action.enum';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { SmsMessageClassification } from '../message-hub/entities/sms-message-classification.entity';
import { SmsMessageRaw } from '../message-hub/entities/sms-message-raw.entity';
import { QueryVerificationCodeDispatchDto } from './dto/query-verification-code-dispatch.dto';
import { VerificationCodeDispatchLog } from './entities/verification-code-dispatch-log.entity';

const FULL_TEXT_ROLES = ['owner', 'super_admin'] as const;
const ALLOWED_ROLES = [
  'admin',
  'finance',
  'super_admin',
  'owner',
  'finance_manager',
  'finance_operator',
  'auditor',
] as const;

@Injectable()
export class VerificationForwardService {
  constructor(
    @InjectRepository(VerificationCodeDispatchLog)
    private readonly verificationCodeDispatchLogRepository: Repository<VerificationCodeDispatchLog>,
    @InjectRepository(SmsMessageRaw)
    private readonly smsMessageRawRepository: Repository<SmsMessageRaw>,
    @InjectRepository(SmsMessageClassification)
    private readonly smsMessageClassificationRepository: Repository<SmsMessageClassification>,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async dispatchVerificationCode(raw: SmsMessageRaw, classification: SmsMessageClassification) {
    if (classification.classifyType !== 'verification_code') {
      return [];
    }

    const code = String(classification.parsedJson?.code ?? '').trim();
    if (!code) {
      return [];
    }

    const existing = await this.verificationCodeDispatchLogRepository.find({
      where: {
        rawSmsId: raw.id,
      },
    });
    if (existing.length) {
      return existing;
    }

    const dispatchedAt = new Date();
    const entries = [
      this.verificationCodeDispatchLogRepository.create({
        rawSmsId: raw.id,
        code,
        channel: 'ai_alert',
        receiver: 'owner',
        dispatchedAt,
        status: 'success',
        responsePayload: {
          summary: `${raw.sender} 验证码提醒`,
          sender: raw.sender,
          body: raw.body,
          code,
          receivedAt: raw.receivedAt.toISOString(),
          immutableCode: true,
        },
      }),
      this.verificationCodeDispatchLogRepository.create({
        rawSmsId: raw.id,
        code,
        channel: 'email',
        receiver: 'owner@stark-system.local',
        dispatchedAt,
        status: 'success',
        responsePayload: {
          subject: `${raw.sender} 验证码提醒`,
          sender: raw.sender,
          body: raw.body,
          code,
          receivedAt: raw.receivedAt.toISOString(),
          immutableCode: true,
        },
      }),
    ];

    const savedLogs = await this.verificationCodeDispatchLogRepository.save(entries);

    await this.operationLogsService.create({
      module: 'verification_forward',
      targetId: raw.id,
      action: OperationLogAction.DISPATCH_VERIFICATION_CODE,
      operatorId: 1,
      detail: `验证码短信 #${raw.id} 已转发给 owner`,
      detailJson: {
        code,
        channels: savedLogs.map((item) => item.channel),
      },
    });

    return savedLogs;
  }

  async findAll(query: QueryVerificationCodeDispatchDto, currentUser: CurrentUser) {
    this.assertAllowed(currentUser);

    const { skip, take } = getPagination(query);
    const qb = this.verificationCodeDispatchLogRepository
      .createQueryBuilder('dispatch')
      .leftJoinAndSelect('dispatch.rawSms', 'rawSms')
      .leftJoin(
        SmsMessageClassification,
        'classification',
        'classification.raw_sms_id = dispatch.raw_sms_id',
      );

    if (query.sender?.trim()) {
      qb.andWhere('rawSms.sender LIKE :sender', { sender: `%${query.sender.trim()}%` });
    }
    if (query.channel) {
      qb.andWhere('dispatch.channel = :channel', { channel: query.channel });
    }
    if (query.status?.trim()) {
      qb.andWhere('dispatch.status = :status', { status: query.status.trim() });
    }
    if (query.dateFrom) {
      qb.andWhere('dispatch.dispatched_at >= :dateFrom', { dateFrom: new Date(query.dateFrom) });
    }
    if (query.dateTo) {
      qb.andWhere('dispatch.dispatched_at <= :dateTo', { dateTo: new Date(query.dateTo) });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy('dispatch.dispatchedAt', 'DESC')
      .addOrderBy('dispatch.id', 'DESC')
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(
      query,
      list.map((item) => this.buildDispatchView(item, currentUser)),
      total,
    );
  }

  async findOne(id: number, currentUser: CurrentUser) {
    this.assertAllowed(currentUser);

    const record = await this.verificationCodeDispatchLogRepository.findOne({
      where: { id },
      relations: {
        rawSms: true,
      },
    });

    if (!record) {
      return null;
    }

    const classification = await this.smsMessageClassificationRepository.findOne({
      where: {
        rawSmsId: record.rawSmsId,
      },
    });

    return {
      ...this.buildDispatchView(record, currentUser),
      classification: classification?.parsedJson ?? null,
    };
  }

  private buildDispatchView(record: VerificationCodeDispatchLog, currentUser: CurrentUser) {
    const canViewFullText = currentUser.roleCodes.some((roleCode) =>
      FULL_TEXT_ROLES.includes(roleCode as (typeof FULL_TEXT_ROLES)[number]),
    );

    const body = record.rawSms?.body ?? '';
    return {
      id: record.id,
      rawSmsId: record.rawSmsId,
      sender: record.rawSms?.sender ?? '',
      body: canViewFullText ? body : this.maskText(body),
      code: canViewFullText ? record.code : this.maskCode(record.code),
      receivedAt: record.rawSms?.receivedAt?.toISOString?.() ?? null,
      dispatchedAt: record.dispatchedAt.toISOString(),
      channel: record.channel,
      receiver: record.receiver,
      status: record.status,
      responsePayload: canViewFullText ? record.responsePayload : null,
    };
  }

  private assertAllowed(currentUser: CurrentUser) {
    if (
      currentUser.roleCodes.some((roleCode) =>
        ALLOWED_ROLES.includes(roleCode as (typeof ALLOWED_ROLES)[number]),
      )
    ) {
      return;
    }

    throw new ForbiddenException('当前角色无权查看验证码转发中心');
  }

  private maskCode(code: string) {
    if (code.length <= 2) {
      return '**';
    }

    return `${'*'.repeat(Math.max(0, code.length - 2))}${code.slice(-2)}`;
  }

  private maskText(value: string) {
    if (!value) {
      return '';
    }

    if (value.length <= 12) {
      return `${value.slice(0, 2)}******`;
    }

    return `${value.slice(0, 6)}******${value.slice(-4)}`;
  }
}
