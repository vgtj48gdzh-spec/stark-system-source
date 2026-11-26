import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { getAuthenticatedUser } from '../api/auth';
import { operationLogsAdmission, requiresOperationLogsIdentity } from '../utils/operation-logs-admission';
import {
  evaluateGov1FormalIdentityRoute,
  requiresGov1FormalIdentity,
} from '../utils/gov1-formal-identity-route';
import {
  hasAnyRole,
  resolveHomePath,
  setAuthenticatedUserIdentity,
  type RoleCode,
} from '../utils/permissions';

const AppLayout = () => import('../layout/AppLayout.vue');
const OwnerBankSmsReadonlyLayout = () =>
  import('../layout/OwnerBankSmsReadonlyLayout.vue');
const OwnerRepairReadonlyLayout = () =>
  import('../layout/OwnerRepairReadonlyLayout.vue');
const OwnerRepairAcceptanceLayout = () =>
  import('../layout/OwnerRepairAcceptanceLayout.vue');
const OWNER_BANK_SMS_READONLY_ENABLED = __OWNER_BANK_SMS_READONLY__;
const OWNER_REPAIR_READONLY_ENABLED = __OWNER_REPAIR_READONLY__;
const OWNER_REPAIR_ACCEPTANCE_ENABLED = __OWNER_REPAIR_ACCEPTANCE__;
const OWNER_BANK_SMS_PATH = '/finance/bank-sms';
const OWNER_REPAIR_WORK_ORDERS_PATH = '/work-orders';
let formalIdentityNavigationSequence = 0;

const standardRoutes: RouteRecordRaw[] = [
    {
      path: '/',
      component: AppLayout,
      redirect: () => resolveHomePath(),
      children: [
        {
          path: '/work-orders',
          component: () => import('../views/work-orders/ListView.vue'),
          meta: { roles: ['operator', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/work-orders/create',
          component: () => import('../views/work-orders/CreateView.vue'),
          meta: { roles: ['operator', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/work-orders/:id',
          component: () => import('../views/work-orders/DetailView.vue'),
          meta: { roles: ['operator', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/work-orders/:id/repair',
          component: () => import('../views/work-orders/RepairWorkspaceView.vue'),
          // Non-legacy roles see authority capture only; no legacy API permission is widened.
          meta: { roles: ['operator', 'admin', 'group_leader', 'business_owner', 'finance', 'founder', 'super_admin', 'owner'] satisfies RoleCode[] },
        },
        {
          path: '/payment-records',
          component: () => import('../views/payment-records/ListView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/payment-records/create',
          component: () => import('../views/payment-records/CreateView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/payment-records/:id',
          component: () => import('../views/payment-records/DetailView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/approval-requests',
          component: () => import('../views/approval-requests/ListView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/approval-requests/create',
          component: () => import('../views/approval-requests/CreateView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/approval-requests/:id',
          component: () => import('../views/approval-requests/DetailView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/payout-records',
          component: () => import('../views/payout-records/ListView.vue'),
          meta: { roles: ['admin'] satisfies RoleCode[] },
        },
        {
          path: '/payout-records/create',
          component: () => import('../views/payout-records/CreateView.vue'),
          meta: { roles: ['admin'] satisfies RoleCode[] },
        },
        {
          path: '/fund-truth-reconciliations',
          component: () => import('../views/fund-truth-reconciliations/ListView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/fund-truth-reconciliations/:primaryObjectType/:primaryObjectId',
          component: () => import('../views/fund-truth-reconciliations/DetailView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/mobile/sms-diagnostics',
          component: () => import('../views/mobile/MobileSmsDiagnosticsView.vue'),
          meta: {
            roles: [
              'admin',
              'finance',
              'super_admin',
              'owner',
              'finance_manager',
              'finance_operator',
              'auditor',
            ] satisfies RoleCode[],
          },
        },
        {
          path: '/security/verification-codes',
          component: () => import('../views/security/VerificationCodeCenterView.vue'),
          meta: {
            roles: [
              'admin',
              'finance',
              'super_admin',
              'owner',
              'finance_manager',
              'finance_operator',
              'auditor',
            ] satisfies RoleCode[],
          },
        },
        {
          path: '/finance/bank-accounts',
          component: () => import('../views/finance/BankAccountBindingView.vue'),
          meta: {
            roles: [
              'admin',
              'finance',
              'super_admin',
              'owner',
              'finance_manager',
              'finance_operator',
              'auditor',
            ] satisfies RoleCode[],
          },
        },
        {
          path: '/finance/bank-sms',
          component: () => import('../views/finance/BankSmsReconciliationView.vue'),
          meta: {
            roles: [
              'admin',
              'finance',
              'super_admin',
              'owner',
              'finance_manager',
              'finance_operator',
              'auditor',
            ] satisfies RoleCode[],
          },
        },
        {
          path: '/finance/virtual-amount-check',
          component: () => import('../views/finance/VirtualAmountCheckView.vue'),
          meta: {
            roles: [
              'admin',
              'finance',
              'super_admin',
              'owner',
              'finance_manager',
              'finance_operator',
              'auditor',
            ] satisfies RoleCode[],
          },
        },
        {
          path: '/finance/wechat-receipts',
          component: () => import('../views/finance/WechatPaymentReceiptView.vue'),
          meta: {
            roles: [
              'admin',
              'finance',
              'super_admin',
              'owner',
              'finance_manager',
              'finance_operator',
              'auditor',
            ] satisfies RoleCode[],
          },
        },
        {
          path: '/finance/wechat-settlement-batches',
          component: () => import('../views/finance/WechatSettlementBatchView.vue'),
          meta: {
            roles: [
              'admin',
              'finance',
              'super_admin',
              'owner',
              'finance_manager',
              'finance_operator',
              'auditor',
            ] satisfies RoleCode[],
          },
        },
        {
          path: '/warehouses',
          component: () => import('../views/warehouses/ListView.vue'),
          meta: { roles: ['admin'] satisfies RoleCode[] },
        },
        {
          path: '/warehouses/create',
          component: () => import('../views/warehouses/FormView.vue'),
          meta: { roles: ['admin'] satisfies RoleCode[] },
        },
        {
          path: '/warehouses/:id/edit',
          component: () => import('../views/warehouses/FormView.vue'),
          meta: { roles: ['admin'] satisfies RoleCode[] },
        },
        {
          path: '/suppliers',
          component: () => import('../views/suppliers/ListView.vue'),
          meta: { roles: ['admin'] satisfies RoleCode[] },
        },
        {
          path: '/suppliers/create',
          component: () => import('../views/suppliers/FormView.vue'),
          meta: { roles: ['admin'] satisfies RoleCode[] },
        },
        {
          path: '/suppliers/:id/edit',
          component: () => import('../views/suppliers/FormView.vue'),
          meta: { roles: ['admin'] satisfies RoleCode[] },
        },
        {
          path: '/materials',
          component: () => import('../views/materials/ListView.vue'),
          meta: { roles: ['admin'] satisfies RoleCode[] },
        },
        {
          path: '/materials/create',
          component: () => import('../views/materials/FormView.vue'),
          meta: { roles: ['admin'] satisfies RoleCode[] },
        },
        {
          path: '/materials/:id/edit',
          component: () => import('../views/materials/FormView.vue'),
          meta: { roles: ['admin'] satisfies RoleCode[] },
        },
        {
          path: '/material-stocks',
          component: () => import('../views/material-stocks/ListView.vue'),
          meta: { roles: ['operator', 'finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/inventory-transactions',
          component: () => import('../views/inventory-transactions/ListView.vue'),
          meta: { roles: ['operator', 'finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/inventory-transactions/inbound/create',
          component: () => import('../views/inventory-transactions/FormView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/inventory-transactions/outbound/create',
          component: () => import('../views/inventory-transactions/FormView.vue'),
          meta: { roles: ['admin'] satisfies RoleCode[] },
        },
        {
          path: '/material-preparations',
          component: () => import('../views/material-preparations/ListView.vue'),
          meta: { roles: ['operator', 'finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/material-preparations/create',
          component: () => import('../views/material-preparations/CreateView.vue'),
          meta: { roles: ['operator', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/material-preparations/:id',
          component: () => import('../views/material-preparations/DetailView.vue'),
          meta: { roles: ['operator', 'finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/reports/work-order-material-costs',
          component: () => import('../views/reports/WorkOrderMaterialCostsView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/reports/inventory-alerts',
          component: () => import('../views/reports/InventoryAlertsView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/reports/material-preparations/unbound-overdue',
          component: () => import('../views/reports/UnboundOverduePreparationsView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/reports/supplier-material-usage',
          component: () => import('../views/reports/SupplierMaterialUsageView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/operation-logs',
          component: () => import('../views/operation-logs/ListView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[],
            requiresOperationLogsFormalIdentity: true },
        },
        {
          path: '/abc-sync/dashboard',
          component: () => import('../views/abc-sync/DashboardView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/ai/console',
          component: () => import('../views/ai/ConsoleView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/ai/memory',
          component: () => import('../views/ai/MemoryView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/abc-sync/orders',
          component: () => import('../views/abc-sync/OrdersListView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/abc-sync/funds',
          component: () => import('../views/abc-sync/FundsListView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/abc-sync/cards',
          component: () => import('../views/abc-sync/CardsListView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/abc-sync/card-ledger',
          component: () => import('../views/abc-sync/CardLedgerView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/abc-sync/materials',
          component: () => import('../views/abc-sync/MaterialsListView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/abc-sync/suppliers',
          component: () => import('../views/abc-sync/SuppliersListView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/abc-sync/warehouses',
          component: () => import('../views/abc-sync/WarehousesListView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/abc-sync/inventory-ledger',
          component: () => import('../views/abc-sync/InventoryLedgerView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/abc-sync/job-runs',
          component: () => import('../views/abc-sync/JobRunsView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/abc-sync/mapping-exceptions',
          component: () => import('../views/abc-sync/MappingExceptionsView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/abc-sync/card-mapping-exceptions',
          component: () => import('../views/abc-sync/CardMappingExceptionsView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/abc-sync/inventory-mapping-exceptions',
          component: () => import('../views/abc-sync/InventoryMappingExceptionsView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/abc-sync/rules',
          component: () => import('../views/abc-sync/RulesView.vue'),
          meta: { roles: ['admin'] satisfies RoleCode[] },
        },
        {
          path: '/group-operations',
          component: () => import('../views/group-operations/WorkspaceView.vue'),
          meta: {
            requiresGov1FormalIdentity: true,
            roles: [
              'admin',
              'finance',
              'super_admin',
              'owner',
              'founder',
              'business_owner',
              'group_leader',
            ] satisfies RoleCode[],
          },
        },
        {
          path: '/performance/bindings',
          component: () => import('../views/performance/BindingsView.vue'),
          meta: { roles: ['admin'] satisfies RoleCode[] },
        },
        {
          path: '/performance/events',
          component: () => import('../views/performance/EventsView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/performance/rules',
          component: () => import('../views/performance/RulesView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/performance/summaries',
          component: () => import('../views/performance/SummariesView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/performance/summaries/:id',
          component: () => import('../views/performance/SummaryDetailView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/performance/pending',
          component: () => import('../views/performance/PendingView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/business-stats/tags',
          component: () => import('../views/business-stats/TagsView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/business-stats/events',
          component: () => import('../views/business-stats/EventsView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/business-stats/rules',
          component: () => import('../views/business-stats/RulesView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/business-stats/summaries',
          component: () => import('../views/business-stats/SummariesView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/business-stats/summaries/:id',
          component: () => import('../views/business-stats/SummaryDetailView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/business-stats/pending',
          component: () => import('../views/business-stats/PendingView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/payroll-trials',
          component: () => import('../views/payroll-trials/ListView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/payroll-trials/pending',
          component: () => import('../views/payroll-trials/PendingView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/payroll-trials/:id',
          component: () => import('../views/payroll-trials/DetailView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/engagement/platform-contents',
          component: () => import('../views/engagement/PlatformContentsView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/engagement/platform-interactions',
          component: () => import('../views/engagement/PlatformInteractionsView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/engagement/import-batches',
          component: () => import('../views/engagement/PlatformImportBatchesView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/engagement/import-records',
          component: () => import('../views/engagement/PlatformImportRecordsView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/engagement/platform-leads',
          component: () => import('../views/engagement/PlatformLeadsView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/engagement/connector-configs',
          component: () => import('../views/engagement/ConnectorConfigsView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/engagement/recommendation-rules',
          component: () => import('../views/engagement/RecommendationRulesView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/engagement/script-templates',
          component: () => import('../views/engagement/ScriptTemplatesView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/engagement/script-experiments',
          component: () => import('../views/engagement/ScriptExperimentsView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/engagement/followup-feedback',
          component: () => import('../views/engagement/FollowupFeedbackView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/engagement/execution-playbooks',
          component: () => import('../views/engagement/ExecutionPlaybooksView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/engagement/execution-tasks',
          component: () => import('../views/engagement/ExecutionTasksView.vue'),
          meta: { roles: ['operator', 'finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/engagement/execution-tasks/:id',
          component: () => import('../views/engagement/ExecutionTaskDetailView.vue'),
          meta: { roles: ['operator', 'finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/engagement/execution-results',
          component: () => import('../views/engagement/ExecutionResultsView.vue'),
          meta: { roles: ['operator', 'finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/engagement/lead-candidates',
          component: () => import('../views/engagement/LeadCandidatesView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/engagement/attributions',
          component: () => import('../views/engagement/AttributionResultsView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/engagement/profiles/customers',
          component: () => import('../views/engagement/CustomerProfilesView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/engagement/profiles/employees',
          component: () => import('../views/engagement/EmployeeProfilesView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/engagement/followup-suggestions',
          component: () => import('../views/engagement/FollowupSuggestionsView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/engagement/memories',
          component: () => import('../views/engagement/MemoriesView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/engagement/interaction-links',
          component: () => import('../views/engagement/InteractionLinksView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/engagement/ai-recommendations',
          component: () => import('../views/engagement/AiRecommendationsView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/employee-benefits/issues',
          component: () => import('../views/employee-benefits/IssuesListView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/employee-benefits/issues/:id',
          component: () => import('../views/employee-benefits/IssueDetailView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/employee-benefits/accounts',
          component: () => import('../views/employee-benefits/AccountsView.vue'),
          meta: { roles: ['finance', 'approver', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/employee-benefits/notifications',
          component: () => import('../views/employee-benefits/NotificationsView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/points/hub',
          component: () => import('../views/points/HubView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/points/commands',
          component: () => import('../views/points/CommandsView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/points/redemptions',
          component: () => import('../views/points/RedemptionsView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/points/redemptions/:id',
          component: () => import('../views/points/RedemptionDetailView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/points/welfare',
          component: () => import('../views/points/WelfareView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/points/commands/:id',
          component: () => import('../views/points/CommandDetailView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/abc-points/overview',
          component: () => import('../views/points/AbcPointsOverviewView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/abc-points/commands',
          component: () => import('../views/points/AbcPointsCommandsView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/abc-points/commands/:id',
          component: () => import('../views/points/AbcPointsCommandDetailView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
        {
          path: '/abc-points/ledger',
          component: () => import('../views/points/AbcPointsLedgerView.vue'),
          meta: { roles: ['finance', 'admin'] satisfies RoleCode[] },
        },
      ],
    },
];

const ownerBankSmsReadonlyRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    component: OwnerBankSmsReadonlyLayout,
    redirect: OWNER_BANK_SMS_PATH,
    children: [
      {
        path: OWNER_BANK_SMS_PATH,
        component: () => import('../views/finance/BankSmsReconciliationView.vue'),
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: OWNER_BANK_SMS_PATH,
  },
];

const ownerRepairReadonlyRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    component: OwnerRepairReadonlyLayout,
    redirect: OWNER_REPAIR_WORK_ORDERS_PATH,
    children: [
      {
        path: OWNER_REPAIR_WORK_ORDERS_PATH,
        component: () => import('../views/owner-repair/OwnerRepairReadonlyListView.vue'),
      },
      {
        path: `${OWNER_REPAIR_WORK_ORDERS_PATH}/:id`,
        component: () => import('../views/owner-repair/OwnerRepairReadonlyWorkspaceView.vue'),
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: OWNER_REPAIR_WORK_ORDERS_PATH,
  },
];

const ownerRepairAcceptanceRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    component: OwnerRepairAcceptanceLayout,
    redirect: OWNER_REPAIR_WORK_ORDERS_PATH,
    children: [
      {
        path: OWNER_REPAIR_WORK_ORDERS_PATH,
        component: () => import('../views/work-orders/ListView.vue'),
      },
      {
        path: `${OWNER_REPAIR_WORK_ORDERS_PATH}/create`,
        component: () => import('../views/work-orders/CreateView.vue'),
      },
      {
        path: `${OWNER_REPAIR_WORK_ORDERS_PATH}/:id`,
        component: () => import('../views/work-orders/DetailView.vue'),
      },
      {
        path: `${OWNER_REPAIR_WORK_ORDERS_PATH}/:id/repair`,
        component: () => import('../views/work-orders/RepairWorkspaceView.vue'),
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: OWNER_REPAIR_WORK_ORDERS_PATH,
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: __OWNER_INTAKE__ ? [
    { path: '/work-orders/intake/:id/repair', component: () => import('../views/work-orders/RepairWorkspaceView.vue') },
    { path: '/work-orders/intake/:id?', component: () => import('../views/work-orders/CreateView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/work-orders/intake' },
  ] : OWNER_REPAIR_ACCEPTANCE_ENABLED
    ? ownerRepairAcceptanceRoutes
    : OWNER_REPAIR_READONLY_ENABLED
      ? ownerRepairReadonlyRoutes
      : OWNER_BANK_SMS_READONLY_ENABLED
        ? ownerBankSmsReadonlyRoutes
        : standardRoutes,
});

router.beforeEach(async (to) => {
  const navigationSequence = ++formalIdentityNavigationSequence;

  if (__OWNER_INTAKE__) {
    setAuthenticatedUserIdentity(null);
    if (/^\/work-orders\/intake\/[1-9][0-9]*\/repair$/.test(to.path)) {
      try {
        const { data } = await getAuthenticatedUser();
        if (navigationSequence !== formalIdentityNavigationSequence) return false;
        if (data.data?.identitySource !== 'trusted_proxy' || data.data.formalIdentityBound !== true) return '/work-orders/intake';
        setAuthenticatedUserIdentity(data.data);
      } catch { return navigationSequence === formalIdentityNavigationSequence ? '/work-orders/intake' : false; }
    }
    return /^\/work-orders\/intake(?:\/[1-9][0-9]*(?:\/repair)?)?$/.test(to.path) ? true : '/work-orders/intake';
  }

  if (OWNER_REPAIR_ACCEPTANCE_ENABLED) {
    if (to.path === OWNER_REPAIR_WORK_ORDERS_PATH) return true;
    if (to.path === `${OWNER_REPAIR_WORK_ORDERS_PATH}/create`) return true;
    if (/^\/work-orders\/[1-9][0-9]*$/.test(to.path)) return true;
    if (/^\/work-orders\/[1-9][0-9]*\/repair$/.test(to.path)) return true;
    return OWNER_REPAIR_WORK_ORDERS_PATH;
  }

  if (OWNER_REPAIR_READONLY_ENABLED) {
    if (to.path === OWNER_REPAIR_WORK_ORDERS_PATH) return true;
    if (/^\/work-orders\/[1-9][0-9]*$/.test(to.path)) return true;
    return OWNER_REPAIR_WORK_ORDERS_PATH;
  }

  if (OWNER_BANK_SMS_READONLY_ENABLED) {
    return to.path === OWNER_BANK_SMS_PATH ? true : OWNER_BANK_SMS_PATH;
  }

  const roles = to.matched.flatMap((record) => (record.meta.roles as RoleCode[] | undefined) ?? []);

  if (requiresOperationLogsIdentity(to.matched)) {
    await operationLogsAdmission.authorize(async (signal) => {
      const { data } = await getAuthenticatedUser('application', signal);
      return data?.success === true ? data.data : null;
    });
    if (navigationSequence !== formalIdentityNavigationSequence) return false;
    const identity = operationLogsAdmission.state.value.identity;
    setAuthenticatedUserIdentity(identity ? { ...identity, roleCodes: [...identity.roleCodes] } : null);
    // The existing page renders a denial shell, never a protected table/API,
    // when admission failed. Do not redirect through the demo home resolver.
    return true;
  }
  operationLogsAdmission.invalidate();

  const gov1IdentityDecision = await evaluateGov1FormalIdentityRoute(
    requiresGov1FormalIdentity(to.matched),
    roles,
    async () => {
      const { data } = await getAuthenticatedUser('gov1_acceptance');
      return data.data;
    },
  );
  if (gov1IdentityDecision.applies) {
    if (navigationSequence !== formalIdentityNavigationSequence) {
      return false;
    }
    setAuthenticatedUserIdentity(gov1IdentityDecision.identity);
    return gov1IdentityDecision.admitted;
  }

  if (roles.length === 0 || hasAnyRole(roles)) {
    return true;
  }

  return resolveHomePath();
});

export default router;
