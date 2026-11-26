import { BankTruthReviewRole } from './bank-truth-input-contract';

export type MonthlyBankStatementRole =
  | 'system'
  | 'cashier'
  | BankTruthReviewRole
  | 'joint_review'
  | 'other_roles';

export type MonthlyBankStatementFieldRequirement = 'required' | 'conditional' | 'optional';

export type MonthlyBankStatementScopeStatus =
  | 'resolved_exact'
  | 'resolved_by_account_scope'
  | 'resolved_by_hint'
  | 'cross_company_conflict'
  | 'unresolved_manual_review';

export type MonthlyBankStatementComparisonStage =
  | 'statement_import_read_only'
  | 'account_scope_partition'
  | 'ledger_entry_comparison'
  | 'internal_transfer_pair_check'
  | 'directional_business_reference_check'
  | 'bank_truth_supporting_evidence_check'
  | 'variance_classification'
  | 'exception_ticket_drafting'
  | 'approval_and_review'
  | 'month_end_candidate_review';

export type MonthlyBankStatementVarianceCode =
  | 'bank_has_internal_missing'
  | 'internal_has_bank_missing'
  | 'amount_mismatch'
  | 'time_window_mismatch'
  | 'internal_transfer_misclassified'
  | 'duplicate_booking_risk'
  | 'unapproved_payout'
  | 'account_scope_unknown'
  | 'bank_virtual_balance_mismatch';

export interface MonthlyBankStatementImportFieldDefinition {
  field: string;
  requirement: MonthlyBankStatementFieldRequirement;
  purpose: string;
  note: string;
  presenceRule?: string;
}

export interface MonthlyBankStatementScopePartitionRule {
  status: MonthlyBankStatementScopeStatus;
  entryRule: string;
  routeTo: string;
  allowedNextStages: MonthlyBankStatementComparisonStage[];
  note: string;
}

export interface MonthlyBankStatementComparisonStep {
  order: number;
  stage: MonthlyBankStatementComparisonStage;
  objective: string;
  orderedReadOnlyTargets: string[];
  outputs: string[];
  note: string;
}

export interface MonthlyBankStatementVarianceDefinition {
  code: MonthlyBankStatementVarianceCode;
  label: string;
  defaultOwner: 'finance_data_review' | 'finance_audit' | 'data_governance' | 'joint_review';
  monthEndEffect: 'freeze' | 'candidate_after_approval';
  trigger: string;
  note: string;
}

export interface MonthlyBankStatementExceptionGroupingRule {
  varianceCode: MonthlyBankStatementVarianceCode;
  groupingKey: string[];
  routeTo: 'finance_data_review' | 'finance_audit' | 'data_governance' | 'joint_review';
  note: string;
}

export interface MonthlyBankStatementExceptionWorkflowStep {
  step:
    | 'import'
    | 'auto_draft'
    | 'reason_fill'
    | 'governance_reason_fill'
    | 'approval'
    | 'review';
  owner: MonthlyBankStatementRole;
  appliesTo: MonthlyBankStatementVarianceCode[] | ['all'];
  output: string;
  note: string;
}

export interface MonthlyBankStatementMonthEndCandidateRule {
  ruleKey: string;
  entryCriteria: string[];
  blockedBy: MonthlyBankStatementVarianceCode[];
  output: string;
  note: string;
}

export interface MonthlyBankStatementManualFreezeCondition {
  code: string;
  scenario: string;
  owner: 'finance_data_review' | 'finance_audit' | 'data_governance' | 'joint_review';
  releaseConditions: string[];
}

export interface MonthlyBankStatementRoleBoundary {
  role: MonthlyBankStatementRole;
  allowedActions: string[];
  forbiddenActions: string[];
}

export interface MonthlyBankStatementExistingObjectBoundary {
  target:
    | 'multi_company_virtual_ledger'
    | 'approval_requests'
    | 'payment_records'
    | 'payout_records'
    | 'bank_sms'
    | 'fund_truth_reconciliations';
  currentRole: string;
  allowedReadOnlyUse: string[];
  forbiddenActions: string[];
}

export interface MonthlyBankStatementReconciliationBlueprint {
  blueprintCode: string;
  version: string;
  mode: 'read_only_blueprint';
  stage: 'F7.8';
  scope: string;
  continuityNotes: string[];
  upstreamBlueprints: string[];
  hardGuards: string[];
  nonGoals: string[];
  importFields: MonthlyBankStatementImportFieldDefinition[];
  scopePartitionRules: MonthlyBankStatementScopePartitionRule[];
  comparisonSteps: MonthlyBankStatementComparisonStep[];
  varianceDefinitions: MonthlyBankStatementVarianceDefinition[];
  exceptionGroupingRules: MonthlyBankStatementExceptionGroupingRule[];
  exceptionWorkflow: MonthlyBankStatementExceptionWorkflowStep[];
  monthEndCandidateRules: MonthlyBankStatementMonthEndCandidateRule[];
  manualFreezeConditions: MonthlyBankStatementManualFreezeCondition[];
  roleBoundaries: MonthlyBankStatementRoleBoundary[];
  existingObjectBoundaries: MonthlyBankStatementExistingObjectBoundary[];
  nextGaps: string[];
  reviewChecklist: string[];
}

export const MONTHLY_BANK_STATEMENT_RECONCILIATION_BLUEPRINT: MonthlyBankStatementReconciliationBlueprint =
  {
    blueprintCode: 'fund_truth.monthly_bank_statement_reconciliation_blueprint',
    version: '2026-04-17.f7.8-monthly-bank-statement-reconciliation-blueprint',
    mode: 'read_only_blueprint',
    stage: 'F7.8',
    scope:
      '定义出纳按月导入银行流水后的最小字段、账户作用域分层、核对顺序、差异类型、异常单流程、审批复核边界，以及月结候选与人工冻结规则。',
    continuityNotes: [
      '30号多公司虚拟账本边界成立，本蓝图只复用月度核对层，不改余额语义。',
      'opening_carry_forward 只能通过人工月结放行，不得由导入或核对自动生成。',
      'internal_transfer_in / internal_transfer_out 必须成对；配对缺失只能进入差异与异常单。',
      '月度核对层只产出差异、异常单和月结候选材料，不自动修余额。',
      's1-03 report summary API=500 / ENOBUFS 红灯单独跟踪，不阻塞本蓝图。',
    ],
    upstreamBlueprints: [
      'fund_truth.bank_truth_input_contract@2026-04-16.f6-read-only-blueprint',
      'fund_truth.bank_truth_staging_blueprint@2026-04-16.f7-read-only-staging-blueprint',
      'fund_truth.multi_company_bank_account_scope_blueprint@2026-04-17.f7.6-multi-company-account-scope-blueprint',
      'fund_truth.multi_company_virtual_ledger_blueprint@2026-04-17.f7.7-multi-company-virtual-ledger-blueprint',
    ],
    hardGuards: [
      '不破坏 S1-03 三条稳定链',
      '不自动推进正式工资',
      '不跳过人工确认层',
      '不改工资公式',
      '不改 confirmed / inferred / uncertain',
      '不改 included / pending / excluded',
      '不把车牌号当主绑定键，手机号仍是唯一主键',
      '不混淆三类购物卡',
      '不重新引入 JSON_OVERLAPS',
      '不回退 currentUser 透传',
      '不改数据库 schema',
      '不做任何写入逻辑',
      '不接 AI focus',
      '不做银行流水正式落库',
      '不做虚拟余额自动修复',
      '不做自动对账闭环',
      '不扩第三颗资金写入对象',
    ],
    nonGoals: [
      '不新增银行流水主表、staging 表或导入落库实现',
      '不新增月结自动关账、自动结转或自动冲销能力',
      '不把 approval/payment/payout/bank-sms/fund_truth/虚拟账本变成自动改账入口',
      '不新增 payout_records 命令壳或其他资金写命令',
      '不改任何审批、到账、出款、工资、AI 的既有状态机',
    ],
    importFields: [
      { field: 'statementMonth', requirement: 'required', purpose: '绑定月份', note: '所有差异和候选必须归属月份' },
      { field: 'importBatchId', requirement: 'required', purpose: '标识导入批次', note: '只做审计和回放' },
      { field: 'sourceFileDigest', requirement: 'required', purpose: '标识源文件摘要', note: '只做文件去重' },
      { field: 'bankCode', requirement: 'required', purpose: '标识银行通道', note: '不能单独推出公司归属' },
      { field: 'accountAlias', requirement: 'conditional', purpose: '标识账户别名', note: '与 bankCode / accountNoMasked 构成作用域锚点', presenceRule: 'accountAlias 与 accountNoMasked 至少提供一个' },
      { field: 'accountNoMasked', requirement: 'conditional', purpose: '标识脱敏账号', note: '不能替代业务主键', presenceRule: 'accountAlias 与 accountNoMasked 至少提供一个' },
      { field: 'lineSequence', requirement: 'required', purpose: '标识文件内行序号', note: '配合批次定位源行' },
      { field: 'direction', requirement: 'required', purpose: '标识收支方向', note: 'in 不能硬挂 payout/approval，out 不能硬挂 payment' },
      { field: 'amount', requirement: 'required', purpose: '标识金额事实', note: '不能单独推出业务结论' },
      { field: 'balanceAfter', requirement: 'conditional', purpose: '标识行后余额', note: '若缺失至少要有 statementClosingBalance', presenceRule: '若无 balanceAfter，必须提供 statementClosingBalance 才能评估 bank_virtual_balance_mismatch' },
      { field: 'occurredAt', requirement: 'required', purpose: '标识发生时间', note: '统一展示 YYYY-MM-DD HH:mm:ss' },
      { field: 'summary', requirement: 'required', purpose: '保留银行摘要', note: '只做人工核对线索' },
      { field: 'counterpartyName', requirement: 'optional', purpose: '展示对手方', note: '不能独立推出公司归属' },
      { field: 'bankTransactionReference', requirement: 'conditional', purpose: '标识银行流水号', note: '优先作为银行事件锚点', presenceRule: 'bankTransactionReference / bankReceiptReference / statementLineId 至少提供一个' },
      { field: 'bankReceiptReference', requirement: 'conditional', purpose: '标识回单号', note: '缺账户作用域时不能跨账户合并', presenceRule: 'bankTransactionReference / bankReceiptReference / statementLineId 至少提供一个' },
      { field: 'statementLineId', requirement: 'conditional', purpose: '标识账单行号', note: '只在导入批次+账户作用域内稳定', presenceRule: 'bankTransactionReference / bankReceiptReference / statementLineId 至少提供一个' },
      { field: 'statementOpeningBalance', requirement: 'conditional', purpose: '标识月初余额', note: '只做月度余额校验' },
      { field: 'statementClosingBalance', requirement: 'conditional', purpose: '标识月末余额', note: '只做 bank_virtual_balance_mismatch 输入' },
    ],
    scopePartitionRules: [
      {
        status: 'resolved_exact',
        entryRule: 'bankCode + accountAlias + accountNoMasked 唯一命中治理映射',
        routeTo: 'company_read_only_scope_pool',
        allowedNextStages: ['ledger_entry_comparison', 'internal_transfer_pair_check', 'directional_business_reference_check', 'bank_truth_supporting_evidence_check', 'variance_classification', 'exception_ticket_drafting', 'approval_and_review', 'month_end_candidate_review'],
        note: '只有 resolved_exact 才能直接进入完整核对顺序',
      },
      {
        status: 'resolved_by_account_scope',
        entryRule: '只靠 bankCode + accountAlias 或 bankCode + accountNoMasked 形成唯一作用域',
        routeTo: 'company_read_only_scope_pool',
        allowedNextStages: ['ledger_entry_comparison', 'internal_transfer_pair_check', 'directional_business_reference_check', 'bank_truth_supporting_evidence_check', 'variance_classification', 'exception_ticket_drafting', 'approval_and_review', 'month_end_candidate_review'],
        note: '可以进入核对，但不能跳过 finance_data_review 初核',
      },
      {
        status: 'resolved_by_hint',
        entryRule: '只能靠设备、通道、业务候选或对手方等弱线索推测',
        routeTo: 'company_manual_review_queue',
        allowedNextStages: ['variance_classification', 'exception_ticket_drafting', 'approval_and_review'],
        note: '只能生成 account_scope_unknown 并进入人工层',
      },
      {
        status: 'cross_company_conflict',
        entryRule: '同一导入行落到多个公司或多个作用域',
        routeTo: 'data_governance_conflict_queue',
        allowedNextStages: ['variance_classification', 'exception_ticket_drafting', 'approval_and_review'],
        note: '必须由 data_governance 收口',
      },
      {
        status: 'unresolved_manual_review',
        entryRule: '缺少稳定账户线索，无法形成唯一作用域',
        routeTo: 'global_manual_review_queue',
        allowedNextStages: ['variance_classification', 'exception_ticket_drafting', 'approval_and_review'],
        note: '没有稳定作用域时不能进入公司只读核对池',
      },
    ],
    comparisonSteps: [
      { order: 1, stage: 'statement_import_read_only', objective: '固定导入批次与源文件摘要', orderedReadOnlyTargets: [], outputs: ['monthly statement line pool', 'import audit digest'], note: '导入动作只负责把证据带进来' },
      { order: 2, stage: 'account_scope_partition', objective: '先按账户作用域与公司归属分层', orderedReadOnlyTargets: ['multi_company_virtual_ledger'], outputs: ['company_read_only_scope_pool', 'company_manual_review_queue', 'data_governance_conflict_queue'], note: '账户作用域分层永远先于业务对象核对' },
      { order: 3, stage: 'ledger_entry_comparison', objective: '先对多公司虚拟账本余额型分录与月度引用层做只读比对', orderedReadOnlyTargets: ['multi_company_virtual_ledger'], outputs: ['matched ledger candidates', 'unmatched ledger candidates', 'balance comparison snapshot'], note: '先看账本分录，再看业务引用' },
      { order: 4, stage: 'internal_transfer_pair_check', objective: '先识别内部转账成对关系', orderedReadOnlyTargets: ['multi_company_virtual_ledger'], outputs: ['paired internal transfers', 'internal transfer mismatch set'], note: '内部转账误判必须先被拦住' },
      { order: 5, stage: 'directional_business_reference_check', objective: '按收支方向核对业务对象，但只作为引用来源', orderedReadOnlyTargets: ['payment_records', 'payout_records', 'approval_requests'], outputs: ['directional business reference snapshot'], note: 'direction=in 先看 payment，direction=out 先看 payout 再看 approval' },
      { order: 6, stage: 'bank_truth_supporting_evidence_check', objective: '补看 bank-sms 与 fund_truth 的支持证据', orderedReadOnlyTargets: ['bank_sms', 'fund_truth_reconciliations'], outputs: ['supporting evidence snapshot', 'evidence gap summary'], note: '证据层不升级为自动改账层' },
      { order: 7, stage: 'variance_classification', objective: '把未闭合结果收口成固定差异类型', orderedReadOnlyTargets: [], outputs: ['variance set', 'freeze set', 'candidate-precheck set'], note: '只允许差异分类，不允许差异自动消失' },
      { order: 8, stage: 'exception_ticket_drafting', objective: '按差异类型自动起草异常单', orderedReadOnlyTargets: [], outputs: ['exception ticket drafts'], note: '系统只起草，不定责' },
      { order: 9, stage: 'approval_and_review', objective: '进入 finance_data_review / finance_audit / data_governance 的人工流转', orderedReadOnlyTargets: [], outputs: ['approved handling direction', 'review notes', 'frozen items'], note: '审批和复核只决定处理方向' },
      { order: 10, stage: 'month_end_candidate_review', objective: '只产生月结候选材料', orderedReadOnlyTargets: ['multi_company_virtual_ledger'], outputs: ['month_end_candidate_packet', 'manual_freeze_packet'], note: '绝不自动形成正式月结结论' },
    ],
    varianceDefinitions: [
      { code: 'bank_has_internal_missing', label: '银行有、内部无', defaultOwner: 'finance_data_review', monthEndEffect: 'freeze', trigger: '银行流水存在，但账本分录和业务引用都没有稳定解释', note: '只能冻结，不得自动补账' },
      { code: 'internal_has_bank_missing', label: '内部有、银行无', defaultOwner: 'finance_data_review', monthEndEffect: 'freeze', trigger: '内部分录或业务引用存在，但没有银行证据', note: '不能靠内部对象自动兜底' },
      { code: 'amount_mismatch', label: '金额不一致', defaultOwner: 'finance_data_review', monthEndEffect: 'freeze', trigger: '银行金额与账本/业务金额不一致', note: '不允许近似相等自动放过' },
      { code: 'time_window_mismatch', label: '时间窗口不一致', defaultOwner: 'finance_data_review', monthEndEffect: 'candidate_after_approval', trigger: '时间存在跨月/跨窗口偏移，但金额和方向可解释', note: '唯一可在审计批准后进入候选的差异类型' },
      { code: 'internal_transfer_misclassified', label: '内部转账误判', defaultOwner: 'finance_audit', monthEndEffect: 'freeze', trigger: '内部划拨被误判成外部收支或只发现单边', note: '不能被回写成外部收入或支出' },
      { code: 'duplicate_booking_risk', label: '重复记账风险', defaultOwner: 'finance_audit', monthEndEffect: 'freeze', trigger: '同一银行锚点或业务锚点出现重复占用', note: '必须先去重，再谈月结候选' },
      { code: 'unapproved_payout', label: '无审批支出', defaultOwner: 'finance_audit', monthEndEffect: 'freeze', trigger: '支出发生但审批控制链缺失', note: '不能因银行真实发生就自动合法化' },
      { code: 'account_scope_unknown', label: '账户归属不明', defaultOwner: 'data_governance', monthEndEffect: 'freeze', trigger: '公司归属或账户作用域不能稳定落到唯一映射', note: '所有业务核对都只能停留在人工层' },
      { code: 'bank_virtual_balance_mismatch', label: '银行余额与虚拟余额不一致', defaultOwner: 'finance_audit', monthEndEffect: 'freeze', trigger: 'statementClosingBalance 与虚拟账本月末快照不一致', note: '只能形成冻结包，不允许系统自动修余额' },
    ],
    exceptionGroupingRules: [
      { varianceCode: 'bank_has_internal_missing', groupingKey: ['statementMonth', 'companyScopeCode', 'virtualLedgerScopeKey', 'statementLineId'], routeTo: 'finance_data_review', note: '按单行起草' },
      { varianceCode: 'internal_has_bank_missing', groupingKey: ['statementMonth', 'companyScopeCode', 'virtualLedgerScopeKey', 'linkedObjectRef'], routeTo: 'finance_data_review', note: '按内部主引用起草' },
      { varianceCode: 'amount_mismatch', groupingKey: ['statementMonth', 'companyScopeCode', 'virtualLedgerScopeKey', 'primaryAnchorDigest'], routeTo: 'finance_data_review', note: '按主锚点聚合' },
      { varianceCode: 'time_window_mismatch', groupingKey: ['statementMonth', 'companyScopeCode', 'virtualLedgerScopeKey', 'primaryAnchorDigest'], routeTo: 'finance_data_review', note: '按跨月主锚点聚合' },
      { varianceCode: 'internal_transfer_misclassified', groupingKey: ['statementMonth', 'internalTransferGroupKey'], routeTo: 'joint_review', note: '必须按 internalTransferGroupKey 聚合' },
      { varianceCode: 'duplicate_booking_risk', groupingKey: ['statementMonth', 'duplicateAnchorKey'], routeTo: 'joint_review', note: '必须按重复锚点聚合' },
      { varianceCode: 'unapproved_payout', groupingKey: ['statementMonth', 'companyScopeCode', 'statementLineId'], routeTo: 'finance_audit', note: '直接进入审计队列' },
      { varianceCode: 'account_scope_unknown', groupingKey: ['statementMonth', 'bankCode', 'accountAlias', 'accountNoMasked'], routeTo: 'data_governance', note: '按作用域线索聚合' },
      { varianceCode: 'bank_virtual_balance_mismatch', groupingKey: ['statementMonth', 'companyScopeCode', 'virtualLedgerScopeKey'], routeTo: 'finance_audit', note: '按月+作用域聚合' },
    ],
    exceptionWorkflow: [
      { step: 'import', owner: 'cashier', appliesTo: ['all'], output: '导入批次、源文件摘要、导入备注', note: '出纳只负责导入和来源说明' },
      { step: 'auto_draft', owner: 'system', appliesTo: ['all'], output: '异常单草稿', note: '系统只起草，不审批，不关单，不改账' },
      { step: 'reason_fill', owner: 'finance_data_review', appliesTo: ['bank_has_internal_missing', 'internal_has_bank_missing', 'amount_mismatch', 'time_window_mismatch', 'unapproved_payout'], output: '业务原因、差异解释、补证要求', note: 'finance_data_review 负责初核与原因补充' },
      { step: 'governance_reason_fill', owner: 'data_governance', appliesTo: ['account_scope_unknown'], output: '映射冲突说明、契约缺口说明', note: '作用域、映射、契约冲突由 data_governance 负责' },
      { step: 'approval', owner: 'finance_audit', appliesTo: ['all'], output: '处理方向审批', note: 'finance_audit 只审批方向，不审批自动修余额' },
      { step: 'review', owner: 'joint_review', appliesTo: ['internal_transfer_misclassified', 'duplicate_booking_risk', 'bank_virtual_balance_mismatch'], output: '复核结论、冻结或候选建议', note: '高风险差异需要联合复核' },
    ],
    monthEndCandidateRules: [
      { ruleKey: 'clean_scope_and_no_freeze_variance', entryCriteria: ['账户作用域只能是 resolved_exact 或 resolved_by_account_scope', '没有 freeze 类差异残留', 'internal_transfer_in / internal_transfer_out 已配对', 'finance_data_review 已完成初核', 'finance_audit 已确认允许进入月结候选'], blockedBy: ['bank_has_internal_missing', 'internal_has_bank_missing', 'amount_mismatch', 'internal_transfer_misclassified', 'duplicate_booking_risk', 'unapproved_payout', 'account_scope_unknown', 'bank_virtual_balance_mismatch'], output: 'month_end_candidate_packet', note: '候选包只说明可进入人工月结评估' },
      { ruleKey: 'time_window_mismatch_can_enter_after_audit', entryCriteria: ['唯一剩余差异是 time_window_mismatch', 'finance_data_review 已补跨月说明', 'finance_audit 已批准允许进入月结候选'], blockedBy: ['bank_has_internal_missing', 'internal_has_bank_missing', 'amount_mismatch', 'internal_transfer_misclassified', 'duplicate_booking_risk', 'unapproved_payout', 'account_scope_unknown', 'bank_virtual_balance_mismatch'], output: 'month_end_candidate_packet_with_cross_month_note', note: '跨月窗口差异是唯一可审批后带说明入候选的差异' },
      { ruleKey: 'candidate_is_not_close', entryCriteria: ['候选包已经形成，但尚未完成人工月结'], blockedBy: [], output: 'month_end_candidate_only', note: '没有人工月结通过，绝不能生成 opening_carry_forward' },
    ],
    manualFreezeConditions: [
      { code: 'freeze_unresolved_scope', scenario: 'resolved_by_hint / cross_company_conflict / unresolved_manual_review 样本', owner: 'data_governance', releaseConditions: ['补齐固定映射', '形成唯一 companyScopeCode + virtualLedgerScopeKey'] },
      { code: 'freeze_internal_transfer_break', scenario: 'internal_transfer_in / internal_transfer_out 缺一边或误判为外部收支', owner: 'joint_review', releaseConditions: ['找到成对 internal transfer 证据', 'finance_audit 同意解冻'] },
      { code: 'freeze_duplicate_risk', scenario: '存在重复记账风险或同一锚点多占用', owner: 'joint_review', releaseConditions: ['唯一候选被人工确认', '其他候选留痕驳回'] },
      { code: 'freeze_unapproved_payout', scenario: '支出缺审批控制链', owner: 'finance_audit', releaseConditions: ['补齐审批链', 'finance_audit 重新批准处理方向'] },
      { code: 'freeze_balance_gap', scenario: 'statementClosingBalance 与虚拟账本月末余额不一致', owner: 'finance_audit', releaseConditions: ['差额被人工解释', '仍需通过单独人工月结确认'] },
    ],
    roleBoundaries: [
      { role: 'system', allowedActions: ['校验最小字段', '生成差异', '起草异常单', '输出月结候选包和冻结包'], forbiddenActions: ['不得改账', '不得改 approval/payment/payout 状态', '不得生成 opening_carry_forward'] },
      { role: 'cashier', allowedActions: ['导入月度流水', '补充导入背景说明', '确认源文件完整性'], forbiddenActions: ['不得裁定差异', '不得改账户映射', '不得改任何账务对象'] },
      { role: 'finance_data_review', allowedActions: ['初核差异', '补业务原因', '整理补证需求', '参与复核'], forbiddenActions: ['不得绕过 finance_audit 审批', '不得直接改账', '不得把 pending 变 included'] },
      { role: 'finance_audit', allowedActions: ['审批处理方向', '决定是否允许进入月结候选', '裁定高风险项'], forbiddenActions: ['不得直接修余额', '不得把审批方向等同自动改账', '不得改 confirmed/inferred/uncertain'] },
      { role: 'data_governance', allowedActions: ['处理映射冲突', '解释作用域和契约缺口', '参与高风险复核'], forbiddenActions: ['不得把弱线索写成正式余额事实', '不得直接改账'] },
      { role: 'joint_review', allowedActions: ['只复核 internal_transfer_misclassified / duplicate_booking_risk / bank_virtual_balance_mismatch', '给出冻结、解冻或候选建议'], forbiddenActions: ['不得接手低风险常规差异', '不得绕过异常单流程', '不得直接改账'] },
      { role: 'other_roles', allowedActions: ['查看只读核对结果'], forbiddenActions: ['不得直接改账', '不得改异常单处理方向', '不得越权审批或复核'] },
    ],
    existingObjectBoundaries: [
      { target: 'multi_company_virtual_ledger', currentRole: '余额型分录与引用型分录的只读核对对象', allowedReadOnlyUse: ['比较余额快照', '看 internal transfer 配对', '生成只读余额说明'], forbiddenActions: ['不得自动修余额', '不得自动补分录', '不得自动关账'] },
      { target: 'approval_requests', currentRole: '审批控制对象', allowedReadOnlyUse: ['解释支出控制链', '核对 approvalNo 背景'], forbiddenActions: ['不得改审批状态', '不得把审批通过当真实出款完成'] },
      { target: 'payment_records', currentRole: '到账语义对象', allowedReadOnlyUse: ['解释 direction=in 的到账上下文', '核对 paymentNo / workOrderNo'], forbiddenActions: ['不得改 amount / paymentStatus / paidAt', '不得把 payment_records 升格成银行真相源'] },
      { target: 'payout_records', currentRole: '出款登记对象', allowedReadOnlyUse: ['解释 direction=out 的付款登记上下文', '核对 payoutNo / approvalNo'], forbiddenActions: ['不得改 amount / paidAt / paymentMethod', '不得把 payout_records 变成自动改账入口'] },
      { target: 'bank_sms', currentRole: '银行证据输入层', allowedReadOnlyUse: ['补支持证据', '回看短信/接口摘要和原始载荷定位'], forbiddenActions: ['不得直接认定到账', '不得直接认定出款', '不得直接触发余额变化'] },
      { target: 'fund_truth_reconciliations', currentRole: '只读对照与映射准备层', allowedReadOnlyUse: ['补 compare 摘要', '补映射缺口与证据缺口'], forbiddenActions: ['不得自动对账闭环', '不得自动修余额', '不得自动生成正式月结'] },
    ],
    nextGaps: [
      '导入文件格式仍未统一到单一模板',
      'bank virtual balance mismatch 的差额拆分口径仍需要审计 SOP',
      '月结候选包与冻结包的展示界面和操作日志尚未实现',
      '跨公司内部转账真实样本仍偏少',
      '既有 approver summary API=500 / ENOBUFS 仍需单独治理',
    ],
    reviewChecklist: [
      '确认导入字段只定义只读核对最小集合',
      '确认账户作用域分层先于业务对象核对',
      '确认 9 类差异都能落到异常单，并明确 owner / approval / review',
      '确认 joint_review 只用于高风险差异复核',
      '确认 approval/payment/payout/bank-sms/fund_truth/虚拟账本 保持只读引用',
      '确认月结候选不自动生成 opening_carry_forward',
      '确认 bank_virtual_balance_mismatch 继续只生成冻结包',
    ],
  };
