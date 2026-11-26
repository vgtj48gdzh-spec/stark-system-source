import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { CustomerIdentificationBinding } from '../performance/entities/customer-identification-binding.entity';
import { Employee } from '../performance/entities/employee.entity';
import { User } from '../users/entities/user.entity';
import {
  CreateBusinessCompanyRefDto,
  CreateBusinessScopeGrantDto,
  CreateBusinessSectorDto,
  CreateBusinessStoreDto,
  CreateCompanySectorAssignmentDto,
  CreateCustomerMasterDto,
  CreateCustomerOrganizationRelationshipDto,
  CreateStoreSectorAssignmentDto,
  QueryBusinessCustomersDto,
  UpdateBusinessScopeGrantDto,
} from './dto/business-foundation.dto';
import {
  BusinessCompanyRef,
  BusinessScopeGrant,
  BusinessSector,
  BusinessStore,
  CompanyRegistryAnchor,
  CompanySectorAssignment,
  CustomerMasterRecord,
  CustomerOrganizationRelationship,
  StoreSectorAssignment,
} from './entities/business-foundation.entities';

export interface BusinessResourceScope {
  companyRef: string;
  businessSectorRef: string;
  storeRef: string;
  customerRef: string;
}

export interface ResolvedBusinessScope extends BusinessResourceScope {
  companyDisplaySnapshot: string;
  businessSectorDisplaySnapshot: string;
  storeDisplaySnapshot: string;
  customerDisplaySnapshot: string;
  customerMobileMasked: string | null;
  scopeSnapshotVersion: Record<string, number>;
}

export interface BusinessAccessReadOptions {
  /**
   * Use current locking reads for the complete business-scope authority graph:
   * employee binding, company+anchor, sector, company assignment, store, store
   * assignment, customer, customer relationship and grants. This is reserved
   * for high-risk writes that must serialize with authority revocation.
   */
  lockAuthorityRows?: boolean;
}

export interface ResolvedOrganizationScope {
  company: BusinessCompanyRef;
  sector: BusinessSector;
  store: BusinessStore;
  companySector: CompanySectorAssignment;
  storeSector: StoreSectorAssignment;
}

@Injectable()
export class BusinessFoundationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async createCompanyRef(dto: CreateBusinessCompanyRefDto, currentUser: CurrentUser) {
    return this.dataSource.transaction(async (manager) => {
      const anchor = await manager.getRepository(CompanyRegistryAnchor).findOne({
        where: { id: dto.companyRegistryId },
        lock: { mode: 'pessimistic_read' },
      });
      if (!anchor || anchor.status !== 'active' || anchor.reviewStatus !== 'approved') {
        throw new BadRequestException('[company_anchor_not_ready] 公司锚点不存在、未审核或已停用');
      }
      this.assertDateRange(dto.validFrom, dto.validUntil);
      const repo = manager.getRepository(BusinessCompanyRef);
      if (await repo.findOne({ where: { companyRegistryId: dto.companyRegistryId } })) {
        throw new ConflictException('该 company_registry 记录已有稳定公司引用');
      }
      const record = await repo.save(
        repo.create({
          companyRef: this.createOpaqueRef('cmp'),
          companyRegistryId: anchor.id,
          displayNameSnapshot: anchor.companyShortName?.trim() || anchor.companyName.trim(),
          status: 'active',
          validFrom: new Date(dto.validFrom),
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          evidenceRef: dto.evidenceRef.trim(),
          version: 1,
          createdBy: currentUser.id,
          reviewedBy: currentUser.id,
        }),
      );
      await this.audit('business_company_ref', record.id, 'create', currentUser, {
        companyRef: record.companyRef,
        companyRegistryId: record.companyRegistryId,
      }, manager);
      return record;
    });
  }

  async createSector(dto: CreateBusinessSectorDto, currentUser: CurrentUser) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(BusinessSector);
      const code = dto.code.trim().toLowerCase();
      if (await repo.findOne({ where: { code } })) {
        throw new ConflictException('业务板块编码已存在');
      }
      const record = await repo.save(
        repo.create({
          businessSectorRef: this.createOpaqueRef('sec'),
          code,
          name: dto.name.trim(),
          status: 'active',
          version: 1,
          createdBy: currentUser.id,
        }),
      );
      await this.audit('business_sector', record.id, 'create', currentUser, {
        businessSectorRef: record.businessSectorRef,
        code: record.code,
      }, manager);
      return record;
    });
  }

  async assignCompanySector(
    dto: CreateCompanySectorAssignmentDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      this.assertDateRange(dto.validFrom, dto.validUntil);
      await this.loadActiveCompany(dto.companyRef, manager);
      await this.loadActiveSector(dto.businessSectorRef, manager);
      const repo = manager.getRepository(CompanySectorAssignment);
      if (await repo.findOne({ where: {
        companyRef: dto.companyRef,
        businessSectorRef: dto.businessSectorRef,
      } })) {
        throw new ConflictException('公司—业务板块关系已存在');
      }
      const record = await repo.save(
        repo.create({
          companyRef: dto.companyRef,
          businessSectorRef: dto.businessSectorRef,
          status: 'active',
          validFrom: new Date(dto.validFrom),
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          authorizationSource: dto.authorizationSource.trim(),
          reviewedBy: currentUser.id,
          version: 1,
          createdBy: currentUser.id,
        }),
      );
      await this.audit('company_sector_assignment', record.id, 'create', currentUser, {
        companyRef: record.companyRef,
        businessSectorRef: record.businessSectorRef,
      }, manager);
      return record;
    });
  }

  async createStore(dto: CreateBusinessStoreDto, currentUser: CurrentUser) {
    return this.dataSource.transaction(async (manager) => {
      this.assertDateRange(dto.validFrom, dto.validUntil);
      await this.loadActiveCompany(dto.companyRef, manager);
      const repo = manager.getRepository(BusinessStore);
      const code = dto.code.trim().toLowerCase();
      if (await repo.findOne({ where: { companyRef: dto.companyRef, code } })) {
        throw new ConflictException('该公司下门店编码已存在');
      }
      const record = await repo.save(
        repo.create({
          storeRef: this.createOpaqueRef('sto'),
          companyRef: dto.companyRef,
          code,
          name: dto.name.trim(),
          status: 'active',
          validFrom: new Date(dto.validFrom),
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          version: 1,
          createdBy: currentUser.id,
        }),
      );
      await this.audit('business_store', record.id, 'create', currentUser, {
        companyRef: record.companyRef,
        storeRef: record.storeRef,
        code: record.code,
      }, manager);
      return record;
    });
  }

  async assignStoreSector(dto: CreateStoreSectorAssignmentDto, currentUser: CurrentUser) {
    return this.dataSource.transaction(async (manager) => {
      this.assertDateRange(dto.validFrom, dto.validUntil);
      const [store, sector] = await Promise.all([
        this.loadActiveStore(dto.storeRef, manager),
        this.loadActiveSector(dto.businessSectorRef, manager),
      ]);
      const companySector = await manager.getRepository(CompanySectorAssignment).findOne({
        where: {
          companyRef: store.companyRef,
          businessSectorRef: sector.businessSectorRef,
          status: 'active',
        },
      });
      if (!companySector || !this.isEffective(companySector)) {
        throw new BadRequestException('[company_sector_inactive] 公司未在有效期内获准经营该板块');
      }
      const repo = manager.getRepository(StoreSectorAssignment);
      if (await repo.findOne({ where: {
        storeRef: store.storeRef,
        businessSectorRef: sector.businessSectorRef,
      } })) {
        throw new ConflictException('门店—业务板块关系已存在');
      }
      const record = await repo.save(
        repo.create({
          storeRef: store.storeRef,
          businessSectorRef: sector.businessSectorRef,
          status: 'active',
          validFrom: new Date(dto.validFrom),
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          authorizationSource: dto.authorizationSource.trim(),
          reviewedBy: currentUser.id,
          version: 1,
          createdBy: currentUser.id,
        }),
      );
      await this.audit('store_sector_assignment', record.id, 'create', currentUser, {
        storeRef: record.storeRef,
        businessSectorRef: record.businessSectorRef,
      }, manager);
      return record;
    });
  }

  async createCustomer(dto: CreateCustomerMasterDto, currentUser: CurrentUser) {
    return this.dataSource.transaction(async (manager) => {
      if (dto.mobileMasked) this.assertMaskedContact(dto.mobileMasked);
      if (dto.legacyIdentificationBindingId) {
        const binding = await manager.getRepository(CustomerIdentificationBinding).findOne({
          where: { id: dto.legacyIdentificationBindingId },
        });
        if (!binding) throw new NotFoundException('客户识别绑定不存在');
        if (
          binding.bindingStatus !== 'manually_bound' ||
          !binding.boundBy ||
          !binding.boundAt ||
          !binding.matchedCustomerId?.trim()
        ) {
          throw new BadRequestException('[customer_binding_not_ready] 待处理或冲突绑定不能进入统一客户主档');
        }
      }
      const repo = manager.getRepository(CustomerMasterRecord);
      if (
        dto.legacyIdentificationBindingId &&
        (await repo.findOne({ where: {
          legacyIdentificationBindingId: dto.legacyIdentificationBindingId,
        } }))
      ) {
        throw new ConflictException('该客户识别绑定已关联统一客户主档');
      }
      const record = await repo.save(
        repo.create({
          customerRef: this.createOpaqueRef('cus'),
          displayName: dto.displayName.trim(),
          mobileMasked: dto.mobileMasked?.trim() || null,
          legacyIdentificationBindingId: dto.legacyIdentificationBindingId ?? null,
          status: 'active',
          version: 1,
          createdBy: currentUser.id,
          reviewedBy: currentUser.id,
        }),
      );
      await this.audit('customer_master', record.id, 'create', currentUser, {
        customerRef: record.customerRef,
        legacyIdentificationBindingId: record.legacyIdentificationBindingId,
      }, manager);
      return record;
    });
  }

  async createCustomerRelationship(
    dto: CreateCustomerOrganizationRelationshipDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      this.assertDateRange(dto.validFrom, dto.validUntil);
      const [customer, company] = await Promise.all([
        this.loadActiveCustomer(dto.customerRef, manager),
        this.loadActiveCompany(dto.companyRef, manager),
      ]);
      if (dto.storeRef) {
        const store = await this.loadActiveStore(dto.storeRef, manager);
        if (store.companyRef !== company.companyRef) {
          throw new BadRequestException('[store_company_mismatch] 门店不属于所选公司');
        }
      }
      const repo = manager.getRepository(CustomerOrganizationRelationship);
      const existing = await repo.findOne({
        where: {
          customerRef: customer.customerRef,
          companyRef: company.companyRef,
          storeRef: dto.storeRef ?? IsNull(),
        },
      });
      if (existing) throw new ConflictException('客户—组织业务关系已存在');
      const record = await repo.save(
        repo.create({
          customerRef: customer.customerRef,
          companyRef: company.companyRef,
          storeRef: dto.storeRef ?? null,
          status: 'active',
          validFrom: new Date(dto.validFrom),
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          relationshipSource: dto.relationshipSource.trim(),
          version: 1,
          createdBy: currentUser.id,
        }),
      );
      await this.audit('customer_organization_relationship', record.id, 'create', currentUser, {
        customerRef: record.customerRef,
        companyRef: record.companyRef,
        storeRef: record.storeRef,
      }, manager);
      return record;
    });
  }

  async createScopeGrant(dto: CreateBusinessScopeGrantDto, currentUser: CurrentUser) {
    return this.dataSource.transaction(async (manager) => {
      this.assertDateRange(dto.validFrom, dto.validUntil);
      // Registration precedes sector/customer authority. The only sector-less store grant
      // is this single non-financial permission; '*' and mixed grants retain the old rule.
      const intakeOnlyStoreGrant = Boolean(dto.storeRef && !dto.businessSectorRef && !dto.customerRef
        && dto.permissions.length === 1 && dto.permissions[0] === 'intake.register');
      if (dto.storeRef && !dto.businessSectorRef && !intakeOnlyStoreGrant) {
        throw new BadRequestException('门店作用域必须同时指定业务板块');
      }
      const [user, employee] = await Promise.all([
        manager.getRepository(User).findOne({ where: { id: dto.userId, status: 1 } }),
        manager.getRepository(Employee).findOne({ where: { id: dto.employeeId, status: 1 } }),
      ]);
      if (!user || !employee || employee.linkedUserId !== user.id) {
        throw new BadRequestException('[actor_binding_invalid] 授权主体必须是正式绑定的有效用户和员工');
      }
      if (intakeOnlyStoreGrant) {
        const company = await this.loadActiveCompany(dto.companyRef, manager, { lockAuthorityRows: true });
        const store = await this.loadActiveStore(dto.storeRef!, manager, { lockAuthorityRows: true });
        if (store.companyRef !== company.companyRef) throw new BadRequestException('接车门店不属于该公司');
      } else if (dto.storeRef && dto.businessSectorRef) {
        const organization = await this.resolveOrganization({
          companyRef: dto.companyRef,
          businessSectorRef: dto.businessSectorRef,
          storeRef: dto.storeRef,
        }, manager);
        if (dto.customerRef) {
          await this.resolveCustomerRelationship(
            dto.customerRef,
            organization.company.companyRef,
            organization.store.storeRef,
            manager,
          );
        }
      } else {
        await this.loadActiveCompany(dto.companyRef, manager);
        if (dto.businessSectorRef) {
          await this.loadEffectiveCompanySector(dto.companyRef, dto.businessSectorRef, manager);
        }
        if (dto.customerRef) {
          await this.resolveCustomerRelationship(dto.customerRef, dto.companyRef, null, manager);
        }
      }

      const repo = manager.getRepository(BusinessScopeGrant);
      const record = await repo.save(
        repo.create({
          userId: user.id,
          employeeId: employee.id,
          companyRef: dto.companyRef,
          businessSectorRef: dto.businessSectorRef ?? null,
          storeRef: dto.storeRef ?? null,
          customerRef: dto.customerRef ?? null,
          effect: dto.effect,
          permissions: [...new Set(dto.permissions)],
          status: 'active',
          validFrom: new Date(dto.validFrom),
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          authorizationSource: dto.authorizationSource.trim(),
          reviewedBy: currentUser.id,
          remark: dto.remark?.trim() || null,
          version: 1,
          createdBy: currentUser.id,
        }),
      );
      await this.audit('business_scope_grant', record.id, 'create', currentUser, {
        subjectUserId: record.userId,
        subjectEmployeeId: record.employeeId,
        companyRef: record.companyRef,
        businessSectorRef: record.businessSectorRef,
        storeRef: record.storeRef,
        effect: record.effect,
        permissions: record.permissions,
      }, manager);
      return record;
    });
  }

  async updateScopeGrant(
    id: number,
    dto: UpdateBusinessScopeGrantDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(BusinessScopeGrant);
      const grant = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!grant) throw new NotFoundException('共享业务作用域授权不存在');
      if (grant.version !== dto.expectedVersion) {
        throw new ConflictException('共享业务作用域授权版本冲突，请刷新后重试');
      }
      grant.status = dto.status;
      grant.version += 1;
      const saved = await repo.save(grant);
      await this.audit('business_scope_grant', saved.id, dto.status, currentUser, {
        reason: dto.reason.trim(),
        version: saved.version,
      }, manager);
      return saved;
    });
  }

  async resolveScope(
    scope: BusinessResourceScope,
    manager: EntityManager = this.dataSource.manager,
    options: BusinessAccessReadOptions = {},
  ): Promise<ResolvedBusinessScope> {
    const organization = await this.resolveOrganization(scope, manager, options);
    const { customer, relationship } = await this.resolveCustomerRelationship(
      scope.customerRef,
      scope.companyRef,
      scope.storeRef,
      manager,
      options,
    );
    return {
      companyRef: organization.company.companyRef,
      businessSectorRef: organization.sector.businessSectorRef,
      storeRef: organization.store.storeRef,
      customerRef: customer.customerRef,
      companyDisplaySnapshot: organization.company.displayNameSnapshot,
      businessSectorDisplaySnapshot: organization.sector.name,
      storeDisplaySnapshot: organization.store.name,
      customerDisplaySnapshot: customer.displayName,
      customerMobileMasked: customer.mobileMasked,
      scopeSnapshotVersion: {
        company: organization.company.version,
        businessSector: organization.sector.version,
        companySector: organization.companySector.version,
        store: organization.store.version,
        storeSector: organization.storeSector.version,
        customer: customer.version,
        customerRelationship: relationship.version,
      },
    };
  }

  async assertAccess(
    currentUser: CurrentUser,
    scope: BusinessResourceScope,
    permission: string,
    manager: EntityManager = this.dataSource.manager,
    options: BusinessAccessReadOptions = {},
  ) {
    const employee = await manager.getRepository(Employee).findOne({
      where: { linkedUserId: currentUser.id, status: 1 },
      ...(options.lockAuthorityRows
        ? { lock: { mode: 'pessimistic_read' as const } }
        : {}),
    });
    if (!employee) {
      throw new ForbiddenException('[actor_binding_missing] 当前用户没有有效员工绑定');
    }
    return this.assertSubjectAccess(
      currentUser.id,
      employee.id,
      scope,
      permission,
      manager,
      options,
    );
  }

  /**
   * Authorize a company-wide action when the resource has no trustworthy
   * sector/store/customer scope. A narrow grant cannot be widened into a
   * company-wide finance permission, and any effective deny for the requested
   * permission fails closed because the aggregate resource may include it.
   */
  /** Intake before customer/VIN resolution grants no repair, cost or customer authority. */
  async assertStoreIntakeAccess(currentUser: CurrentUser, storeRef: string, manager: EntityManager) {
    if (currentUser.identitySource !== 'trusted_proxy' || !manager.queryRunner?.isTransactionActive) {
      throw new ForbiddenException('[intake_identity_required] 接车登记必须使用正式登录身份和活动事务');
    }
    const lock = { lock: { mode: 'pessimistic_read' as const } };
    const employees = await manager.getRepository(Employee).find({
      where: { linkedUserId: currentUser.id, status: 1 }, order: { id: 'ASC' }, take: 2, ...lock,
    });
    if (employees.length !== 1) throw new ForbiddenException('[actor_binding_missing] 当前用户没有唯一有效员工绑定');
    const employee = employees[0];
    const hint = await manager.getRepository(BusinessStore).findOne({ where: { storeRef } });
    if (!hint) throw new ForbiddenException('[intake_store_unavailable] 门店不存在或无权访问');
    const company = await this.loadActiveCompany(hint.companyRef, manager, { lockAuthorityRows: true });
    const store = await this.loadActiveStore(storeRef, manager, { lockAuthorityRows: true });
    if (store.companyRef !== company.companyRef) {
      throw new ForbiddenException('[intake_store_changed] 门店归属已变化，请重新核验');
    }
    const grants = await manager.getRepository(BusinessScopeGrant).find({
      where: { userId: currentUser.id, employeeId: employee.id, companyRef: company.companyRef, status: 'active' },
      order: { id: 'ASC' }, ...lock,
    });
    const relevant = grants.filter((g) => this.isEffective(g)
      && (!g.storeRef || g.storeRef === store.storeRef)
      && (g.permissions.includes('*') || g.permissions.includes('intake.register')));
    // Customer/sector are not resolved yet, so a narrow deny must not be ignored.
    if (relevant.some((g) => g.effect === 'deny') || !relevant.some((g) =>
      g.effect === 'allow' && !g.businessSectorRef && !g.customerRef)) {
      throw new ForbiddenException('[intake_scope_denied] 当前用户没有该门店的接车登记权限');
    }
    return { companyRef: company.companyRef, storeRef: store.storeRef, storeName: store.name,
      storeVersion: store.version, employeeId: employee.id };
  }

  /** Before a customer exists, a customer-specific allow cannot grant creation.
   * Any matching customer-specific deny wins: unresolved identity must not erase it.
   * Reuses the existing organization/employee/grant graph, not another RBAC system.
   */
  async assertFirstVisitAccess(currentUser: CurrentUser,
    scope: Pick<BusinessResourceScope, 'companyRef' | 'businessSectorRef' | 'storeRef'>,
    manager: EntityManager) {
    if (currentUser.identitySource !== 'trusted_proxy' || !manager.queryRunner?.isTransactionActive) {
      throw new ForbiddenException('[first_visit_identity_required] 需要正式身份和活动事务');
    }
    const lock = { lock: { mode: 'pessimistic_read' as const } };
    const employees = await manager.getRepository(Employee).find({
      where: { linkedUserId: currentUser.id, status: 1 }, order: { id: 'ASC' }, take: 2, ...lock,
    });
    if (employees.length !== 1) throw new ForbiddenException('[first_visit_employee_invalid] 需要唯一有效员工绑定');
    const organization = await this.resolveOrganization(scope, manager, { lockAuthorityRows: true });
    const grants = await manager.getRepository(BusinessScopeGrant).find({
      where: { userId: currentUser.id, employeeId: employees[0].id, companyRef: scope.companyRef, status: 'active' },
      order: { id: 'ASC' }, ...lock,
    });
    for (const permission of ['repair.read', 'scope.resolve', 'intake.manage', 'vehicle.manage']) {
      const matches = grants.filter(g => this.isEffective(g) && this.grantMatchesOrganization(g, scope)
        && (g.permissions.includes('*') || g.permissions.includes(permission)));
      if (matches.some(g => g.effect === 'deny')
        || !matches.some(g => g.effect === 'allow' && g.customerRef === null)) {
        throw new ForbiddenException('[first_visit_scope_denied] 缺少该门店的新客户核实权限');
      }
    }
    return { organization, employeeId: employees[0].id, grants };
  }

  async assertFirstVisitStoreRead(currentUser: CurrentUser, companyRef: string, storeRef: string, manager: EntityManager) {
    const assignments = await manager.getRepository(StoreSectorAssignment).find({
      where: { storeRef, status: 'active' }, order: { id: 'ASC' }, take: 100,
      lock: { mode: 'pessimistic_read' },
    });
    for (const row of assignments) {
      try {
        await this.assertFirstVisitAccess(currentUser, { companyRef, storeRef, businessSectorRef: row.businessSectorRef }, manager);
        return;
      } catch (error) {
        if (!(error instanceof ForbiddenException)) throw error;
      }
    }
    throw new ForbiddenException('[first_visit_scope_denied] 无权核实该门店接车资料');
  }

  async assertCompanyAccess(
    currentUser: CurrentUser,
    companyRegistryId: number,
    permission: string,
    manager: EntityManager = this.dataSource.manager,
    options: BusinessAccessReadOptions = {},
  ) {
    if (!Number.isInteger(companyRegistryId) || companyRegistryId <= 0) {
      throw new ForbiddenException('[business_company_scope_invalid] 公司作用域不可用');
    }

    const authorityLock = this.authorityLock(options);
    const employee = await manager.getRepository(Employee).findOne({
      where: { linkedUserId: currentUser.id, status: 1 },
      ...authorityLock,
    });
    if (!employee) {
      throw new ForbiddenException('[actor_binding_missing] 当前用户没有有效员工绑定');
    }

    const company = await manager.getRepository(BusinessCompanyRef).findOne({
      where: { companyRegistryId, status: 'active' },
      ...authorityLock,
    });
    if (!company || !this.isEffective(company)) {
      throw new ForbiddenException('[business_company_scope_invalid] 公司引用不存在或已失效');
    }

    const anchor = await manager.getRepository(CompanyRegistryAnchor).findOne({
      where: { id: company.companyRegistryId },
      ...authorityLock,
    });
    if (!anchor || anchor.status !== 'active' || anchor.reviewStatus !== 'approved') {
      throw new ForbiddenException('[business_company_scope_invalid] 公司锚点未审核或已停用');
    }

    const grants = await manager.getRepository(BusinessScopeGrant).find({
      where: {
        userId: currentUser.id,
        employeeId: employee.id,
        companyRef: company.companyRef,
        status: 'active',
      },
      order: { id: 'ASC' },
      ...authorityLock,
    });
    const permissionMatches = (grant: BusinessScopeGrant) =>
      grant.permissions.includes('*') || grant.permissions.includes(permission);
    const effective = grants.filter((grant) => this.isEffective(grant));
    if (effective.some((grant) => grant.effect === 'deny' && permissionMatches(grant))) {
      throw new ForbiddenException('[business_company_scope_denied] 该公司财务操作被显式拒绝');
    }
    const companyWideAllows = effective.filter(
      (grant) =>
        grant.effect === 'allow' &&
        grant.businessSectorRef === null &&
        grant.storeRef === null &&
        grant.customerRef === null &&
        permissionMatches(grant),
    );
    if (!companyWideAllows.length) {
      throw new ForbiddenException('[business_company_scope_missing] 当前用户没有公司级财务权限');
    }

    return {
      linkedEmployeeId: employee.id,
      companyRef: company.companyRef,
      companyVersion: company.version,
      allowGrantIds: companyWideAllows.map((grant) => grant.id),
    };
  }

  async assertEmployeeAccess(
    employeeId: number,
    scope: BusinessResourceScope,
    permission: string,
    manager: EntityManager = this.dataSource.manager,
  ) {
    const employee = await manager.getRepository(Employee).findOne({
      where: { id: employeeId, status: 1 },
    });
    if (!employee?.linkedUserId) {
      throw new ForbiddenException('[actor_binding_missing] 被指派员工没有有效用户绑定');
    }
    const user = await manager.getRepository(User).findOne({
      where: { id: employee.linkedUserId, status: 1 },
    });
    if (!user) throw new ForbiddenException('[actor_binding_missing] 被指派员工用户已禁用');
    return this.assertSubjectAccess(user.id, employee.id, scope, permission, manager);
  }

  private async assertSubjectAccess(
    userId: number,
    employeeId: number,
    scope: BusinessResourceScope,
    permission: string,
    manager: EntityManager,
    options: BusinessAccessReadOptions = {},
  ) {
    const resolved = await this.resolveScope(scope, manager, options);
    const grants = await manager.getRepository(BusinessScopeGrant).find({
      where: { userId, employeeId, companyRef: scope.companyRef, status: 'active' },
      order: { id: 'ASC' },
      ...(options.lockAuthorityRows
        ? { lock: { mode: 'pessimistic_read' as const } }
        : {}),
    });
    const matches = grants.filter((grant) =>
      this.isEffective(grant) && this.grantMatches(grant, scope, permission),
    );
    if (matches.some((grant) => grant.effect === 'deny')) {
      throw new ForbiddenException('[business_scope_denied] 该公司/板块/门店/客户资源被显式拒绝');
    }
    if (!matches.some((grant) => grant.effect === 'allow')) {
      throw new ForbiddenException('[business_scope_missing] 当前用户没有该业务资源权限');
    }
    return { linkedEmployeeId: employeeId, resolved };
  }

  async listAvailableScopes(currentUser: CurrentUser) {
    const employee = await this.dataSource.getRepository(Employee).findOne({
      where: { linkedUserId: currentUser.id, status: 1 },
    });
    if (!employee) throw new ForbiddenException('[actor_binding_missing] 当前用户没有有效员工绑定');
    const grants = await this.dataSource.getRepository(BusinessScopeGrant).find({
      where: { userId: currentUser.id, employeeId: employee.id, status: 'active' },
    });
    const effective = grants.filter(
      (grant) =>
        this.isEffective(grant) &&
        (grant.permissions.includes('*') || grant.permissions.includes('repair.read')),
    );
    const assignments = await this.dataSource.getRepository(StoreSectorAssignment).find({
      where: { status: 'active' },
      take: 1000,
    });
    const result: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();
    for (const assignment of assignments) {
      if (!this.isEffective(assignment)) continue;
      const store = await this.dataSource.getRepository(BusinessStore).findOne({
        where: { storeRef: assignment.storeRef, status: 'active' },
      });
      if (!store || !this.isEffective(store)) continue;
      const candidate = {
        companyRef: store.companyRef,
        businessSectorRef: assignment.businessSectorRef,
        storeRef: store.storeRef,
      };
      const matchingAllows = effective.filter(
        (grant) => grant.effect === 'allow' && this.grantMatchesOrganization(grant, candidate),
      );
      const matchingBroadDenies = effective.filter(
        (grant) =>
          grant.effect === 'deny' &&
          !grant.customerRef &&
          this.grantMatchesOrganization(grant, candidate),
      );
      if (!matchingAllows.length || matchingBroadDenies.length) continue;
      const key = `${candidate.companyRef}|${candidate.businessSectorRef}|${candidate.storeRef}`;
      if (seen.has(key)) continue;
      try {
        const org = await this.resolveOrganization(candidate);
        result.push({
          actorEmployeeId: employee.id,
          companyRef: org.company.companyRef,
          companyName: org.company.displayNameSnapshot,
          businessSectorRef: org.sector.businessSectorRef,
          businessSectorName: org.sector.name,
          storeRef: org.store.storeRef,
          storeName: org.store.name,
        });
        seen.add(key);
      } catch {
        // Stale grants are deliberately omitted instead of widening scope.
      }
    }
    return result;
  }

  async listSafeCustomers(query: QueryBusinessCustomersDto, currentUser: CurrentUser) {
    const limit = Math.min(query.limit ?? 50, 100);
    const relationships = await this.dataSource
      .getRepository(CustomerOrganizationRelationship)
      .createQueryBuilder('relationship')
      .where('relationship.company_ref = :companyRef', { companyRef: query.companyRef })
      .andWhere('relationship.status = :status', { status: 'active' })
      .andWhere('(relationship.store_ref IS NULL OR relationship.store_ref = :storeRef)', {
        storeRef: query.storeRef,
      })
      .orderBy('relationship.updated_at', 'DESC')
      .take(limit * 2)
      .getMany();
    const result: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();
    for (const relationship of relationships) {
      if (seen.has(relationship.customerRef) || !this.isEffective(relationship)) continue;
      const scope: BusinessResourceScope = {
        companyRef: query.companyRef,
        businessSectorRef: query.businessSectorRef,
        storeRef: query.storeRef,
        customerRef: relationship.customerRef,
      };
      try {
        const access = await this.assertAccess(currentUser, scope, 'repair.read');
        result.push({
          customerRef: access.resolved.customerRef,
          displayName: access.resolved.customerDisplaySnapshot,
          mobileMasked: access.resolved.customerMobileMasked,
        });
        seen.add(relationship.customerRef);
        if (result.length >= limit) break;
      } catch {
        // Keep cross-company enumeration fail-closed.
      }
    }
    return result;
  }

  private async resolveOrganization(
    scope: Pick<BusinessResourceScope, 'companyRef' | 'businessSectorRef' | 'storeRef'>,
    manager: EntityManager = this.dataSource.manager,
    options: BusinessAccessReadOptions = {},
  ): Promise<ResolvedOrganizationScope> {
    // Deliberately sequential. High-risk callers must take current locks in one
    // global order so a concurrent revocation cannot leave a mixed authority
    // snapshot and parallel callers do not invert lock order.
    const company = await this.loadActiveCompany(scope.companyRef, manager, options);
    const sector = await this.loadActiveSector(scope.businessSectorRef, manager, options);
    const store = await this.loadActiveStore(scope.storeRef, manager, options);
    if (store.companyRef !== company.companyRef) {
      throw new ForbiddenException('[business_scope_invalid] 门店与公司作用域不一致');
    }
    const companySector = await manager.getRepository(CompanySectorAssignment).findOne({
      where: {
        companyRef: company.companyRef,
        businessSectorRef: sector.businessSectorRef,
        status: 'active',
      },
      ...this.authorityLock(options),
    });
    if (!companySector || !this.isEffective(companySector)) {
      throw new ForbiddenException('[business_scope_invalid] 公司未在有效期内获准经营该板块');
    }
    const storeSector = await manager.getRepository(StoreSectorAssignment).findOne({
      where: {
        storeRef: store.storeRef,
        businessSectorRef: sector.businessSectorRef,
        status: 'active',
      },
      ...this.authorityLock(options),
    });
    if (!storeSector || !this.isEffective(storeSector)) {
      throw new ForbiddenException('[business_scope_invalid] 门店未在有效期内获准经营该板块');
    }
    return { company, sector, store, companySector, storeSector };
  }

  private async loadActiveCompany(
    companyRef: string,
    manager: EntityManager,
    options: BusinessAccessReadOptions = {},
  ) {
    const company = await manager.getRepository(BusinessCompanyRef).findOne({
      where: { companyRef, status: 'active' },
      ...this.authorityLock(options),
    });
    if (!company || !this.isEffective(company)) {
      throw new ForbiddenException('[business_scope_invalid] 公司引用不存在或已失效');
    }
    const anchor = await manager.getRepository(CompanyRegistryAnchor).findOne({
      where: { id: company.companyRegistryId },
      ...this.authorityLock(options),
    });
    if (!anchor || anchor.status !== 'active' || anchor.reviewStatus !== 'approved') {
      throw new ForbiddenException('[business_scope_invalid] 公司锚点未审核或已停用');
    }
    return company;
  }

  private async loadActiveSector(
    businessSectorRef: string,
    manager: EntityManager,
    options: BusinessAccessReadOptions = {},
  ) {
    const sector = await manager.getRepository(BusinessSector).findOne({
      where: { businessSectorRef, status: 'active' },
      ...this.authorityLock(options),
    });
    if (!sector) throw new ForbiddenException('[business_scope_invalid] 业务板块不存在或已停用');
    return sector;
  }

  private async loadActiveStore(
    storeRef: string,
    manager: EntityManager,
    options: BusinessAccessReadOptions = {},
  ) {
    const store = await manager.getRepository(BusinessStore).findOne({
      where: { storeRef, status: 'active' },
      ...this.authorityLock(options),
    });
    if (!store || !this.isEffective(store)) {
      throw new ForbiddenException('[business_scope_invalid] 门店不存在或已失效');
    }
    return store;
  }

  private async loadActiveCustomer(
    customerRef: string,
    manager: EntityManager,
    options: BusinessAccessReadOptions = {},
  ) {
    const customer = await manager.getRepository(CustomerMasterRecord).findOne({
      where: { customerRef, status: 'active' },
      ...this.authorityLock(options),
    });
    if (!customer) throw new ForbiddenException('[customer_scope_invalid] 客户主档不存在或不可用');
    return customer;
  }

  private async loadEffectiveCompanySector(
    companyRef: string,
    businessSectorRef: string,
    manager: EntityManager,
    options: BusinessAccessReadOptions = {},
  ) {
    const sector = await this.loadActiveSector(businessSectorRef, manager, options);
    const assignment = await manager.getRepository(CompanySectorAssignment).findOne({
      where: { companyRef, businessSectorRef, status: 'active' },
      ...this.authorityLock(options),
    });
    if (!sector || !assignment || !this.isEffective(assignment)) {
      throw new ForbiddenException('[business_scope_invalid] 公司未在有效期内获准经营该板块');
    }
    return assignment;
  }

  private async resolveCustomerRelationship(
    customerRef: string,
    companyRef: string,
    storeRef: string | null,
    manager: EntityManager,
    options: BusinessAccessReadOptions = {},
  ) {
    const customer = await this.loadActiveCustomer(customerRef, manager, options);
    const relationships = await manager.getRepository(CustomerOrganizationRelationship).find({
      where: storeRef
        ? [
            { customerRef, companyRef, storeRef: IsNull(), status: 'active' },
            { customerRef, companyRef, storeRef, status: 'active' },
          ]
        : { customerRef, companyRef, storeRef: IsNull(), status: 'active' },
      order: { id: 'ASC' },
      ...this.authorityLock(options),
    });
    const effectiveRelationships = relationships.filter((candidate) => this.isEffective(candidate));
    const relationship = storeRef
      ? effectiveRelationships.find((candidate) => candidate.storeRef === storeRef) ??
        effectiveRelationships.find((candidate) => candidate.storeRef === null)
      : effectiveRelationships.find((candidate) => candidate.storeRef === null);
    if (!relationship) {
      throw new ForbiddenException('[customer_scope_invalid] 客户与该公司/门店没有有效业务关系');
    }
    return { customer, relationship };
  }

  private authorityLock(options: BusinessAccessReadOptions) {
    return options.lockAuthorityRows
      ? { lock: { mode: 'pessimistic_read' as const } }
      : {};
  }

  private grantMatches(
    grant: BusinessScopeGrant,
    scope: BusinessResourceScope,
    permission: string,
  ) {
    return (
      (!grant.businessSectorRef || grant.businessSectorRef === scope.businessSectorRef) &&
      (!grant.storeRef || grant.storeRef === scope.storeRef) &&
      (!grant.customerRef || grant.customerRef === scope.customerRef) &&
      (grant.permissions.includes('*') || grant.permissions.includes(permission))
    );
  }

  private grantMatchesOrganization(
    grant: BusinessScopeGrant,
    scope: Pick<BusinessResourceScope, 'companyRef' | 'businessSectorRef' | 'storeRef'>,
  ) {
    return (
      grant.companyRef === scope.companyRef &&
      (!grant.businessSectorRef || grant.businessSectorRef === scope.businessSectorRef) &&
      (!grant.storeRef || grant.storeRef === scope.storeRef)
    );
  }

  private isEffective(record: { validFrom: Date; validUntil: Date | null }, at = new Date()) {
    return record.validFrom <= at && (!record.validUntil || record.validUntil >= at);
  }

  private assertDateRange(validFrom: string, validUntil?: string) {
    if (validUntil && new Date(validUntil) <= new Date(validFrom)) {
      throw new BadRequestException('失效时间必须晚于生效时间');
    }
  }

  private assertMaskedContact(value: string) {
    const compact = value.replace(/[\s-]/g, '');
    if (/^\+?\d{7,15}$/.test(compact) || /\d{7,}/.test(compact) || !/[＊*xX]/.test(value)) {
      throw new BadRequestException('客户联系方式只能保存明确脱敏值');
    }
  }

  private createOpaqueRef(prefix: string) {
    return `${prefix}_${randomUUID().replace(/-/g, '')}`;
  }

  private audit(
    module: string,
    targetId: number,
    action: string,
    currentUser: CurrentUser,
    detailJson: Record<string, unknown>,
    manager: EntityManager,
  ) {
    return this.operationLogsService.create(
      { module, targetId, action, operatorId: currentUser.id, detailJson },
      manager,
    );
  }
}
