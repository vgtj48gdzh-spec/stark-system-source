import { BankTruthReviewRole } from './bank-truth-input-contract';

export type MultiCompanyVirtualLedgerLayerType =
  | 'company_virtual_ledger_root'
  | 'account_scope_ledger'
  | 'business_bucket_ledger'
  | 'journal_entry_stream'
  | 'monthly_reconciliation_layer'
  | 'audit_trace_layer';

export type MultiCompanyVirtualLedgerEntryKind =
  | 'opening_carry_forward'
  | 'receipt_projection_increase'
  | 'payout_projection_decrease'
  | 'internal_transfer_in'
  | 'internal_transfer_out'
  | 'bank_observation_reference'
  | 'approval_control_reference'
  | 'payment_business_reference'
  | 'payout_business_reference'
  | 'fund_truth_comparison_reference'
  | 'monthly_statement_reference'
  | 'reconciliation_variance_reference'
  | 'exception_ticket_reference'
  | 'audit_trace_reference';

export type MultiCompanyVirtualLedgerEntryCategory =
  | 'balance'
  | 'reference'
  | 'reconciliation'
  | 'exception'
  | 'audit';

export type MultiCompanyVirtualLedgerBoundaryTarget =
  | 'bank_sms_vendor_real_adapter'
  | 'bank_truth_staging'
  | 'bank_account_scope'
  | 'approval_requests'
  | 'payment_records'
  | 'payout_records'
  | 'fund_truth_reconciliations';

export type MultiCompanyVirtualLedgerWorkflowOwner =
  | 'system'
  | BankTruthReviewRole
  | 'joint_review';

export interface MultiCompanyVirtualLedgerLayerDefinition {
  level: number;
  layerType: MultiCompanyVirtualLedgerLayerType;
  balanceBearing: boolean;
  scope: string;
  purpose: string;
  allowedEntryKinds: MultiCompanyVirtualLedgerEntryKind[];
  forbiddenActions: string[];
  note: string;
}

export interface MultiCompanyVirtualLedgerEntryDefinition {
  entryKind: MultiCompanyVirtualLedgerEntryKind;
  category: MultiCompanyVirtualLedgerEntryCategory;
  direction: 'carry' | 'in' | 'out' | 'internal' | 'reference_only';
  formsBalance: boolean;
  affectsCompanyBalance: boolean;
  affectsGroupConsolidatedBalance: boolean;
  sourceSignals: string[];
  requiredManualGate: string;
  note: string;
}

export interface MultiCompanyVirtualLedgerBalanceRule {
  ledgerLevel: MultiCompanyVirtualLedgerLayerType;
  formula: string;
  includeEntryKinds: MultiCompanyVirtualLedgerEntryKind[];
  excludeEntryKinds: MultiCompanyVirtualLedgerEntryKind[];
  note: string;
}

export interface MultiCompanyVirtualLedgerActionPolicy {
  action: string;
  allowedEntryKinds: MultiCompanyVirtualLedgerEntryKind[];
  directBalanceMutationAllowed: false;
  systemMayDo: string[];
  systemMustNotDo: string[];
  note: string;
}

export interface MultiCompanyVirtualLedgerInternalTransferPolicy {
  scenario: string;
  requiredEntryKinds: MultiCompanyVirtualLedgerEntryKind[];
  pairingKey: string;
  companyEffect: string;
  groupEffect: string;
  revenueExpenseTreatment: string;
  forbiddenConclusions: string[];
  note: string;
}

export interface MultiCompanyVirtualLedgerMonthlyReconciliationStage {
  stage: string;
  inputs: string[];
  outputs: string[];
  systemMayDo: string[];
  systemMustNotDo: string[];
  note: string;
}

export interface MultiCompanyVirtualLedgerExceptionType {
  code: string;
  trigger: string;
  defaultQueue: 'finance_data_review' | 'finance_audit' | 'data_governance' | 'joint_review';
  requiredEvidence: string[];
  note: string;
}

export interface MultiCompanyVirtualLedgerExceptionWorkflowStep {
  step: 'auto_draft' | 'reason_fill' | 'governance_reason_fill' | 'approval' | 'review';
  owner: MultiCompanyVirtualLedgerWorkflowOwner;
  appliesTo: string[];
  output: string;
  note: string;
}

export interface MultiCompanyVirtualLedgerAuditLayerPolicy {
  layer: 'application' | 'database' | 'external_system';
  purpose: string;
  currentState: 'implemented_required' | 'blueprint_only' | 'external_reference';
  mustLinkTo: string[];
  systemMustNotDo: string[];
  note: string;
}

export interface MultiCompanyVirtualLedgerRelationBoundary {
  target: MultiCompanyVirtualLedgerBoundaryTarget;
  currentRole: string;
  allowedReadOnlyUse: string[];
  allowedGeneratedEntries: MultiCompanyVirtualLedgerEntryKind[];
  forbiddenActions: string[];
  note: string;
}

export interface MultiCompanyVirtualLedgerBlueprint {
  blueprintCode: string;
  version: string;
  mode: 'read_only_blueprint';
  stage: 'F7.7';
  scope: string;
  upstreamBlueprints: string[];
  hardGuards: string[];
  nonGoals: string[];
  hierarchy: MultiCompanyVirtualLedgerLayerDefinition[];
  entryDefinitions: MultiCompanyVirtualLedgerEntryDefinition[];
  balanceRules: MultiCompanyVirtualLedgerBalanceRule[];
  actionPolicies: MultiCompanyVirtualLedgerActionPolicy[];
  internalTransferPolicies: MultiCompanyVirtualLedgerInternalTransferPolicy[];
  monthlyReconciliationStages: MultiCompanyVirtualLedgerMonthlyReconciliationStage[];
  exceptionTypes: MultiCompanyVirtualLedgerExceptionType[];
  exceptionWorkflow: MultiCompanyVirtualLedgerExceptionWorkflowStep[];
  auditLayers: MultiCompanyVirtualLedgerAuditLayerPolicy[];
  relationBoundaries: MultiCompanyVirtualLedgerRelationBoundary[];
  nextGaps: string[];
  reviewChecklist: string[];
}

export const MULTI_COMPANY_VIRTUAL_LEDGER_BLUEPRINT: MultiCompanyVirtualLedgerBlueprint = {
  blueprintCode: 'fund_truth.multi_company_virtual_ledger_blueprint',
  version: '2026-04-17.f7.7-multi-company-virtual-ledger-blueprint',
  mode: 'read_only_blueprint',
  stage: 'F7.7',
  scope:
    '定义多公司虚拟账本的账本层级、余额型分录、引用型分录、异常单、月度银行流水核对层、审计链分层，以及与 approval/payment/payout/bank-sms/fund-truth 的只读边界。',
  upstreamBlueprints: [
    'fund_truth.bank_truth_input_contract@2026-04-16.f6-read-only-blueprint',
    'fund_truth.bank_truth_staging_blueprint@2026-04-16.f7-read-only-staging-blueprint',
    'fund_truth.multi_company_bank_account_scope_blueprint@2026-04-17.f7.6-multi-company-account-scope-blueprint',
  ],
  hardGuards: [
    '不破坏 S1-03 三条稳定链',
    '不自动推进正式工资',
    '不跳过人工确认层',
    '不改工资公式',
    '不改 confirmed / inferred / uncertain',
    '不改 included / pending / excluded',
    '不把车牌号当主绑定键，手机号仍是唯一主键',
    '不混淆销售联动购物卡 / 员工福利购物卡 / 其他活动购物卡',
    '不重新引入 JSON_OVERLAPS',
    '不回退 currentUser 透传',
    '不改数据库 schema',
    '不做任何写入逻辑',
    '不接 AI focus',
    '不做自动对账闭环',
    '不做虚拟余额自动修复',
    '不扩第三颗资金写入对象',
    '余额只能由定义好的余额型分录聚合，不能由命令动作直接覆盖',
    '内部转账必须单独建类，不能误算为收入或支出',
    '月度银行流水核对层只能输出差异、异常单和月结候选，不自动修余额',
  ],
  nonGoals: [
    '不新增银行流水主表或 staging 落库实现',
    '不新增页面或 endpoint',
    '不把 approval_requests / payment_records / payout_records 升级成银行主账',
    '不把 fund_truth_reconciliations 升级成自动对账闭环引擎',
    '不把 bank-sms 或厂家真实接口输入升级成直接记账权限',
    '不把异常单审批结果升级成自动余额修复权限',
  ],
  hierarchy: [
    {
      level: 1,
      layerType: 'company_virtual_ledger_root',
      balanceBearing: true,
      scope: '单家公司汇总层',
      purpose: '汇总该公司所有账户作用域的虚拟余额口径。',
      allowedEntryKinds: [
        'opening_carry_forward',
        'receipt_projection_increase',
        'payout_projection_decrease',
        'internal_transfer_in',
        'internal_transfer_out',
      ],
      forbiddenActions: ['不得手工覆盖最终余额', '不得跳过 journal_entry_stream 直接记总账'],
      note: '这里只允许聚合，不允许直接录入余额事实。',
    },
    {
      level: 2,
      layerType: 'account_scope_ledger',
      balanceBearing: true,
      scope: 'companyScopeCode + virtualLedgerScopeKey',
      purpose: '把同一公司内不同银行账户作用域拆成独立子账本。',
      allowedEntryKinds: [
        'opening_carry_forward',
        'receipt_projection_increase',
        'payout_projection_decrease',
        'internal_transfer_in',
        'internal_transfer_out',
      ],
      forbiddenActions: ['不得把未确认公司或未确认作用域样本直接挂进来'],
      note: '这是多公司虚拟账本真正的承载层。',
    },
    {
      level: 3,
      layerType: 'business_bucket_ledger',
      balanceBearing: true,
      scope: 'external_receipt / external_payout / internal_transfer / manual_review_hold / reconciliation_gap',
      purpose: '把账户作用域内的分录再按业务桶拆开。',
      allowedEntryKinds: [
        'receipt_projection_increase',
        'payout_projection_decrease',
        'internal_transfer_in',
        'internal_transfer_out',
      ],
      forbiddenActions: [
        '不得把 manual_review_hold 直接纳入余额型桶',
        '不得把 reconciliation_gap 直接纳入余额型桶',
      ],
      note: 'manual_review_hold 与 reconciliation_gap 只允许作为参考桶存在，不进入余额。',
    },
    {
      level: 4,
      layerType: 'journal_entry_stream',
      balanceBearing: true,
      scope: '不可篡改分录流',
      purpose: '保存未来所有余额型分录与引用型分录的统一流水模型。',
      allowedEntryKinds: [
        'opening_carry_forward',
        'receipt_projection_increase',
        'payout_projection_decrease',
        'internal_transfer_in',
        'internal_transfer_out',
        'bank_observation_reference',
        'approval_control_reference',
        'payment_business_reference',
        'payout_business_reference',
        'fund_truth_comparison_reference',
        'monthly_statement_reference',
        'reconciliation_variance_reference',
        'exception_ticket_reference',
        'audit_trace_reference',
      ],
      forbiddenActions: ['不得删除已有分录来伪造平账', '不得用覆盖更新替代分录追加'],
      note: '余额只能从这里聚合出来，不能绕开这一层。',
    },
    {
      level: 5,
      layerType: 'monthly_reconciliation_layer',
      balanceBearing: false,
      scope: '月度银行流水核对层',
      purpose: '承载只读核对、差异分类、异常草稿与月结候选。',
      allowedEntryKinds: [
        'monthly_statement_reference',
        'reconciliation_variance_reference',
        'exception_ticket_reference',
      ],
      forbiddenActions: ['不得自动核平差异', '不得自动关账', '不得自动生成 opening_carry_forward'],
      note: '这一层永远只读。',
    },
    {
      level: 6,
      layerType: 'audit_trace_layer',
      balanceBearing: false,
      scope: '应用层 / 数据库层 / 系统外证据层',
      purpose: '提供追溯链，不提供记账权。',
      allowedEntryKinds: ['audit_trace_reference'],
      forbiddenActions: ['不得把审计记录反向解释为余额结论'],
      note: '审计链负责解释，不负责改账。',
    },
  ],
  entryDefinitions: [
    {
      entryKind: 'opening_carry_forward',
      category: 'balance',
      direction: 'carry',
      formsBalance: true,
      affectsCompanyBalance: true,
      affectsGroupConsolidatedBalance: true,
      sourceSignals: ['人工月结通过后的结转结论'],
      requiredManualGate: '必须经 finance_audit 批准的月结结果',
      note: '不得由系统按观测余额自动生成。',
    },
    {
      entryKind: 'receipt_projection_increase',
      category: 'balance',
      direction: 'in',
      formsBalance: true,
      affectsCompanyBalance: true,
      affectsGroupConsolidatedBalance: true,
      sourceSignals: ['银行证据', 'payment_records 只读 compare', 'fund_truth_reconciliations 对照结果'],
      requiredManualGate: '至少保留人工确认入口，不绕过 finance_data_review',
      note: '表示外部收入进入本公司某个作用域。',
    },
    {
      entryKind: 'payout_projection_decrease',
      category: 'balance',
      direction: 'out',
      formsBalance: true,
      affectsCompanyBalance: true,
      affectsGroupConsolidatedBalance: true,
      sourceSignals: ['银行证据', 'approval_requests 只读 compare', 'payout_records 只读 compare'],
      requiredManualGate: '至少保留人工确认入口，不绕过 finance_audit',
      note: '表示外部支出离开本公司某个作用域。',
    },
    {
      entryKind: 'internal_transfer_in',
      category: 'balance',
      direction: 'internal',
      formsBalance: true,
      affectsCompanyBalance: true,
      affectsGroupConsolidatedBalance: false,
      sourceSignals: ['内部转账配对键', '来源/目标公司与作用域'],
      requiredManualGate: '缺少配对时不得放行',
      note: '只表示内部划入，不表示外部收入。',
    },
    {
      entryKind: 'internal_transfer_out',
      category: 'balance',
      direction: 'internal',
      formsBalance: true,
      affectsCompanyBalance: true,
      affectsGroupConsolidatedBalance: false,
      sourceSignals: ['内部转账配对键', '来源/目标公司与作用域'],
      requiredManualGate: '缺少配对时不得放行',
      note: '只表示内部划出，不表示外部支出。',
    },
    {
      entryKind: 'bank_observation_reference',
      category: 'reference',
      direction: 'reference_only',
      formsBalance: false,
      affectsCompanyBalance: false,
      affectsGroupConsolidatedBalance: false,
      sourceSignals: ['bank-sms', 'vendor real adapter', 'bank truth staging'],
      requiredManualGate: '无',
      note: '只说明看见了银行证据，不说明可直接记账。',
    },
    {
      entryKind: 'approval_control_reference',
      category: 'reference',
      direction: 'reference_only',
      formsBalance: false,
      affectsCompanyBalance: false,
      affectsGroupConsolidatedBalance: false,
      sourceSignals: ['approval_requests'],
      requiredManualGate: '无',
      note: '只说明审批控制链存在，不说明真实出款已成立。',
    },
    {
      entryKind: 'payment_business_reference',
      category: 'reference',
      direction: 'reference_only',
      formsBalance: false,
      affectsCompanyBalance: false,
      affectsGroupConsolidatedBalance: false,
      sourceSignals: ['payment_records'],
      requiredManualGate: '无',
      note: '只说明到账语义对象存在，不说明银行主账已成立。',
    },
    {
      entryKind: 'payout_business_reference',
      category: 'reference',
      direction: 'reference_only',
      formsBalance: false,
      affectsCompanyBalance: false,
      affectsGroupConsolidatedBalance: false,
      sourceSignals: ['payout_records'],
      requiredManualGate: '无',
      note: '只说明出款登记存在，不说明银行主账已成立。',
    },
    {
      entryKind: 'fund_truth_comparison_reference',
      category: 'reference',
      direction: 'reference_only',
      formsBalance: false,
      affectsCompanyBalance: false,
      affectsGroupConsolidatedBalance: false,
      sourceSignals: ['fund_truth_reconciliations'],
      requiredManualGate: '无',
      note: '只说明 fund-truth 做过对照，不说明差异已自动解决。',
    },
    {
      entryKind: 'monthly_statement_reference',
      category: 'reconciliation',
      direction: 'reference_only',
      formsBalance: false,
      affectsCompanyBalance: false,
      affectsGroupConsolidatedBalance: false,
      sourceSignals: ['月度银行流水导入'],
      requiredManualGate: '无',
      note: '只说明某一行流水被纳入核对，不说明已入账。',
    },
    {
      entryKind: 'reconciliation_variance_reference',
      category: 'reconciliation',
      direction: 'reference_only',
      formsBalance: false,
      affectsCompanyBalance: false,
      affectsGroupConsolidatedBalance: false,
      sourceSignals: ['月度核对差异分类'],
      requiredManualGate: '无',
      note: '只说明差异存在，不说明系统可自动修复。',
    },
    {
      entryKind: 'exception_ticket_reference',
      category: 'exception',
      direction: 'reference_only',
      formsBalance: false,
      affectsCompanyBalance: false,
      affectsGroupConsolidatedBalance: false,
      sourceSignals: ['异常单草稿', '异常单审批流转'],
      requiredManualGate: '异常单必须经过人工处理',
      note: '异常单负责记录处理过程，不负责修余额。',
    },
    {
      entryKind: 'audit_trace_reference',
      category: 'audit',
      direction: 'reference_only',
      formsBalance: false,
      affectsCompanyBalance: false,
      affectsGroupConsolidatedBalance: false,
      sourceSignals: ['应用日志', '数据库审计', '系统外证据摘要'],
      requiredManualGate: '无',
      note: '审计只做追溯，不做余额事实。',
    },
  ],
  balanceRules: [
    {
      ledgerLevel: 'company_virtual_ledger_root',
      formula:
        'opening_carry_forward + receipt_projection_increase + internal_transfer_in - payout_projection_decrease - internal_transfer_out',
      includeEntryKinds: [
        'opening_carry_forward',
        'receipt_projection_increase',
        'payout_projection_decrease',
        'internal_transfer_in',
        'internal_transfer_out',
      ],
      excludeEntryKinds: [
        'bank_observation_reference',
        'approval_control_reference',
        'payment_business_reference',
        'payout_business_reference',
        'fund_truth_comparison_reference',
        'monthly_statement_reference',
        'reconciliation_variance_reference',
        'exception_ticket_reference',
        'audit_trace_reference',
      ],
      note: '同公司内不同作用域之间的 internal transfer 在公司根账本净额必须回到 0。',
    },
    {
      ledgerLevel: 'account_scope_ledger',
      formula:
        'opening_carry_forward + receipt_projection_increase + internal_transfer_in - payout_projection_decrease - internal_transfer_out',
      includeEntryKinds: [
        'opening_carry_forward',
        'receipt_projection_increase',
        'payout_projection_decrease',
        'internal_transfer_in',
        'internal_transfer_out',
      ],
      excludeEntryKinds: [
        'bank_observation_reference',
        'approval_control_reference',
        'payment_business_reference',
        'payout_business_reference',
        'fund_truth_comparison_reference',
        'monthly_statement_reference',
        'reconciliation_variance_reference',
        'exception_ticket_reference',
        'audit_trace_reference',
      ],
      note: '只按作用域聚合，不接受未确认公司或未确认作用域样本。',
    },
    {
      ledgerLevel: 'business_bucket_ledger',
      formula: 'external_receipt + external_payout + internal_transfer; manual_review_hold / reconciliation_gap 不入账',
      includeEntryKinds: [
        'receipt_projection_increase',
        'payout_projection_decrease',
        'internal_transfer_in',
        'internal_transfer_out',
      ],
      excludeEntryKinds: [
        'bank_observation_reference',
        'approval_control_reference',
        'payment_business_reference',
        'payout_business_reference',
        'fund_truth_comparison_reference',
        'monthly_statement_reference',
        'reconciliation_variance_reference',
        'exception_ticket_reference',
        'audit_trace_reference',
      ],
      note: 'manual_review_hold 与 reconciliation_gap 只允许参考，不允许形成余额。',
    },
  ],
  actionPolicies: [
    {
      action: 'bank_sms_or_vendor_real_ingestion',
      allowedEntryKinds: ['bank_observation_reference'],
      directBalanceMutationAllowed: false,
      systemMayDo: ['生成银行观测引用', '挂原始载荷摘要'],
      systemMustNotDo: ['不得直接改任何公司余额', '不得直接认定到账或出款'],
      note: '银行输入只有观察权，没有记账权。',
    },
    {
      action: 'bank_truth_staging_projection',
      allowedEntryKinds: ['bank_observation_reference', 'monthly_statement_reference'],
      directBalanceMutationAllowed: false,
      systemMayDo: ['生成只读投影候选', '挂到月度核对层'],
      systemMustNotDo: ['不得绕过人工确认进入余额型分录'],
      note: 'staging 只负责把证据带进来。',
    },
    {
      action: 'approval_request_command_projection',
      allowedEntryKinds: ['approval_control_reference'],
      directBalanceMutationAllowed: false,
      systemMayDo: ['解释审批上下文'],
      systemMustNotDo: ['不得把审批状态直接写成真实出款余额'],
      note: 'approval 只提供控制链上下文。',
    },
    {
      action: 'payment_record_command_projection',
      allowedEntryKinds: ['payment_business_reference'],
      directBalanceMutationAllowed: false,
      systemMayDo: ['解释到账语义对象'],
      systemMustNotDo: ['不得把 payment_records 直接写成虚拟账本余额'],
      note: 'payment 继续只是语义对象。',
    },
    {
      action: 'payout_record_projection',
      allowedEntryKinds: ['payout_business_reference'],
      directBalanceMutationAllowed: false,
      systemMayDo: ['解释出款登记对象'],
      systemMustNotDo: ['不得把 payout_records 直接写成虚拟账本余额'],
      note: 'payout 继续只是登记对象。',
    },
    {
      action: 'fund_truth_read_only_compare',
      allowedEntryKinds: [
        'fund_truth_comparison_reference',
        'reconciliation_variance_reference',
      ],
      directBalanceMutationAllowed: false,
      systemMayDo: ['生成对照摘要', '生成差异分类'],
      systemMustNotDo: ['不得自动核平差异', '不得自动修余额'],
      note: 'fund-truth 继续只做对照与映射准备。',
    },
    {
      action: 'monthly_bank_statement_import',
      allowedEntryKinds: [
        'monthly_statement_reference',
        'reconciliation_variance_reference',
        'exception_ticket_reference',
      ],
      directBalanceMutationAllowed: false,
      systemMayDo: ['生成月度核对结果', '起草异常单'],
      systemMustNotDo: ['不得自动关账', '不得自动生成 opening_carry_forward'],
      note: '月度流水导入也只有核对权，没有结算权。',
    },
    {
      action: 'exception_ticket_workflow',
      allowedEntryKinds: ['exception_ticket_reference', 'audit_trace_reference'],
      directBalanceMutationAllowed: false,
      systemMayDo: ['记录异常处理过程', '记录审批与复核轨迹'],
      systemMustNotDo: ['不得直接修余额', '不得直接改主对象状态'],
      note: '异常处理流只做留痕与路由。',
    },
  ],
  internalTransferPolicies: [
    {
      scenario: 'same_company_cross_scope_transfer',
      requiredEntryKinds: ['internal_transfer_out', 'internal_transfer_in'],
      pairingKey: 'internalTransferGroupKey',
      companyEffect: '只影响同一公司内部不同作用域余额，根账本净额应回到 0。',
      groupEffect: '对总部合并口径净额为 0。',
      revenueExpenseTreatment: '不算收入，不算支出。',
      forbiddenConclusions: ['不得落入 external_receipt', '不得落入 external_payout'],
      note: '这是作用域重分布，不是经营结果。',
    },
    {
      scenario: 'cross_company_internal_settlement',
      requiredEntryKinds: ['internal_transfer_out', 'internal_transfer_in'],
      pairingKey: 'internalTransferGroupKey + sourceCompanyScopeCode + targetCompanyScopeCode',
      companyEffect: '来源公司减少、目标公司增加。',
      groupEffect: '总部合并口径仍是内部转账净额为 0。',
      revenueExpenseTreatment: '不算外部收入，不算外部支出。',
      forbiddenConclusions: ['不得把目标公司转入记成营业收入', '不得把来源公司转出记成营业费用'],
      note: '跨公司内部划拨也必须单独建类。',
    },
    {
      scenario: 'internal_transfer_pair_break',
      requiredEntryKinds: ['reconciliation_variance_reference', 'exception_ticket_reference'],
      pairingKey: 'internalTransferGroupKey',
      companyEffect: '不允许自动补平余额。',
      groupEffect: '必须保留差异直到人工处理。',
      revenueExpenseTreatment: '不得回退成外部收支。',
      forbiddenConclusions: ['不得把缺失一边的内部转账解释成外部交易'],
      note: '配对缺失时只能进差异与异常单。',
    },
  ],
  monthlyReconciliationStages: [
    {
      stage: 'statement_import_read_only',
      inputs: ['银行流水文件', '银行月度导出', '银行接口月度拉取结果'],
      outputs: ['monthly_statement_reference'],
      systemMayDo: ['按导入批次保留文件摘要', '为每行流水生成只读引用'],
      systemMustNotDo: ['不得直接生成余额型分录'],
      note: '导入先停在只读引用层。',
    },
    {
      stage: 'account_scope_partition',
      inputs: ['monthly_statement_reference', 'multi_company_bank_account_scope_blueprint'],
      outputs: ['按 companyScopeCode + virtualLedgerScopeKey 切分的流水池'],
      systemMayDo: ['依据账户作用域蓝图切分流水'],
      systemMustNotDo: ['不得把未解析公司或作用域的样本自动分配到账本'],
      note: '先解作用域，再做账本 compare。',
    },
    {
      stage: 'ledger_entry_comparison',
      inputs: ['月度流水池', 'journal_entry_stream'],
      outputs: ['命中集合', '未命中集合', '冲突集合'],
      systemMayDo: ['按银行锚点和分录锚点做只读 compare'],
      systemMustNotDo: ['不得自动补分录或删分录来平账'],
      note: '这里只做差异识别。',
    },
    {
      stage: 'variance_classification',
      inputs: ['命中集合', '未命中集合', '冲突集合'],
      outputs: [
        'statement_line_unmatched',
        'ledger_entry_missing_bank_evidence',
        'amount_mismatch',
        'direction_mismatch',
        'cross_company_scope_conflict',
        'internal_transfer_pair_break',
        'duplicate_bank_observation',
      ],
      systemMayDo: ['按固定差异类目聚类'],
      systemMustNotDo: ['不得自动下结论说差异已解决'],
      note: '差异分类是后续异常单和月结评审的输入。',
    },
    {
      stage: 'exception_ticket_drafting',
      inputs: ['差异分类结果'],
      outputs: ['exception_ticket_reference'],
      systemMayDo: ['自动起草异常单', '自动挂载证据链'],
      systemMustNotDo: ['不得自动审批异常单'],
      note: '系统只能起草，不能定责。',
    },
    {
      stage: 'month_end_review',
      inputs: ['差异分类', '异常单处理状态', 'audit_trace_reference'],
      outputs: ['月结评审材料', 'opening_carry_forward 候选'],
      systemMayDo: ['生成只读月结包'],
      systemMustNotDo: ['不得自动生成 opening_carry_forward'],
      note: '是否结转必须由人工月结通过。',
    },
  ],
  exceptionTypes: [
    {
      code: 'statement_line_unmatched',
      trigger: '银行流水有行，账本没有对应分录或引用。',
      defaultQueue: 'finance_data_review',
      requiredEvidence: ['statementLineId', 'accountScope evidence', '同月对照截图或摘要'],
      note: '这是最基本的漏挂接异常。',
    },
    {
      code: 'ledger_entry_missing_bank_evidence',
      trigger: '账本存在余额型分录，但银行侧没有可追溯证据。',
      defaultQueue: 'finance_audit',
      requiredEvidence: ['分录来源说明', '银行证据缺口说明', '人工处理建议'],
      note: '重点防止虚拟余额脱离银行证据漂移。',
    },
    {
      code: 'amount_mismatch',
      trigger: '银行金额与分录金额不一致。',
      defaultQueue: 'finance_data_review',
      requiredEvidence: ['银行金额', '分录金额', '金额差说明'],
      note: '不允许系统自动修正分录金额。',
    },
    {
      code: 'direction_mismatch',
      trigger: '银行方向与分录方向不一致。',
      defaultQueue: 'finance_audit',
      requiredEvidence: ['方向证据', '来源对象上下文', '审批控制链'],
      note: '尤其防止出款被错认成收款。',
    },
    {
      code: 'cross_company_scope_conflict',
      trigger: '同一条银行证据落到多个公司或多个作用域。',
      defaultQueue: 'joint_review',
      requiredEvidence: ['accountAlias/accountNoMasked', '固定映射版本', '作用域解释'],
      note: '这是多公司场景的高优先级异常。',
    },
    {
      code: 'internal_transfer_pair_break',
      trigger: '内部转账只找到一边或配对键不完整。',
      defaultQueue: 'finance_data_review',
      requiredEvidence: ['internalTransferGroupKey', '来源/目标作用域', '缺边说明'],
      note: '不得降级解释成外部收支。',
    },
    {
      code: 'duplicate_bank_observation',
      trigger: '同一银行证据疑似被重复导入或重复挂账。',
      defaultQueue: 'data_governance',
      requiredEvidence: ['bankTransactionReference/receiptReference', 'rawSourceDigest', '导入批次说明'],
      note: '重点防止重复记账。',
    },
    {
      code: 'month_opening_carry_forward_gap',
      trigger: '月初结转候选无法与上月人工月结材料对上。',
      defaultQueue: 'finance_audit',
      requiredEvidence: ['上月月结包', '本月候选结转', '差异说明'],
      note: '没有人工解释时不得生成 opening_carry_forward。',
    },
  ],
  exceptionWorkflow: [
    {
      step: 'auto_draft',
      owner: 'system',
      appliesTo: [
        'statement_line_unmatched',
        'ledger_entry_missing_bank_evidence',
        'amount_mismatch',
        'direction_mismatch',
        'cross_company_scope_conflict',
        'internal_transfer_pair_break',
        'duplicate_bank_observation',
        'month_opening_carry_forward_gap',
      ],
      output: '异常单草稿 + 证据挂接',
      note: '系统只能起草，不允许自动定责或关单。',
    },
    {
      step: 'reason_fill',
      owner: 'finance_data_review',
      appliesTo: [
        'statement_line_unmatched',
        'ledger_entry_missing_bank_evidence',
        'amount_mismatch',
        'direction_mismatch',
        'internal_transfer_pair_break',
        'month_opening_carry_forward_gap',
      ],
      output: '业务原因、差异说明、暂行处理建议',
      note: '业务原因由财务数据复核填写。',
    },
    {
      step: 'governance_reason_fill',
      owner: 'data_governance',
      appliesTo: ['cross_company_scope_conflict', 'duplicate_bank_observation'],
      output: '映射原因、字段契约原因、作用域冲突说明',
      note: '账户映射和契约类问题由治理补原因。',
    },
    {
      step: 'approval',
      owner: 'finance_audit',
      appliesTo: [
        'statement_line_unmatched',
        'ledger_entry_missing_bank_evidence',
        'amount_mismatch',
        'direction_mismatch',
        'cross_company_scope_conflict',
        'internal_transfer_pair_break',
        'duplicate_bank_observation',
        'month_opening_carry_forward_gap',
      ],
      output: '处理方向审批：继续观察 / 拒绝投影 / 允许只读保留 / 进入月结候选',
      note: '审批的是处理方向，不是直接修余额。',
    },
    {
      step: 'review',
      owner: 'joint_review',
      appliesTo: ['cross_company_scope_conflict'],
      output: '联合复核结论',
      note: '跨公司冲突必须 finance_audit + data_governance 联合复核。',
    },
    {
      step: 'review',
      owner: 'finance_data_review',
      appliesTo: [
        'statement_line_unmatched',
        'ledger_entry_missing_bank_evidence',
        'amount_mismatch',
        'internal_transfer_pair_break',
      ],
      output: '业务复核结论',
      note: '确认补证据后是否仍保留异常。',
    },
    {
      step: 'review',
      owner: 'data_governance',
      appliesTo: ['duplicate_bank_observation'],
      output: '治理复核结论',
      note: '确认是否为重复导入、重复映射或字段碰撞。',
    },
  ],
  auditLayers: [
    {
      layer: 'application',
      purpose: '记录谁看了什么、谁起了异常单、谁审批了只读处理方向、谁确认了月结候选。',
      currentState: 'implemented_required',
      mustLinkTo: ['currentUser', 'exception_ticket_reference', 'audit_trace_reference'],
      systemMustNotDo: ['不得省略人工确认痕迹', '不得只留最终结论不留过程'],
      note: '应用层审计回答“谁在什么时候做了什么判断”。',
    },
    {
      layer: 'database',
      purpose: '未来如落虚拟账本表、异常单表、月结表，必须记录 row-level 变更、版本与前后快照摘要。',
      currentState: 'blueprint_only',
      mustLinkTo: ['row hash', 'version', 'before/after digest'],
      systemMustNotDo: ['本轮不得落 schema', '本轮不得伪装成已实现'],
      note: '数据库层本轮只定义分层，不进入实现。',
    },
    {
      layer: 'external_system',
      purpose: '保留银行短信原文、厂家真实接口原始载荷、银行流水文件、回单 PDF、截图或附件摘要。',
      currentState: 'external_reference',
      mustLinkTo: ['rawSourceDigest', 'rawPayloadLocator', 'external evidence locator'],
      systemMustNotDo: ['不得把系统外证据直接解释成已入账结论'],
      note: '系统外层回答“原始证据从哪里来、如何追溯”。',
    },
  ],
  relationBoundaries: [
    {
      target: 'bank_sms_vendor_real_adapter',
      currentRole: '银行证据输入层',
      allowedReadOnlyUse: ['提供银行观测样本', '提供原始载荷摘要', '提供银行锚点'],
      allowedGeneratedEntries: ['bank_observation_reference'],
      forbiddenActions: ['不得直接改余额', '不得直接认定到账或出款'],
      note: 'bank-sms 与厂家真实接口只有观察权，没有记账权。',
    },
    {
      target: 'bank_truth_staging',
      currentRole: '只读 staging 层',
      allowedReadOnlyUse: ['把银行证据投影到月度核对层', '暴露差异候选'],
      allowedGeneratedEntries: ['bank_observation_reference', 'monthly_statement_reference'],
      forbiddenActions: ['不得绕过人工确认生成余额型分录'],
      note: 'staging 负责带证据，不负责记账。',
    },
    {
      target: 'bank_account_scope',
      currentRole: '公司归属与账户作用域边界层',
      allowedReadOnlyUse: ['把样本切到公司与作用域', '限制 compare 范围'],
      allowedGeneratedEntries: ['bank_observation_reference'],
      forbiddenActions: ['不得把公司归属直接写成余额变化'],
      note: '先解作用域，再谈账本。',
    },
    {
      target: 'approval_requests',
      currentRole: '审批控制链',
      allowedReadOnlyUse: ['解释支出为何存在审批上下文', '为异常单提供控制链证据'],
      allowedGeneratedEntries: ['approval_control_reference'],
      forbiddenActions: ['不得把审批通过直接解释成真实出款余额'],
      note: 'approval 继续只是控制链，不是银行主账。',
    },
    {
      target: 'payment_records',
      currentRole: '到账语义对象',
      allowedReadOnlyUse: ['参与到账 compare', '解释候选收款分录来源'],
      allowedGeneratedEntries: ['payment_business_reference'],
      forbiddenActions: ['不得把 payment_records 直接升级成余额来源'],
      note: 'payment 继续只是到账语义对象。',
    },
    {
      target: 'payout_records',
      currentRole: '出款登记对象',
      allowedReadOnlyUse: ['参与出款 compare', '解释候选支出分录来源'],
      allowedGeneratedEntries: ['payout_business_reference'],
      forbiddenActions: ['不得把 payout_records 直接升级成余额来源'],
      note: 'payout 继续只是登记对象。',
    },
    {
      target: 'fund_truth_reconciliations',
      currentRole: '资金真相对照与映射准备层',
      allowedReadOnlyUse: ['生成差异引用', '生成对照引用', '为月度核对提供差异聚类输入'],
      allowedGeneratedEntries: [
        'fund_truth_comparison_reference',
        'reconciliation_variance_reference',
      ],
      forbiddenActions: ['不得自动对账闭环', '不得自动修余额', '不得自动生成正式月结'],
      note: 'fund-truth 继续是对照层，不是自动记账层。',
    },
  ],
  nextGaps: [
    'companyScopeCode / virtualLedgerScopeKey / internalTransferGroupKey 的统一命名仍未正式收口。',
    '跨公司内部划拨的真实样本与冲突样本仍偏少，当前只能先定义边界。',
    '月结通过后由谁放行 opening_carry_forward 的最终授权口径仍未单独冻结。',
    '数据库层审计本轮只有分层蓝图，还没有行级落地方案。',
    '异常单严重级别与升级阈值还未固化成运营 SOP。',
    'fund_truth 到虚拟账本之间仍是引用层，还没有未来半自动投影阶段的授权门槛。',
  ],
  reviewChecklist: [
    '确认 opening_carry_forward 只能来自人工月结通过，不允许系统自动结转。',
    '确认 internal_transfer_in / internal_transfer_out 必须成对，不得回退成外部收支。',
    '确认月度银行流水核对层继续只产出差异和异常单，不做自动修余额。',
    '确认异常单填原因 / 审批 / 复核继续分属 finance_data_review / finance_audit / finance_data_review|data_governance。',
    '确认数据库层审计继续只是蓝图分层，未经过单独 schema 审查前不进入实现。',
    '确认 approval / payment / payout / bank-sms / fund-truth 继续保持边界对象定位，不升级成第三颗资金写入对象。',
  ],
};
