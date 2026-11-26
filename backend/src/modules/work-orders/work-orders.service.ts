import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Not, Raw } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import {
  canViewFullContact,
  maskPhoneNumber,
} from '../../common/utils/contact-permission.util';
import { normalizeMoney } from '../../common/utils/decimal.util';
import { BIZ_SEQUENCE_CONFIG } from '../../shared/constants/biz-sequence.constant';
import { getPagination, PaginationQuery } from '../../common/utils/pagination.util';
import { OperationLogAction } from '../../shared/enums/operation-log-action.enum';
import { WorkOrderStatus } from '../../shared/enums/work-order-status.enum';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { SequenceService } from '../sequence/sequence.service';
import { User } from '../users/entities/user.entity';
import { AccessWorkOrderCustomerContactDto } from './dto/access-work-order-customer-contact.dto';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { CreateTemporaryServiceOrderDraftDto } from './dto/create-temporary-service-order-draft.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { TemporaryServiceOrder } from './entities/temporary-service-order.entity';
import { WorkOrder } from './entities/work-order.entity';
import { assertWorkOrderNotUnquoted, INTAKE_PREFIX, isWorkOrderUnquoted } from './work-order-intake.policy';

@Injectable()
export class WorkOrdersService {
  constructor(
    @InjectRepository(WorkOrder)
    private readonly workOrderRepository: Repository<WorkOrder>,
    @InjectRepository(TemporaryServiceOrder)
    private readonly temporaryServiceOrderRepository: Repository<TemporaryServiceOrder>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly sequenceService: SequenceService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async create(dto: CreateWorkOrderDto, currentUser: CurrentUser) {
    if (dto.remark?.includes(INTAKE_PREFIX)) throw new BadRequestException('接车资料只能通过待报价登记入口创建');
    await this.ensureResponsibleUserExists(dto.responsibleUserId);

    const saved = await this.dataSource.transaction(async (manager) => {
      const workOrderNo = await this.sequenceService.generateBizNo(
        BIZ_SEQUENCE_CONFIG.WORK_ORDER.bizType,
        BIZ_SEQUENCE_CONFIG.WORK_ORDER.prefix,
        manager,
      );
      const repo = manager.getRepository(WorkOrder);
      const workOrder = repo.create({
        workOrderNo,
        title: dto.title,
        customerName: dto.customerName,
        customerMobile: dto.customerMobile ?? null,
        amountDue: normalizeMoney(dto.amountDue),
        amountReceived: '0.00',
        status: WorkOrderStatus.PENDING_PAYMENT,
        responsibleUserId: dto.responsibleUserId ?? null,
        remark: dto.remark ?? null,
        createdBy: currentUser.id,
      });

      const saved = await repo.save(workOrder);

      await this.operationLogsService.create(
        {
          module: 'work_order',
          targetId: saved.id,
          action: OperationLogAction.CREATE_WORK_ORDER,
          operatorId: currentUser.id,
          detail: `创建工单 ${saved.workOrderNo}`,
        },
        manager,
      );

      return saved;
    });

    return this.toReadView(saved, currentUser);
  }

  async createTemporaryServiceOrderDraft(
    dto: CreateTemporaryServiceOrderDraftDto,
    currentUser: CurrentUser,
  ) {
    await this.ensureResponsibleUserExists(dto.responsibleEmployeeId);
    if (dto.relatedWorkOrderId) {
      assertWorkOrderNotUnquoted(await this.findOneEntity(dto.relatedWorkOrderId));
    }

    const serviceAmount = normalizeMoney(dto.serviceAmount);
    if (Number(serviceAmount) <= 0) {
      throw new BadRequestException('临时服务单金额必须大于 0');
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(TemporaryServiceOrder);
      const temporaryServiceNo = await this.sequenceService.generateBizNo(
        BIZ_SEQUENCE_CONFIG.TEMPORARY_SERVICE_ORDER.bizType,
        BIZ_SEQUENCE_CONFIG.TEMPORARY_SERVICE_ORDER.prefix,
        manager,
      );
      const customerPhone = dto.customerPhone?.trim() || null;
      const missingCustomerPhone = !customerPhone;
      const temporaryServiceOrder = repo.create({
        temporaryServiceNo,
        companyId: dto.companyId,
        serviceType: dto.serviceType,
        serviceTitle: dto.serviceTitle.trim(),
        serviceAmount,
        customerId: dto.customerId?.trim() || null,
        customerPhone,
        customerName: dto.customerName?.trim() || null,
        temporaryCustomerFlag: dto.temporaryCustomerFlag ?? missingCustomerPhone,
        missingCustomerPhoneFlag: missingCustomerPhone,
        vehiclePlate: dto.vehiclePlate?.trim() || null,
        sourceChannel: dto.sourceChannel ?? null,
        responsibleEmployeeId: dto.responsibleEmployeeId ?? null,
        relatedWorkOrderId: dto.relatedWorkOrderId ?? null,
        collectionOrderId: dto.collectionOrderId ?? null,
        status: 'waiting_payment',
        paymentStatus: 'payment_pending',
        evidenceStatus: missingCustomerPhone
          ? 'missing_customer_phone'
          : 'missing_payment_receipt',
        createdBy: currentUser.id,
        completedAt: null,
        evidencePayload: dto.evidencePayload ?? null,
        remark: dto.remark?.trim() || null,
      });

      return repo.save(temporaryServiceOrder);
    });
  }

  async findAll(query: PaginationQuery, currentUser: CurrentUser) {
    const { skip, take, page, pageSize } = getPagination(query);
    const [list, total] = await this.workOrderRepository.findAndCount({
      // Intake has its own current store-scoped admission; legacy list must not expose it.
      where: { status: Not(WorkOrderStatus.DRAFT),
        remark: Raw((column) => `(${column} IS NULL OR ${column} NOT LIKE :intakeMarker)`,
          { intakeMarker: `${INTAKE_PREFIX}%` }) },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });

    return {
      list: list.map((workOrder) => this.toReadView(workOrder, currentUser)),
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: number, currentUser: CurrentUser) {
    const workOrder = await this.findOneEntity(id);
    return this.toReadView(workOrder, currentUser);
  }

  async accessCustomerContact(
    id: number,
    dto: AccessWorkOrderCustomerContactDto,
    currentUser: CurrentUser,
  ) {
    const workOrder = await this.findOneEntity(id);
    if (!this.canAccessFullCustomerContact(workOrder, currentUser)) {
      throw new ForbiddenException(
        '[work_order_customer_contact_forbidden] 当前用户无权查看完整客户手机号',
      );
    }

    const audit = await this.operationLogsService.create({
      module: 'work_order',
      targetId: workOrder.id,
      action: OperationLogAction.VIEW_WORK_ORDER_CUSTOMER_CONTACT,
      operatorId: currentUser.id,
      detail: `查看工单客户联系方式 ${workOrder.workOrderNo}`,
      detailJson: {
        decision: 'allowed',
        reasonCode: dto.reasonCode,
        sourceInterface: 'POST /work-orders/:id/customer-contact-access',
        fullPhonePersistedInAudit: false,
      },
    });

    return {
      workOrderId: workOrder.id,
      workOrderNo: workOrder.workOrderNo,
      customerMobile: workOrder.customerMobile,
      accessAudit: {
        auditId: audit.id,
        reasonCode: dto.reasonCode,
        sourceInterface: 'POST /work-orders/:id/customer-contact-access',
      },
    };
  }

  private async findOneEntity(id: number) {
    const workOrder = await this.workOrderRepository.findOne({ where: { id } });

    if (!workOrder) {
      throw new NotFoundException('工单不存在');
    }

    if (isWorkOrderUnquoted(workOrder)) throw new NotFoundException('请通过有权限的待报价接车入口查看');

    return workOrder;
  }

  async update(id: number, dto: UpdateWorkOrderDto, currentUser: CurrentUser) {
    if (dto.remark?.includes(INTAKE_PREFIX)) throw new BadRequestException('接车资料不能由普通修改入口覆盖');
    const existing = await this.findOneEntity(id);
    assertWorkOrderNotUnquoted(existing);
    await this.ensureResponsibleUserExists(dto.responsibleUserId);

    const saved = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(WorkOrder);
      const merged = repo.merge(existing, {
        ...dto,
        amountDue: dto.amountDue ? normalizeMoney(dto.amountDue) : existing.amountDue,
      });
      const saved = await repo.save(merged);

      await this.operationLogsService.create(
        {
          module: 'work_order',
          targetId: saved.id,
          action: OperationLogAction.UPDATE_WORK_ORDER,
          operatorId: currentUser.id,
          detail: `修改工单 ${saved.workOrderNo}`,
        },
        manager,
      );

      return saved;
    });

    return this.toReadView(saved, currentUser);
  }

  private toReadView(workOrder: WorkOrder, currentUser: CurrentUser) {
    const unquoted = isWorkOrderUnquoted(workOrder);
    return {
      id: workOrder.id,
      workOrderNo: workOrder.workOrderNo,
      title: workOrder.title,
      customerName: workOrder.customerName,
      customerMobile: maskPhoneNumber(workOrder.customerMobile),
      customerMobileAccess: {
        representation: workOrder.customerMobile ? ('masked' as const) : ('not_provided' as const),
        fullReadAvailable: this.canAccessFullCustomerContact(workOrder, currentUser),
        fullReadRequiresExplicitAuditedRequest: true,
      },
      amountDue: unquoted ? null : workOrder.amountDue,
      amountReceived: unquoted ? null : workOrder.amountReceived,
      materialCostTotal: unquoted ? null : workOrder.materialCostTotal,
      pricingStatus: unquoted ? 'unquoted' : 'recorded',
      financialEffect: !unquoted,
      status: workOrder.status,
      responsibleUserId: workOrder.responsibleUserId,
      remark: unquoted ? '接车登记，待核实 VIN、里程、保养项目和报价；非免费或已结算记录' : workOrder.remark,
      createdBy: workOrder.createdBy,
      createdAt: workOrder.createdAt,
      updatedAt: workOrder.updatedAt,
    };
  }

  private canAccessFullCustomerContact(workOrder: WorkOrder, currentUser: CurrentUser) {
    if (currentUser.identitySource !== 'trusted_proxy') {
      return false;
    }

    if (canViewFullContact(currentUser)) {
      return true;
    }

    return (
      currentUser.roleCodes.includes('customer_service') &&
      workOrder.responsibleUserId === currentUser.id
    );
  }

  private async ensureResponsibleUserExists(userId?: number) {
    if (!userId) {
      return;
    }

    const user = await this.userRepository.findOne({
      where: {
        id: userId,
        status: 1,
      },
    });

    if (!user) {
      throw new NotFoundException('负责人不存在或已禁用');
    }
  }
}
