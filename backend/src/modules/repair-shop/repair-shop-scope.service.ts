import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import {
  BusinessAccessReadOptions,
  BusinessFoundationService,
  BusinessResourceScope,
} from '../business-foundation/business-foundation.service';
import { RepairPermission } from './entities/repair-shop.entities';

export type RepairResourceScope = BusinessResourceScope;

@Injectable()
export class RepairShopScopeService {
  constructor(private readonly businessFoundationService: BusinessFoundationService) {}

  assertStoreIntakeAccess(currentUser: CurrentUser, storeRef: string, manager: EntityManager) {
    return this.businessFoundationService.assertStoreIntakeAccess(currentUser, storeRef, manager);
  }

  assertAccess(
    currentUser: CurrentUser,
    resource: RepairResourceScope,
    permission: RepairPermission,
    manager?: EntityManager,
    options: BusinessAccessReadOptions = {},
  ) {
    return this.businessFoundationService.assertAccess(
      currentUser,
      resource,
      permission,
      manager,
      options,
    );
  }

  assertFirstVisitAccess(actor: CurrentUser, scope: Omit<RepairResourceScope, 'customerRef'>, manager: EntityManager) {
    return this.businessFoundationService.assertFirstVisitAccess(actor, scope, manager);
  }

  assertFirstVisitStoreRead(actor: CurrentUser, companyRef: string, storeRef: string, manager: EntityManager) {
    return this.businessFoundationService.assertFirstVisitStoreRead(actor, companyRef, storeRef, manager);
  }

  async assertAssignedTechnicianOrSupervisor(
    currentUser: CurrentUser,
    resource: RepairResourceScope,
    technicianEmployeeId: number | null,
    manager?: EntityManager,
  ) {
    const access = await this.assertAccess(currentUser, resource, 'repair.execute', manager);
    if (!technicianEmployeeId || access.linkedEmployeeId === technicianEmployeeId) {
      return access;
    }
    await this.assertAccess(currentUser, resource, 'repair.supervise', manager);
    return access;
  }

  assertEmployeeAccess(
    employeeId: number,
    resource: RepairResourceScope,
    permission: RepairPermission,
    manager?: EntityManager,
  ) {
    return this.businessFoundationService.assertEmployeeAccess(
      employeeId,
      resource,
      permission,
      manager,
    );
  }
}
