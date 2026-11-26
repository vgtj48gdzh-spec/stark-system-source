import { ConflictException, NotFoundException } from '@nestjs/common';
import { EntityManager, QueryFailedError } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { normalizeMoney } from '../../common/utils/decimal.util';
import { BIZ_SEQUENCE_CONFIG } from '../../shared/constants/biz-sequence.constant';
import { ApprovalStatus } from '../../shared/enums/approval-status.enum';
import { ApprovalType } from '../../shared/enums/approval-type.enum';
import { OperationLogAction } from '../../shared/enums/operation-log-action.enum';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { SequenceService } from '../sequence/sequence.service';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { ApprovalLog } from './entities/approval-log.entity';
import { ApprovalRequest } from './entities/approval-request.entity';

export interface PendingApprovalRequestInput {
  relatedWorkOrderId: number;
  amount: string;
  reason: string;
  verificationCode?: string | null;
  requestIdempotencyKey?: string | null;
  requestFingerprint?: string | null;
}

interface CreatePendingApprovalRequestOptions {
  manager: EntityManager;
  input: PendingApprovalRequestInput;
  currentUser: CurrentUser;
  sequenceService: SequenceService;
  operationLogsService: OperationLogsService;
}

export interface PendingApprovalRequestCreationResult {
  request: ApprovalRequest;
  created: boolean;
}

/**
 * Creates the existing approval request, submitted log and operation log inside
 * the caller-owned transaction. Callers remain responsible for their own
 * evidence and authorization checks before invoking this function.
 */
export async function createPendingApprovalRequest({
  ...options
}: CreatePendingApprovalRequestOptions) {
  return (await createPendingApprovalRequestWithResult(options)).request;
}

export async function createPendingApprovalRequestWithResult({
  manager,
  input,
  currentUser,
  sequenceService,
  operationLogsService,
}: CreatePendingApprovalRequestOptions): Promise<PendingApprovalRequestCreationResult> {
  const workOrder = await manager.getRepository(WorkOrder).findOne({
    where: { id: input.relatedWorkOrderId },
  });

  if (!workOrder) {
    throw new NotFoundException('工单不存在');
  }

  const requestRepository = manager.getRepository(ApprovalRequest);
  const logRepository = manager.getRepository(ApprovalLog);
  const requestIdempotencyKey = input.requestIdempotencyKey?.trim() || null;
  const requestFingerprint = input.requestFingerprint?.trim() || null;
  if (Boolean(requestIdempotencyKey) !== Boolean(requestFingerprint)) {
    throw new ConflictException('审批业务绑定必须同时提供幂等键和请求指纹');
  }
  if (requestIdempotencyKey && requestFingerprint) {
    const existing = await requestRepository.findOne({
      where: { requestIdempotencyKey },
      lock: { mode: 'pessimistic_write' },
    });
    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint) {
        throw new ConflictException('审批业务绑定已用于不同请求');
      }
      return { request: existing, created: false };
    }
  }
  const approvalNo = await sequenceService.generateBizNo(
    BIZ_SEQUENCE_CONFIG.APPROVAL_REQUEST.bizType,
    BIZ_SEQUENCE_CONFIG.APPROVAL_REQUEST.prefix,
    manager,
  );
  const request = requestRepository.create({
    approvalNo,
    approvalType: ApprovalType.PAYOUT,
    relatedWorkOrderId: input.relatedWorkOrderId,
    applicantUserId: currentUser.id,
    amount: normalizeMoney(input.amount),
    reason: input.reason,
    requestIdempotencyKey,
    requestFingerprint,
    currentStatus: ApprovalStatus.PENDING,
    verificationCode: input.verificationCode ?? null,
  });
  let saved: ApprovalRequest;
  try {
    saved = await requestRepository.save(request);
  } catch (error) {
    if (!requestIdempotencyKey || !requestFingerprint || !isRequestIdempotencyDuplicate(error)) {
      throw error;
    }
    const existing = await requestRepository.findOne({ where: { requestIdempotencyKey } });
    if (!existing) throw error;
    if (existing.requestFingerprint !== requestFingerprint) {
      throw new ConflictException('审批业务绑定已用于不同请求');
    }
    return { request: existing, created: false };
  }

  await logRepository.save(
    logRepository.create({
      approvalRequestId: saved.id,
      actionBy: currentUser.id,
      actionType: 'submitted',
      actionRemark: input.reason,
    }),
  );

  await operationLogsService.create(
    {
      module: 'approval_request',
      targetId: saved.id,
      action: OperationLogAction.SUBMIT_APPROVAL,
      operatorId: currentUser.id,
      detail: `提交审批 ${saved.approvalNo}`,
    },
    manager,
  );

  return { request: saved, created: true };
}

function isRequestIdempotencyDuplicate(error: unknown) {
  const candidate = error as QueryFailedError & {
    driverError?: { code?: string; message?: string };
  };
  return (
    candidate?.driverError?.code === 'ER_DUP_ENTRY' &&
    /uq_approval_requests_request_idempotency_key|request_idempotency_key/i.test(
      candidate?.driverError?.message ?? '',
    )
  );
}
