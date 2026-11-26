import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { BIZ_SEQUENCE_CONFIG } from '../../shared/constants/biz-sequence.constant';
import { getPagination, PaginationQuery } from '../../common/utils/pagination.util';
import { OperationLogAction } from '../../shared/enums/operation-log-action.enum';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { ApprovalRequest } from '../approval-requests/entities/approval-request.entity';
import { SequenceService } from '../sequence/sequence.service';
import { CreatePayoutRecordDto } from './dto/create-payout-record.dto';
import { PayoutRecord } from './entities/payout-record.entity';
import { BusinessFoundationService } from '../business-foundation/business-foundation.service';
import { guardMaterialPayout, validateMaterialPayoutRequest } from './material-payable.guard';

@Injectable()
export class PayoutRecordsService {
  constructor(
    @InjectRepository(PayoutRecord)
    private readonly payoutRecordRepository: Repository<PayoutRecord>,
    @InjectRepository(ApprovalRequest)
    private readonly approvalRequestRepository: Repository<ApprovalRequest>,
    private readonly dataSource: DataSource,
    private readonly sequenceService: SequenceService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async create(dto: CreatePayoutRecordDto, currentUser: CurrentUser) {
    const fingerprint = validateMaterialPayoutRequest(dto, currentUser);
    return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      const guarded = await guardMaterialPayout(
        manager, new BusinessFoundationService(this.dataSource, this.operationLogsService),
        dto, currentUser, fingerprint,
      );
      if (guarded.replay) return guarded.replay;
      const payoutNo = await this.sequenceService.generateBizNo(
        BIZ_SEQUENCE_CONFIG.PAYOUT_RECORD.bizType,
        BIZ_SEQUENCE_CONFIG.PAYOUT_RECORD.prefix,
        manager,
      );
      const repo = manager.getRepository(PayoutRecord);

      const payoutRecord = repo.create({
        payoutNo,
        approvalRequestId: dto.approvalRequestId,
        amount: guarded.amount,
        materialInstallmentId: dto.materialInstallmentId,
        requestIdempotencyKey: dto.requestIdempotencyKey,
        requestFingerprint: fingerprint,
        payeeName: dto.payeeName,
        paymentMethod: dto.paymentMethod,
        paidAt: new Date(dto.paidAt),
        createdBy: currentUser.id,
      });

      const saved = await repo.save(payoutRecord);

      await this.operationLogsService.create(
        {
          module: 'payout_record',
          targetId: saved.id,
          action: OperationLogAction.CREATE_PAYOUT_RECORD,
          operatorId: currentUser.id,
          detail: `登记已核实材料分期 ${dto.materialInstallmentId} 的付款证据 ${saved.payoutNo}；未执行银行付款`,
        },
        manager,
      );

      return saved;
    }).catch((error: unknown) => {
      const code = (error as { driverError?: { code?: string }; code?: string })?.driverError?.code ??
        (error as { code?: string })?.code;
      if (['ER_DUP_ENTRY', 'ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(code ?? '')) {
        throw new ConflictException('[material_payable_write_conflict] 并发登记未完成；保持原幂等键核对后重试，不会执行银行付款');
      }
      throw error;
    });
  }

  async findAll(query: PaginationQuery) {
    const { skip, take, page, pageSize } = getPagination(query);
    const [list, total] = await this.payoutRecordRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take,
    });

    return { list, total, page, pageSize };
  }

  async findOne(id: number) {
    const record = await this.payoutRecordRepository.findOne({ where: { id } });

    if (!record) {
      throw new NotFoundException('付款记录不存在');
    }

    return record;
  }
}
