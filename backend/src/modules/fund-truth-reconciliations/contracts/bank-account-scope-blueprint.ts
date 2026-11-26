import { BankTruthReviewRole } from './bank-truth-input-contract';
import { BankTruthAdaptationTarget } from './bank-truth-staging-blueprint';

export type BankAccountScopeAttributionStatus =
  | 'resolved_exact'
  | 'resolved_by_account_scope'
  | 'resolved_by_hint'
  | 'unresolved_manual_review';

export type BankAccountScopeReadOnlyDestination =
  | 'company_read_only_scope_pool'
  | 'company_manual_review_queue'
  | 'finance_audit_queue'
  | 'global_manual_review_queue';

export type BankAccountScopeAnchorStrength = 'strong' | 'weak' | 'not_anchor';

export type BankAccountScopeRelationType =
  | 'read_only_candidate_filter'
  | 'supporting_control_context'
  | 'replica_compare'
  | 'business_bridge_context';

export interface BankAccountScopeFieldDefinition {
  field: string;
  requirement: 'required' | 'conditional' | 'optional';
  purpose: string;
  note: string;
  presenceRule?: string;
}

export interface BankAccountScopeAnchorDefinition {
  key: string;
  strength: BankAccountScopeAnchorStrength;
  fields: string[];
  resolutionEffect: string;
  note: string;
}

export interface BankAccountScopeStatusPolicy {
  status: BankAccountScopeAttributionStatus;
  entryRule: string;
  readOnlyDestination: BankAccountScopeReadOnlyDestination;
  systemMayDo: string[];
  systemMustNotDo: string[];
  humanRequired: string[];
}

export interface BankAccountScopeManualReviewBoundary {
  scenario: string;
  reviewers: BankTruthReviewRole[];
  queue: BankAccountScopeReadOnlyDestination;
  systemBehavior: string;
}

export interface BankAccountScopeVirtualLedgerBoundary {
  ruleKey: string;
  readOnlyDestination: BankAccountScopeReadOnlyDestination;
  rule: string;
  forbiddenActions: string[];
  note: string;
}

export interface BankAccountScopeExistingObjectRelation {
  objectType: BankTruthAdaptationTarget;
  relationType: BankAccountScopeRelationType;
  allowedReadOnlyUse: string[];
  forbiddenAutomaticConclusions: string[];
  note: string;
}

export interface BankAccountScopeFixedMappingRule {
  mappingKey: string;
  requiredFields: string[];
  resolvedStatus: 'resolved_exact' | 'resolved_by_account_scope';
  governanceOwner: BankTruthReviewRole;
  note: string;
}

export interface BankAccountScopeBlueprint {
  blueprintCode: string;
  version: string;
  mode: 'read_only_blueprint';
  stage: 'F7.6';
  scope: string;
  upstreamBlueprints: string[];
  hardGuards: string[];
  nonGoals: string[];
  fieldDefinitions: BankAccountScopeFieldDefinition[];
  fixedAccountMappingRules: BankAccountScopeFixedMappingRule[];
  strongAnchors: BankAccountScopeAnchorDefinition[];
  weakAnchors: BankAccountScopeAnchorDefinition[];
  explicitNonAnchors: BankAccountScopeAnchorDefinition[];
  attributionStatusPolicies: BankAccountScopeStatusPolicy[];
  manualReviewBoundaries: BankAccountScopeManualReviewBoundary[];
  virtualLedgerBoundaries: BankAccountScopeVirtualLedgerBoundary[];
  existingObjectRelations: BankAccountScopeExistingObjectRelation[];
  nextGaps: string[];
  reviewChecklist: string[];
}

export const BANK_ACCOUNT_SCOPE_BLUEPRINT: BankAccountScopeBlueprint = {
  blueprintCode: 'fund_truth.multi_company_bank_account_scope_blueprint',
  version: '2026-04-17.f7.6-multi-company-account-scope-blueprint',
  mode: 'read_only_blueprint',
  stage: 'F7.6',
  scope:
    '定义银行短信与未来银行输入在多公司场景下的公司归属规则、账户作用域、人工复核边界，以及与虚拟账本和现有资金对象的只读挂接边界。',
  upstreamBlueprints: [
    'fund_truth.bank_truth_input_contract@2026-04-16.f6-read-only-blueprint',
    'fund_truth.bank_truth_staging_blueprint@2026-04-16.f7-read-only-staging-blueprint',
    'bank_sms_vendor_real_payload_mapping@2026-04-16.f7.6-read-only-adapter',
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
    '不做银行流水入库',
    '不做虚拟账户余额变更',
    '不做自动对账闭环',
    '不让短信输入直接改 payment / payout / approval / work_orders',
    '不把同一银行号码默认等同于同一公司',
    '不把 accountAlias / accountNoMasked 缺失时的短信自动归到某家公司',
    'projectionStatus 在当前只读阶段继续保持 not_projected',
  ],
  nonGoals: [
    '不新增第三颗资金写入对象',
    '不新增银行流水主表或 staging 落库实现',
    '不把公司归属结果升级成虚拟账本余额事实',
    '不把公司归属结果升级成到账 / 出款 / 审批完成事实',
    '不把 businessAnchorCandidate 升级为公司强绑定键',
  ],
  fieldDefinitions: [
    {
      field: 'sourceChannel',
      requirement: 'required',
      purpose: '标记未来银行输入来自短信、接口、导入或其他只读入口。',
      note: '它只定义银行输入来源通道，不定义公司归属。',
    },
    {
      field: 'bankCode',
      requirement: 'conditional',
      purpose: '定义账户映射作用域，例如 boc、cmb。',
      note: '固定账户映射应优先带 bankCode，避免跨银行别名误撞。',
      presenceRule: '当同时携带 fixedAccountMappingKey 时建议带上 bankCode，用于校验治理映射作用域一致性。',
    },
    {
      field: 'sourcePhone',
      requirement: 'optional',
      purpose: '保留短信发送号码，如 95566。',
      note: '它只说明银行通道来源，不说明属于哪家公司。',
    },
    {
      field: 'deviceId',
      requirement: 'optional',
      purpose: '标记采集设备。',
      note: '只可作为多公司归属弱线索，不能单独归公司。',
    },
    {
      field: 'simSlot',
      requirement: 'optional',
      purpose: '标记短信来自哪张卡槽。',
      note: '只可作为设备内的弱线索，不得自动写成公司账户。',
    },
    {
      field: 'receiverChannel',
      requirement: 'optional',
      purpose: '标记接收渠道，例如 android_sms_forwarder、vendor_api、manual_import。',
      note: '只用于说明采集路径，不承担公司归属主责。',
    },
    {
      field: 'accountAlias',
      requirement: 'optional',
      purpose: '账户别名。',
      note: '命中受治理的固定账户映射时，可作为公司强锚点。',
    },
    {
      field: 'accountNoMasked',
      requirement: 'optional',
      purpose: '脱敏账号。',
      note: '命中受治理的固定账户映射时，可作为公司强锚点。',
    },
    {
      field: 'fixedAccountMappingKey',
      requirement: 'optional',
      purpose: '治理侧维护的固定账户映射键。',
      note: '这是最稳定的公司归属锚点，只允许引用治理侧版本化映射，不允许现场自动生成或临时猜测补齐。',
    },
    {
      field: 'bankTransactionReference',
      requirement: 'optional',
      purpose: '标识银行事件本身。',
      note: '它是银行事件身份锚点，不是公司归属锚点。',
    },
    {
      field: 'bankReceiptReference',
      requirement: 'optional',
      purpose: '标识银行回单。',
      note: '没有账户作用域时不能反推公司归属。',
    },
    {
      field: 'statementLineId',
      requirement: 'optional',
      purpose: '标识账单行。',
      note: '没有账户作用域时不能反推公司归属。',
    },
    {
      field: 'businessAnchorCandidate',
      requirement: 'optional',
      purpose: '标识 paymentNo / payoutNo / approvalNo / workOrderNo 等业务候选锚点。',
      note: '它只能辅助排候选公司或候选对象，不等于公司已确认。',
    },
    {
      field: 'counterpartyName',
      requirement: 'optional',
      purpose: '标识对手方名称。',
      note: '它只能辅助人工核对，不得单独推导公司归属。',
    },
  ],
  fixedAccountMappingRules: [
    {
      mappingKey: 'bankCode + accountAlias + accountNoMasked -> fixedAccountMappingKey',
      requiredFields: ['bankCode', 'accountAlias', 'accountNoMasked'],
      resolvedStatus: 'resolved_exact',
      governanceOwner: 'data_governance',
      note:
        '当别名与尾号共同命中同一条固定账户映射，且唯一落到一个公司作用域时，才能视为 resolved_exact。',
    },
    {
      mappingKey: 'bankCode + accountAlias -> fixedAccountMappingKey',
      requiredFields: ['bankCode', 'accountAlias'],
      resolvedStatus: 'resolved_by_account_scope',
      governanceOwner: 'data_governance',
      note:
        '当别名在固定账户映射中唯一归属于一个公司时，可视为 resolved_by_account_scope；若一名多用，则必须退回人工复核。',
    },
    {
      mappingKey: 'bankCode + accountNoMasked -> fixedAccountMappingKey',
      requiredFields: ['bankCode', 'accountNoMasked'],
      resolvedStatus: 'resolved_by_account_scope',
      governanceOwner: 'data_governance',
      note:
        '当尾号在固定账户映射中唯一归属于一个公司时，可视为 resolved_by_account_scope；若多公司共享同尾号，则必须退回人工复核。',
    },
    {
      mappingKey: 'fixedAccountMappingKey -> companyScopeCode + virtualLedgerScopeKey(read_only)',
      requiredFields: ['fixedAccountMappingKey'],
      resolvedStatus: 'resolved_exact',
      governanceOwner: 'data_governance',
      note:
        '固定账户映射只允许由治理侧维护与版本化，不允许由短信正文、银行号码、业务单号现场反推生成。',
    },
  ],
  strongAnchors: [
    {
      key: 'fixedAccountMappingKey',
      strength: 'strong',
      fields: ['fixedAccountMappingKey'],
      resolutionEffect: '可直接把样本限定到唯一公司账户作用域。',
      note: '这是公司归属的首选强锚点，但仍只允许进入只读池。',
    },
    {
      key: 'accountAlias',
      strength: 'strong',
      fields: ['bankCode', 'accountAlias'],
      resolutionEffect: '命中唯一固定账户映射时，可把样本限定到唯一公司账户作用域。',
      note: 'accountAlias 本身不是自由文本别名，而是要命中治理侧映射才可升级为强锚点。',
    },
    {
      key: 'accountNoMasked',
      strength: 'strong',
      fields: ['bankCode', 'accountNoMasked'],
      resolutionEffect: '命中唯一固定账户映射时，可把样本限定到唯一公司账户作用域。',
      note: 'accountNoMasked 只允许脱敏值，且不能脱离 bankCode / 固定映射单独使用。',
    },
  ],
  weakAnchors: [
    {
      key: 'deviceId',
      strength: 'weak',
      fields: ['deviceId'],
      resolutionEffect: '只能缩小候选公司范围或分配人工队列。',
      note: '同一设备可能收多家公司短信，不能单独判公司。',
    },
    {
      key: 'simSlot',
      strength: 'weak',
      fields: ['simSlot'],
      resolutionEffect: '只能缩小候选公司范围或分配人工队列。',
      note: '同一设备多卡槽只能说明接收链路，不说明账户归属。',
    },
    {
      key: 'receiverChannel',
      strength: 'weak',
      fields: ['receiverChannel'],
      resolutionEffect: '只能解释采集路径，辅助人工确认作用域。',
      note: '渠道命中 vendor_api 或短信转发都不能直接等于公司归属。',
    },
    {
      key: 'businessAnchorCandidate',
      strength: 'weak',
      fields: ['businessAnchorCandidate'],
      resolutionEffect: '可以给出优先公司候选，但不能代替账户归属。',
      note:
        '命中 paymentNo / payoutNo / approvalNo / workOrderNo 只说明业务上下文，不说明公司账户已确认，也不说明到账或出款已确认。',
    },
    {
      key: 'counterpartyName',
      strength: 'weak',
      fields: ['counterpartyName'],
      resolutionEffect: '只能辅助人工判断候选公司是否合理。',
      note: '同名供应商、同名渠道商或财付通汇总都不能单独判公司。',
    },
  ],
  explicitNonAnchors: [
    {
      key: 'sourcePhone / sender_phone=95566',
      strength: 'not_anchor',
      fields: ['sourcePhone'],
      resolutionEffect: '只能锁定银行短信来源，不产生任何公司归属结论。',
      note: '同一个 95566 绝不默认等于同一家公司。',
    },
    {
      key: 'bankTransactionReference / bankReceiptReference / statementLineId without account scope',
      strength: 'not_anchor',
      fields: ['bankTransactionReference', 'bankReceiptReference', 'statementLineId'],
      resolutionEffect: '只能识别银行事件本身，不产生任何公司归属结论。',
      note: '缺少 accountAlias / accountNoMasked / fixedAccountMappingKey 时，不能反推公司。',
    },
    {
      key: 'amount / occurredAt',
      strength: 'not_anchor',
      fields: ['amount', 'occurredAt'],
      resolutionEffect: '只用于排序、比对或人工解释。',
      note: '金额和时间只能说明像不像，不能说明就是哪家公司。',
    },
    {
      key: 'workOrderNo / approvalNo / paymentNo / payoutNo direct hit',
      strength: 'not_anchor',
      fields: ['businessAnchorCandidate'],
      resolutionEffect: '只能回到业务上下文，不自动升级成公司归属、到账或出款确认。',
      note: '命中业务单号不等于命中公司账户，也不等于资金事实已成立。',
    },
  ],
  attributionStatusPolicies: [
    {
      status: 'resolved_exact',
      entryRule:
        'fixedAccountMappingKey 唯一命中一个公司，或 accountAlias + accountNoMasked 一起命中同一条固定账户映射且无冲突。',
      readOnlyDestination: 'company_read_only_scope_pool',
      systemMayDo: [
        '把样本路由到对应公司的只读对照池。',
        '展示 companyScopeCode、accountScopeKey 和命中的固定账户映射版本。',
        '在 approval/payment/payout/work_order/abc_sync_funds 的只读 compare 中缩小候选集合。',
      ],
      systemMustNotDo: [
        '不得改虚拟账本余额。',
        '不得改 approval_requests / payment_records / payout_records / abc_sync_funds / work_orders。',
        '不得改变 projectionStatus=not_projected 的当前只读边界。',
      ],
      humanRequired: [
        'finance_data_review 仍需确认后续只读 compare 是否可展示给业务或财务。',
      ],
    },
    {
      status: 'resolved_by_account_scope',
      entryRule:
        '仅凭 accountAlias 或 accountNoMasked 命中唯一固定账户映射，且没有任何跨公司冲突。',
      readOnlyDestination: 'company_read_only_scope_pool',
      systemMayDo: [
        '把样本路由到对应公司的只读对照池。',
        '提示这是账户作用域命中，而不是银行事件事实放行。',
      ],
      systemMustNotDo: [
        '不得把此状态写成 resolved_exact。',
        '不得改虚拟账本余额或任何业务对象状态。',
        '不得因为命中公司池就视为到账或出款确认。',
      ],
      humanRequired: [
        'finance_data_review 需确认该账户作用域在当前多公司场景下仍有效。',
      ],
    },
    {
      status: 'resolved_by_hint',
      entryRule:
        '没有强锚点，但 deviceId / simSlot / receiverChannel / businessAnchorCandidate / counterpartyName 等弱线索共同收敛到单一候选公司。',
      readOnlyDestination: 'company_manual_review_queue',
      systemMayDo: [
        '给出单一优先候选公司和弱线索摘要。',
        '把样本路由到对应公司的人工复核队列。',
      ],
      systemMustNotDo: [
        '不得进入公司只读对照池。',
        '不得生成固定账户映射。',
        '不得改虚拟账本余额或任何业务对象状态。',
      ],
      humanRequired: [
        'finance_data_review 负责初判。',
        'data_governance 负责判断是否需要补固定账户映射或补账户作用域定义。',
      ],
    },
    {
      status: 'unresolved_manual_review',
      entryRule:
        '强锚点缺失、强锚点互相冲突，或弱线索无法唯一收敛到单一候选公司。',
      readOnlyDestination: 'global_manual_review_queue',
      systemMayDo: [
        '保留所有原始线索、冲突项和候选公司。',
        '根据场景升级到 finance_audit_queue 或 data_governance 处理。',
      ],
      systemMustNotDo: [
        '不得默认归属到任何公司。',
        '不得进入任何公司的只读对照池。',
        '不得改虚拟账本余额或任何业务对象状态。',
      ],
      humanRequired: [
        'finance_data_review / finance_audit / data_governance 按场景介入，不允许系统跳过人工层。',
      ],
    },
  ],
  manualReviewBoundaries: [
    {
      scenario: 'accountAlias 与 accountNoMasked 分别命中不同公司，或一条固定映射被多公司共享。',
      reviewers: ['finance_audit', 'data_governance'],
      queue: 'finance_audit_queue',
      systemBehavior:
        '冻结自动归属，只暴露冲突事实与映射版本，不允许系统在多公司之间自动选边站。',
    },
    {
      scenario: 'accountAlias / accountNoMasked 缺失，仅凭 95566、deviceId、simSlot 或 receiverChannel 进行猜测。',
      reviewers: ['finance_data_review', 'data_governance'],
      queue: 'global_manual_review_queue',
      systemBehavior:
        '只能停留在 unresolved_manual_review，且必须显式提示“同一银行号码不能默认等于同一公司”。',
    },
    {
      scenario: '弱线索收敛到单一公司，但固定账户映射尚未建立。',
      reviewers: ['finance_data_review', 'data_governance'],
      queue: 'company_manual_review_queue',
      systemBehavior:
        '允许把样本送到候选公司人工队列，但不得进入 company_read_only_scope_pool，更不得现场补映射写回。',
    },
    {
      scenario: '样本命中 approvalNo / payoutNo 且方向为 out，需要结合审批链核实公司与账户关系。',
      reviewers: ['finance_audit', 'finance_data_review'],
      queue: 'finance_audit_queue',
      systemBehavior:
        '即使公司归属已解析，也只能进入审批相关只读 compare，不得视为真实出款已确认。',
    },
    {
      scenario: '需要新增、变更或废弃固定账户映射。',
      reviewers: ['data_governance'],
      queue: 'global_manual_review_queue',
      systemBehavior:
        '变更只允许走治理流程与版本化记录，不允许由短信解析、工作单命中或人工临时备注直接产生。',
    },
  ],
  virtualLedgerBoundaries: [
    {
      ruleKey: 'company_scope_is_not_virtual_balance',
      readOnlyDestination: 'company_read_only_scope_pool',
      rule: '公司归属成立只说明样本进入哪个公司的只读对照池，不说明该公司的虚拟余额应变化。',
      forbiddenActions: [
        '不得增加余额',
        '不得扣减余额',
        '不得生成余额流水',
        '不得生成对账闭环结论',
      ],
      note: '这是本轮最核心的虚拟账本边界。',
    },
    {
      ruleKey: 'resolved_by_hint_cannot_touch_ledger',
      readOnlyDestination: 'company_manual_review_queue',
      rule: 'resolved_by_hint 只能形成候选公司人工队列，不能形成任何账本挂接结论。',
      forbiddenActions: [
        '不得进入 company_read_only_scope_pool',
        '不得生成虚拟账本挂接键',
        '不得生成到账 / 出款 / 结算结论',
      ],
      note: '弱线索只能帮人看，不允许帮系统写。',
    },
    {
      ruleKey: 'no_account_scope_no_company_pool',
      readOnlyDestination: 'global_manual_review_queue',
      rule: '缺少 accountAlias / accountNoMasked / fixedAccountMappingKey 时，样本不得进入任何公司只读池。',
      forbiddenActions: [
        '不得默认归属公司',
        '不得生成公司账本池路由',
        '不得据此修改 approval/payment/payout/work_orders',
      ],
      note: '银行号码、银行流水号或业务单号都不能替代账户作用域。',
    },
  ],
  existingObjectRelations: [
    {
      objectType: 'approval_requests',
      relationType: 'supporting_control_context',
      allowedReadOnlyUse: [
        '在已解析公司作用域下缩小审批候选集合。',
        '展示 approvalNo 与公司账户作用域的只读 compare。',
      ],
      forbiddenAutomaticConclusions: [
        '不得把公司归属写成审批已通过。',
        '不得把命中 approvalNo 写成真实出款已确认。',
      ],
      note: 'approval_requests 仍是 supporting_source，不是银行主账。',
    },
    {
      objectType: 'payment_records',
      relationType: 'read_only_candidate_filter',
      allowedReadOnlyUse: [
        '在已解析公司作用域下缩小到账语义候选集合。',
        '展示 paymentNo 与公司账户作用域的只读 compare。',
      ],
      forbiddenAutomaticConclusions: [
        '不得把公司归属写成 payment_records 已被银行确认。',
        '不得反向改 work_orders.amountReceived。',
      ],
      note: 'payment_records 仍是 supporting_source，不因公司归属而升级为银行真相源。',
    },
    {
      objectType: 'payout_records',
      relationType: 'read_only_candidate_filter',
      allowedReadOnlyUse: [
        '在已解析公司作用域下缩小付款登记候选集合。',
        '展示 payoutNo 与公司账户作用域的只读 compare。',
      ],
      forbiddenAutomaticConclusions: [
        '不得把公司归属写成真实出款已完成。',
        '不得扩 payout_records 命令壳或写回付款状态。',
      ],
      note: 'payout_records 仍是 not_truth_source。',
    },
    {
      objectType: 'abc_sync_funds',
      relationType: 'replica_compare',
      allowedReadOnlyUse: [
        '在已解析公司作用域下查看 replica 是否落在同一公司上下文。',
        '暴露 replica 到业务对象仍缺哪些稳定桥接键。',
      ],
      forbiddenAutomaticConclusions: [
        '不得把 abc_sync_funds 升级成银行主账。',
        '不得把 replica compare 结果反写到 payment / payout / approval。',
      ],
      note: 'abc_sync_funds 只保留 replica_only 边界。',
    },
    {
      objectType: 'work_orders',
      relationType: 'business_bridge_context',
      allowedReadOnlyUse: [
        '在已解析公司作用域下缩小业务主干候选集合。',
        '展示 workOrderNo 命中只是业务上下文命中。',
      ],
      forbiddenAutomaticConclusions: [
        '不得把 workOrderNo 命中写成到账或出款确认。',
        '不得改 work_orders.amountReceived 或 status。',
      ],
      note: 'work_orders 只承担业务桥接，不承担资金事实确认。',
    },
  ],
  nextGaps: [
    '多公司账户固定映射的治理版本机制仍未落地，只定义了只读蓝图。',
    'deviceId / simSlot / receiverChannel 的真实覆盖率尚未知，当前只能定义成弱线索。',
    '公司作用域与虚拟账本作用域的命名规范仍未收口，只明确了“只能只读挂接”。',
    'approval / payout 场景下跨公司代付、共享出纳设备等边界仍需后续样本验证。',
    '缺少统一的 companyScopeCode / accountScopeKey 外部字典，本轮只先固定边界与状态。',
  ],
  reviewChecklist: [
    '确认 fixedAccountMappingKey 只来自治理侧版本化映射，不来自短信正文临时猜测。',
    '确认 sourcePhone=95566 继续只表示银行通道，不表示公司归属。',
    '确认 accountAlias / accountNoMasked 缺失时，样本继续停留在人工复核层。',
    '确认公司归属结果继续不改 projectionStatus=not_projected 的现有只读边界。',
    '确认公司归属只进入只读对照池，不改虚拟账本余额，不触发自动对账闭环。',
    '确认 approval / payment / payout / abc_sync_funds / work_orders 仍只做只读 compare，不做任何写回。',
  ],
};
