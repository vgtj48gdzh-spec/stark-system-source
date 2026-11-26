import type { RoleCode } from './permissions';

export interface NavigationItem {
  path: string;
  label: string;
  roles: RoleCode[];
  labelByRole?: Partial<Record<RoleCode, string>>;
}

export interface NavigationGroup {
  id: string;
  title: string;
  items: NavigationItem[];
}

const financeCenterRoles: RoleCode[] = [
  'admin',
  'finance',
  'super_admin',
  'owner',
  'finance_manager',
  'finance_operator',
  'auditor',
];

export const navigationGroups: NavigationGroup[] = [
  {
    id: 'group-operations',
    title: '小组经营与人工成本',
    items: [
      {
        path: '/group-operations',
        label: '组织与经营保底',
        roles: [
          'admin',
          'finance',
          'super_admin',
          'owner',
          'founder',
          'business_owner',
          'group_leader',
        ],
      },
    ],
  },
  {
    id: 'mobile-security',
    title: '移动短信与安全',
    items: [
      { path: '/mobile/sms-diagnostics', label: '设备与短信诊断', roles: financeCenterRoles },
      { path: '/security/verification-codes', label: '验证码转发中心', roles: financeCenterRoles },
    ],
  },
  {
    id: 'core',
    title: '主营业务',
    items: [
      { path: '/work-orders', label: '工单管理', roles: ['admin', 'operator'] },
      { path: '/payment-records', label: '收款记录', roles: ['admin', 'finance', 'approver'] },
      { path: '/approval-requests', label: '审批管理', roles: ['admin', 'finance', 'approver'] },
      { path: '/payout-records', label: '付款记录', roles: ['admin'] },
      { path: '/operation-logs', label: '操作日志', roles: ['admin', 'finance', 'approver'] },
    ],
  },
  {
    id: 'finance-center',
    title: '财务中心',
    items: [
      { path: '/finance/bank-accounts', label: '银行账户绑定', roles: financeCenterRoles },
      { path: '/finance/wechat-receipts', label: '微信支付回执', roles: financeCenterRoles },
      { path: '/finance/wechat-settlement-batches', label: '财付通结算批次', roles: financeCenterRoles },
      { path: '/finance/bank-sms', label: '银行短信对账', roles: financeCenterRoles },
      { path: '/finance/virtual-amount-check', label: '虚拟金额核对', roles: financeCenterRoles },
    ],
  },
  {
    id: 'inventory',
    title: '库存与材料',
    items: [
      { path: '/warehouses', label: '仓库管理', roles: ['admin'] },
      { path: '/suppliers', label: '供应商管理', roles: ['admin'] },
      { path: '/materials', label: '材料管理', roles: ['admin'] },
      { path: '/material-stocks', label: '当前库存', roles: ['admin', 'operator', 'finance'] },
      { path: '/inventory-transactions', label: '库存流水', roles: ['admin', 'operator', 'finance'] },
      { path: '/material-preparations', label: '备料管理', roles: ['admin', 'operator', 'finance', 'approver'] },
    ],
  },
  {
    id: 'reports',
    title: '经营报表',
    items: [
      { path: '/reports/work-order-material-costs', label: '工单材料成本', roles: ['admin', 'finance'] },
      { path: '/reports/inventory-alerts', label: '库存预警', roles: ['admin', 'finance'] },
      {
        path: '/reports/material-preparations/unbound-overdue',
        label: '超时未绑定备料',
        roles: ['admin', 'finance', 'approver'],
      },
      { path: '/reports/supplier-material-usage', label: '供应商材料使用', roles: ['admin', 'finance'] },
    ],
  },
  {
    id: 'abc-sync',
    title: 'ABC 只读接入',
    items: [
      { path: '/abc-sync/dashboard', label: 'ABC 总览', roles: ['admin', 'finance', 'approver'] },
      { path: '/abc-sync/orders', label: '同步订单', roles: ['admin', 'finance'] },
      { path: '/abc-sync/funds', label: '同步资金', roles: ['admin', 'finance'] },
      { path: '/abc-sync/cards', label: '同步卡账户', roles: ['admin', 'finance'] },
      { path: '/abc-sync/card-ledger', label: '同步卡流水', roles: ['admin', 'finance'] },
      { path: '/abc-sync/materials', label: '同步材料', roles: ['admin', 'finance'] },
      { path: '/abc-sync/suppliers', label: '同步供应商', roles: ['admin', 'finance'] },
      { path: '/abc-sync/warehouses', label: '同步仓库', roles: ['admin', 'finance'] },
      { path: '/abc-sync/inventory-ledger', label: '同步库存流水', roles: ['admin', 'finance'] },
      { path: '/abc-sync/job-runs', label: '同步运行记录', roles: ['admin', 'finance', 'approver'] },
      { path: '/abc-sync/mapping-exceptions', label: '映射异常', roles: ['admin', 'finance', 'approver'] },
      { path: '/abc-sync/card-mapping-exceptions', label: '卡域异常', roles: ['admin', 'finance'] },
      { path: '/abc-sync/inventory-mapping-exceptions', label: '库存域异常', roles: ['admin', 'finance'] },
      { path: '/abc-sync/rules', label: '映射规则', roles: ['admin'] },
    ],
  },
  {
    id: 'performance',
    title: '绩效基础',
    items: [
      { path: '/performance/bindings', label: '员工绑定', roles: ['admin', 'finance'] },
      { path: '/performance/rules', label: '绩效规则', roles: ['admin', 'finance'] },
      { path: '/performance/events', label: '绩效事件', roles: ['admin', 'finance'] },
      { path: '/performance/summaries', label: '月度汇总', roles: ['admin', 'finance', 'approver'] },
      { path: '/performance/pending', label: '待确认清单', roles: ['admin', 'finance', 'approver'] },
    ],
  },
  {
    id: 'business-stats',
    title: '经营统计与奖励',
    items: [
      { path: '/business-stats/tags', label: '统计标签', roles: ['admin', 'finance'] },
      { path: '/business-stats/events', label: '奖励事件', roles: ['admin', 'finance'] },
      { path: '/business-stats/rules', label: '奖励规则', roles: ['admin', 'finance'] },
      { path: '/business-stats/summaries', label: '月度统计汇总', roles: ['admin', 'finance', 'approver'] },
      { path: '/business-stats/pending', label: '待处理清单', roles: ['admin', 'finance', 'approver'] },
    ],
  },
  {
    id: 'payroll-trials',
    title: '工资试算',
    items: [
      { path: '/payroll-trials', label: '工资试算列表', roles: ['admin', 'finance', 'approver'] },
      { path: '/payroll-trials/pending', label: '试算待确认', roles: ['admin', 'finance', 'approver'] },
    ],
  },
  {
    id: 'engagement',
    title: 'AI 触达与记忆',
    items: [
      { path: '/engagement/platform-contents', label: '平台内容', roles: ['admin', 'finance', 'approver'] },
      { path: '/engagement/platform-interactions', label: '平台互动', roles: ['admin', 'finance', 'approver'] },
      { path: '/engagement/import-batches', label: '平台导入批次', roles: ['admin', 'finance', 'approver'] },
      { path: '/engagement/import-records', label: '平台导入记录', roles: ['admin', 'finance', 'approver'] },
      { path: '/engagement/platform-leads', label: '平台线索', roles: ['admin', 'finance'] },
      { path: '/engagement/connector-configs', label: '连接器配置', roles: ['admin', 'finance'] },
      { path: '/engagement/recommendation-rules', label: '推荐规则', roles: ['admin', 'finance'] },
      { path: '/engagement/script-templates', label: '话术模板', roles: ['admin', 'finance'] },
      { path: '/engagement/script-experiments', label: '话术实验', roles: ['admin', 'finance', 'approver'] },
      { path: '/engagement/followup-feedback', label: '跟进反馈', roles: ['admin', 'finance', 'approver'] },
      { path: '/engagement/execution-playbooks', label: '执行方案', roles: ['admin', 'finance', 'approver'] },
      { path: '/engagement/execution-tasks', label: '执行任务', roles: ['admin', 'finance', 'approver', 'operator'] },
      { path: '/engagement/execution-results', label: '执行结果', roles: ['admin', 'finance', 'approver', 'operator'] },
      { path: '/engagement/lead-candidates', label: '线索候选', roles: ['admin', 'finance', 'approver'] },
      { path: '/engagement/attributions', label: '归因结果', roles: ['admin', 'finance', 'approver'] },
      { path: '/engagement/profiles/customers', label: '客户画像摘要', roles: ['admin', 'finance', 'approver'] },
      { path: '/engagement/profiles/employees', label: '员工画像摘要', roles: ['admin', 'finance', 'approver'] },
      { path: '/engagement/followup-suggestions', label: '跟进建议', roles: ['admin', 'finance', 'approver'] },
      { path: '/engagement/memories', label: '记忆条目', roles: ['admin', 'finance', 'approver'] },
      { path: '/engagement/interaction-links', label: '关联记录', roles: ['admin', 'finance', 'approver'] },
      { path: '/engagement/ai-recommendations', label: 'AI 推荐', roles: ['admin', 'finance', 'approver'] },
    ],
  },
  {
    id: 'employee-benefits',
    title: '员工福利',
    items: [
      { path: '/employee-benefits/issues', label: '福利发放单', roles: ['admin', 'finance', 'approver'] },
      { path: '/employee-benefits/accounts', label: '福利账户', roles: ['admin', 'finance', 'approver'] },
      { path: '/employee-benefits/notifications', label: '福利通知', roles: ['admin', 'finance'] },
    ],
  },
  {
    id: 'ai-console',
    title: 'AI 总控',
    items: [
      { path: '/ai/console', label: 'AI 总控台', roles: ['admin', 'finance', 'approver'] },
      { path: '/ai/memory', label: 'AI 记忆库', roles: ['admin', 'finance'] },
    ],
  },
  {
    id: 'hq-points',
    title: '总部积分',
    items: [
      { path: '/points/hub', label: '积分总览 / 操作指引', roles: ['admin', 'finance'] },
      { path: '/points/welfare', label: '员工福利积分', roles: ['admin', 'finance'] },
      { path: '/points/commands', label: '积分命令', roles: ['admin', 'finance'] },
      { path: '/points/redemptions', label: '积分兑换', roles: ['admin', 'finance'] },
    ],
  },
  {
    id: 'abc-score',
    title: 'ABC 积分',
    items: [
      { path: '/abc-points/overview', label: 'ABC 积分总览', roles: ['admin', 'finance'] },
      { path: '/abc-points/commands', label: 'ABC 积分命令', roles: ['admin', 'finance'] },
      { path: '/abc-points/ledger', label: 'ABC 积分流水 / 对账', roles: ['admin', 'finance'] },
    ],
  },
];
