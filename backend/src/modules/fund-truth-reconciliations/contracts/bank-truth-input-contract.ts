export type BankTruthFieldRequirement = 'required' | 'optional' | 'auxiliary';

export type BankTruthAnchorLevel =
  | 'strong_event_key'
  | 'stable_business_anchor'
  | 'business_bridge_anchor'
  | 'replica_anchor'
  | 'weak_matching_hint'
  | 'not_anchor';

export type BankTruthMappingStatus =
  | 'exact_match'
  | 'high_confidence_match'
  | 'weak_match_manual_review'
  | 'duplicate_candidate'
  | 'unmatched'
  | 'conflicting_match';

export type BankTruthReviewRole =
  | 'finance_data_review'
  | 'finance_audit'
  | 'data_governance';

export interface BankTruthFieldDefinition {
  field: string;
  requirement: BankTruthFieldRequirement;
  valueType: string;
  purpose: string;
  note: string;
  presenceRule?: string;
}

export interface BankTruthAnchorDefinition {
  key: string;
  level: BankTruthAnchorLevel;
  appliesTo: string;
  note: string;
}

export interface BankTruthDedupRule {
  ruleKey: string;
  priority: number;
  condition: string;
  outcome: 'same_event' | 'duplicate_candidate' | 'conflicting_match';
  note: string;
}

export interface BankTruthMappingTargetPriority {
  direction: 'in' | 'out';
  orderedTargets: string[];
  reason: string;
}

export interface BankTruthStatusPolicy {
  status: BankTruthMappingStatus;
  systemMayDo: string[];
  systemMustNotDo: string[];
  humanRequired: string[];
}

export interface BankTruthManualReviewBoundary {
  scenario: string;
  reviewers: BankTruthReviewRole[];
  systemBehavior: string;
}

export interface BankTruthObjectGuidance {
  objectType: 'approval_requests' | 'payment_records' | 'payout_records' | 'abc_sync_funds';
  currentRole: string;
  currentTruthLevel: string;
  stableAnchors: string[];
  weakHints: string[];
  missingAnchors: string[];
  firstPriorityToBackfill: string;
  whyNotBankTruth: string;
}

export interface BankTruthInputContract {
  contractCode: string;
  version: string;
  mode: 'read_only_blueprint';
  stage: string;
  scope: string;
  hardGuards: string[];
  nonGoals: string[];
  inputFields: BankTruthFieldDefinition[];
  anchorRules: {
    bankEventIdentity: BankTruthAnchorDefinition[];
    businessMapping: BankTruthAnchorDefinition[];
    weakHints: BankTruthAnchorDefinition[];
    explicitNonAnchors: BankTruthAnchorDefinition[];
  };
  deduplication: {
    rules: BankTruthDedupRule[];
    fallbackPolicy: string[];
  };
  mappingTargetPriority: BankTruthMappingTargetPriority[];
  mappingStatusPolicy: BankTruthStatusPolicy[];
  manualReviewBoundaries: BankTruthManualReviewBoundary[];
  existingObjectGuidance: BankTruthObjectGuidance[];
}

export const BANK_TRUTH_INPUT_CONTRACT: BankTruthInputContract = {
  contractCode: 'fund_truth.bank_truth_input_contract',
  version: '2026-04-16.f6-read-only-blueprint',
  mode: 'read_only_blueprint',
  stage: 'F6',
  scope: '未来银行真相源接入前的最小输入契约、映射策略、人工复核边界与去重规则',
  hardGuards: [
    '不新增银行流水落库逻辑',
    '不新增第三颗资金写入对象',
    '不改数据库 schema',
    '不改 confirmed / inferred / uncertain',
    '不改 included / pending / excluded',
    '不改工资公式',
    '不跳过审批、财务、数据治理的人工作业边界',
    '不把车牌号升级为主绑定键，手机号仍是唯一主键',
    '不把 payment_records 写成银行真相源',
    '不把 abc_sync_funds 写成银行主账',
    '不重新引入 JSON_OVERLAPS',
    '不回退 currentUser 透传',
  ],
  nonGoals: [
    '本轮不做银行流水落库',
    '本轮不做虚拟账户余额变更',
    '本轮不做自动对账闭环',
    '本轮不扩 payout_records 命令壳',
    '本轮不把 verificationCode 升级为资金门禁',
    '本轮不接 AI focus',
  ],
  inputFields: [
    {
      field: 'ingestionEventId',
      requirement: 'required',
      valueType: 'string',
      purpose: '接入侧对单条银行输入事件生成的唯一事件号',
      note: '这是技术入口主键，用于区分一次输入事件，不等于业务主键，也不等于银行主账号。',
    },
    {
      field: 'sourceChannel',
      requirement: 'required',
      valueType: 'string',
      purpose: '标记来源渠道，例如 bank_statement_import、bank_webhook、manual_upload',
      note: '所有去重与事件主键都必须带 sourceChannel 作用域，避免跨渠道误碰撞。',
    },
    {
      field: 'sourceMessageKey',
      requirement: 'optional',
      valueType: 'string',
      purpose: '来源消息唯一键或文件内唯一消息号',
      note: '若来源系统能提供，它是优先级很高的去重键；没有时不能阻断接入。',
      presenceRule: '消息型接入强烈建议提供；批量对账单导入可为空。',
    },
    {
      field: 'accountAlias',
      requirement: 'optional',
      valueType: 'string',
      purpose: '账户别名或内部账户标签',
      note: '用于把事件限定到具体账户上下文，减少 statementLineId 或回单号跨账户碰撞。',
      presenceRule: '当 bankReceiptReference 或 statementLineId 需要形成账户作用域时，accountAlias 与 accountNoMasked 至少提供一个。',
    },
    {
      field: 'accountNoMasked',
      requirement: 'optional',
      valueType: 'string',
      purpose: '脱敏后的银行账号',
      note: '只允许存脱敏值，不承担主业务绑定，只用于账户作用域和人工核对。',
      presenceRule: '当 bankReceiptReference 或 statementLineId 需要形成账户作用域时，accountAlias 与 accountNoMasked 至少提供一个。',
    },
    {
      field: 'direction',
      requirement: 'required',
      valueType: "'in' | 'out'",
      purpose: '区分收款还是出款',
      note: '映射目标优先级必须按 direction 分流，不能把收款线索硬挂到 payout_records。',
    },
    {
      field: 'amount',
      requirement: 'required',
      valueType: 'string(decimal)',
      purpose: '银行事件金额',
      note: '金额是必需的业务事实，但默认只能做弱匹配线索，不能单独升格为强锚点。',
    },
    {
      field: 'occurredAt',
      requirement: 'required',
      valueType: 'datetime',
      purpose: '银行事件发生时间',
      note: '时间是必要事实，但默认只能辅助排序和人工核对，不能单独形成强锚点。',
    },
    {
      field: 'bankTransactionReference',
      requirement: 'optional',
      valueType: 'string',
      purpose: '银行侧交易流水号',
      note: '若来源可得，它属于银行事件强锚点；若为空，必须退回其他去重规则。',
    },
    {
      field: 'bankReceiptReference',
      requirement: 'optional',
      valueType: 'string',
      purpose: '银行回单号或回单引用',
      note: '可与 bankTransactionReference 互补；若缺少账户作用域，只能降级为 duplicate_candidate 或人工复核，不能跨账户直接合并。',
    },
    {
      field: 'statementLineId',
      requirement: 'optional',
      valueType: 'string',
      purpose: '账单行号或对账单明细号',
      note: '它只在 accountAlias/accountNoMasked 或 importBatchId 作用域内稳定；若缺账户作用域，只能停留在人工复核层。',
    },
    {
      field: 'counterpartyName',
      requirement: 'auxiliary',
      valueType: 'string',
      purpose: '对手方名称',
      note: '默认只作辅助线索，不得单独作为强锚点，也不能直接替代付款方或收款方确认。',
    },
    {
      field: 'counterpartyAccountMasked',
      requirement: 'auxiliary',
      valueType: 'string',
      purpose: '对手方脱敏账号',
      note: '仅用于人工缩小范围，不能单独形成稳定映射。',
    },
    {
      field: 'businessAnchorCandidate',
      requirement: 'optional',
      valueType:
        "{ kind: 'payment_no' | 'payout_no' | 'approval_no' | 'work_order_no' | 'abc_sync_source_object_key'; value: string; source: string; }",
      purpose: '银行侧备注、外部映射文件或人工录入中显式给出的业务候选锚点',
      note: '这是业务映射主候选，不是银行事件身份键；只有显式携带或人工确认时才能升到 stable business anchor。',
    },
    {
      field: 'rawSourceKind',
      requirement: 'required',
      valueType: 'string',
      purpose: '原始载荷类型，例如 csv_line、api_event、pdf_receipt',
      note: '必须与 rawSourceDigest 组合使用，作为技术层的兜底去重键。',
    },
    {
      field: 'rawSourceDigest',
      requirement: 'required',
      valueType: 'string',
      purpose: '原始载荷摘要',
      note: '它是技术去重兜底，不是业务锚点，也不能替代银行流水号。',
    },
    {
      field: 'importBatchId',
      requirement: 'optional',
      valueType: 'string',
      purpose: '本次导入批次号',
      note: '主要用于 statementLineId 与批量导入场景的去重与追溯，不能单独映射业务对象。',
    },
  ],
  anchorRules: {
    bankEventIdentity: [
      {
        key: 'sourceChannel + ingestionEventId',
        level: 'strong_event_key',
        appliesTo: '银行输入事件去重',
        note: '接入层最强技术事件键；若冲突，优先视为重复输入或重放。',
      },
      {
        key: 'sourceChannel + sourceMessageKey',
        level: 'strong_event_key',
        appliesTo: '消息型渠道去重',
        note: '仅在来源保证唯一时生效；来源未给则不能假造。',
      },
      {
        key: 'sourceChannel + bankTransactionReference',
        level: 'strong_event_key',
        appliesTo: '银行流水号去重',
        note: '这是未来最理想的银行真相标识之一。',
      },
      {
        key: 'sourceChannel + accountAlias/accountNoMasked + bankReceiptReference',
        level: 'strong_event_key',
        appliesTo: '银行回单去重',
        note: '只有在账户作用域清楚时，才能把它当作 strong_event_key；若缺账户作用域，只能降级成人工复核线索。',
      },
      {
        key: 'sourceChannel + accountAlias/accountNoMasked + statementLineId',
        level: 'strong_event_key',
        appliesTo: '账单行去重',
        note: 'statementLineId 不应脱离账户作用域单独使用。',
      },
      {
        key: 'sourceChannel + rawSourceKind + rawSourceDigest',
        level: 'strong_event_key',
        appliesTo: '原始载荷重放兜底',
        note: '用于识别相同原文重复导入，不应直接映射业务主对象。',
      },
    ],
    businessMapping: [
      {
        key: 'businessAnchorCandidate.kind=payment_no -> paymentNo',
        level: 'stable_business_anchor',
        appliesTo: 'direction=in 优先映射 payment_records',
        note: 'paymentNo 是到账语义对象主锚，但不是银行真相号；必须由银行备注、外部映射文件或人工确认显式携带。',
      },
      {
        key: 'businessAnchorCandidate.kind=payout_no -> payoutNo',
        level: 'stable_business_anchor',
        appliesTo: 'direction=out 优先映射 payout_records',
        note: 'payoutNo 是付款登记主锚，但不是银行出款真相号。',
      },
      {
        key: 'businessAnchorCandidate.kind=approval_no -> approvalNo',
        level: 'stable_business_anchor',
        appliesTo: 'direction=out 次优先映射 approval_requests',
        note: 'approvalNo 只能把银行事件挂回审批控制链，不能替代真实出款流水号。',
      },
      {
        key: 'businessAnchorCandidate.kind=work_order_no -> workOrderNo',
        level: 'business_bridge_anchor',
        appliesTo: 'direction=in/out 的业务主干桥接',
        note: 'workOrderNo 可以回到业务上下文，但通常不足以唯一定位 payment_records 或 payout_records。',
      },
      {
        key: 'businessAnchorCandidate.kind=abc_sync_source_object_key -> sourceSystem+sourceTable+sourceId',
        level: 'replica_anchor',
        appliesTo: '只读挂接 abc_sync_funds',
        note: '这只是同步副本身份，不是银行真相锚点。只有副本先稳定挂回 payment/payout/approval 后，才有进一步价值。',
      },
    ],
    weakHints: [
      {
        key: 'amount',
        level: 'weak_matching_hint',
        appliesTo: '候选排序',
        note: '默认只能参与候选排序或人工核对，不能单独升级为强锚点。',
      },
      {
        key: 'occurredAt',
        level: 'weak_matching_hint',
        appliesTo: '时间窗筛选',
        note: '默认只能辅助排序和窗口筛选，不能单独确定映射。',
      },
      {
        key: 'counterpartyName',
        level: 'weak_matching_hint',
        appliesTo: '人工核对',
        note: '付款方/收款方名称可能重名或可变，只能辅助。',
      },
      {
        key: 'counterpartyAccountMasked',
        level: 'weak_matching_hint',
        appliesTo: '人工核对',
        note: '脱敏账号只缩小范围，不承担唯一映射责任。',
      },
      {
        key: 'status / payment_method / memo text',
        level: 'weak_matching_hint',
        appliesTo: '人工辅助',
        note: '状态、渠道、文本备注默认都不能单独升为强锚点。',
      },
    ],
    explicitNonAnchors: [
      {
        key: 'verificationCode',
        level: 'not_anchor',
        appliesTo: 'approval_requests',
        note: 'verificationCode 继续只属于审批提示和解释链，不属于银行真相映射锚点。',
      },
      {
        key: 'payment_records.paymentStatus / payout_records.paymentMethod / approval_requests.currentStatus',
        level: 'not_anchor',
        appliesTo: '仓内状态字段',
        note: '这些字段只能说明仓内语义和审批结论，不能等同银行真相。',
      },
    ],
  },
  deduplication: {
    rules: [
      {
        ruleKey: 'same_source_event_id',
        priority: 1,
        condition: 'sourceChannel 与 ingestionEventId 完全一致',
        outcome: 'same_event',
        note: '直接视为同一输入事件，不再产生第二个候选。',
      },
      {
        ruleKey: 'same_source_message_key',
        priority: 2,
        condition: 'sourceChannel 与 sourceMessageKey 完全一致',
        outcome: 'same_event',
        note: '适用于 webhook、消息总线或渠道回调场景。',
      },
      {
        ruleKey: 'same_bank_transaction_reference',
        priority: 3,
        condition: 'sourceChannel 与 bankTransactionReference 完全一致',
        outcome: 'same_event',
        note: '若相同银行流水号对应不同金额、方向或 occurredAt，应改判 conflicting_match。',
      },
      {
        ruleKey: 'same_bank_receipt_reference_with_account_scope',
        priority: 4,
        condition:
          'sourceChannel 与 bankReceiptReference 完全一致，且 accountAlias/accountNoMasked 作用域一致',
        outcome: 'same_event',
        note: '回单号缺少账户作用域时不能直接合并，应降级为 duplicate_candidate 或 weak_match_manual_review。',
      },
      {
        ruleKey: 'same_statement_line_with_account_scope',
        priority: 5,
        condition:
          'statementLineId 一致，且 accountAlias/accountNoMasked 作用域一致，且 importBatchId 一致或可确认是同一账单',
        outcome: 'same_event',
        note: '账单行号必须带账户或批次作用域，避免跨文件误合并。',
      },
      {
        ruleKey: 'same_raw_digest',
        priority: 6,
        condition: 'sourceChannel + rawSourceKind + rawSourceDigest 完全一致',
        outcome: 'same_event',
        note: '只用于技术重放去重，不自动产生业务映射结论。',
      },
      {
        ruleKey: 'weak_similarity_only',
        priority: 7,
        condition:
          '仅有 amount + occurredAt + direction + accountAlias/accountNoMasked + counterpartyName 近似一致，但缺强锚点',
        outcome: 'duplicate_candidate',
        note: '只能标记 duplicate_candidate，不能自动合并。',
      },
      {
        ruleKey: 'conflicting_strong_keys',
        priority: 8,
        condition:
          '不同强锚点把同一输入事件指向不同对象，或同一强锚点对应的金额、方向、时间明显冲突',
        outcome: 'conflicting_match',
        note: '必须冻结自动排序结果并升级人工复核。',
      },
    ],
    fallbackPolicy: [
      '没有任何强锚点时，不做自动合并，只能产生 duplicate_candidate 或 unmatched。',
      '没有 businessAnchorCandidate 时，不得仅凭 amount、occurredAt、付款方、收款方把银行输入事件挂成 exact_match。',
      '若只有 bankReceiptReference 但缺少 accountAlias/accountNoMasked 作用域，只能降级为 duplicate_candidate 或 weak_match_manual_review。',
      'importBatchId 只参与账单批次内排重与追溯，不能单独声明两条事件相同。',
      '若 sourceMessageKey、bankTransactionReference、bankReceiptReference、statementLineId 任一存在冲突，应保留冲突事实，不做静默覆盖。',
    ],
  },
  mappingTargetPriority: [
    {
      direction: 'in',
      orderedTargets: [
        'payment_records',
        'work_orders',
        'approval_requests',
        'abc_sync_funds',
        'payout_records',
      ],
      reason:
        '收款事件首先要解释仓内到账语义，其次回到业务工单主干；approval_requests 在这里仅作为 supporting control source 提供背景控制信息，abc_sync_funds 只是副本，payout_records 通常不适用。',
    },
    {
      direction: 'out',
      orderedTargets: [
        'payout_records',
        'approval_requests',
        'work_orders',
        'abc_sync_funds',
        'payment_records',
      ],
      reason:
        '出款事件先解释付款登记，再回到审批控制链 supporting control source，再追溯业务工单；abc_sync_funds 只是副本，payment_records 通常不适用。',
    },
  ],
  mappingStatusPolicy: [
    {
      status: 'exact_match',
      systemMayDo: [
        '展示唯一目标对象与全部证据',
        '在只读视图中标记为精确命中',
        '允许后续写入阶段把该结果作为待人工确认的首选项',
      ],
      systemMustNotDo: [
        '不能直接改 payment_records / payout_records / approval_requests / abc_sync_funds',
        '不能自动推进工资、审批或自动对账闭环',
      ],
      humanRequired: ['财务仍需确认结果是否可用于后续银行对照结论。'],
    },
    {
      status: 'high_confidence_match',
      systemMayDo: [
        '展示排序第一的候选对象',
        '说明命中所依赖的 stable business anchor 与弱线索',
      ],
      systemMustNotDo: [
        '不能写主对象',
        '不能把 high_confidence_match 视为银行真相已落库',
      ],
      humanRequired: ['finance_data_review 必须确认或驳回。'],
    },
    {
      status: 'weak_match_manual_review',
      systemMayDo: [
        '展示多个候选及各自弱线索',
        '提示缺失的强锚点和建议补锚路径',
      ],
      systemMustNotDo: [
        '不能自动绑定任何对象',
        '不能自动合并重复事件',
      ],
      humanRequired: ['finance_data_review 必须人工选择、驳回或补充锚点。'],
    },
    {
      status: 'duplicate_candidate',
      systemMayDo: [
        '把相似事件聚类展示',
        '保留每条事件原始证据与差异',
      ],
      systemMustNotDo: [
        '不能静默合并',
        '不能删除任一候选事件',
      ],
      humanRequired: ['finance_data_review 或 data_governance 必须确认是否为同一事件。'],
    },
    {
      status: 'unmatched',
      systemMayDo: [
        '保留未命中事件',
        '提示所缺业务锚点或银行锚点',
      ],
      systemMustNotDo: [
        '不能强行挂到 work_orders、payment_records、payout_records 或 abc_sync_funds',
        '不能为了闭环而生成虚构业务对象',
      ],
      humanRequired: ['data_governance 或 finance_data_review 需要补充映射材料。'],
    },
    {
      status: 'conflicting_match',
      systemMayDo: [
        '冻结结果并暴露冲突点',
        '将所有冲突锚点、候选对象和差异字段并列展示',
      ],
      systemMustNotDo: [
        '不能继续自动排序为单一结论',
        '不能自动修正现有主对象',
      ],
      humanRequired: ['finance_audit 与 data_governance 必须共同介入。'],
    },
  ],
  manualReviewBoundaries: [
    {
      scenario: '只有 weak hint，没有任何 strong event key 或 stable business anchor',
      reviewers: ['finance_data_review'],
      systemBehavior: '只能展示对照提示，不自动改主对象，不自动合并。',
    },
    {
      scenario: '同一银行流水号、回单号或 statementLineId 指向多个业务对象',
      reviewers: ['finance_audit', 'data_governance'],
      systemBehavior: '冻结结果为 conflicting_match，并要求审计与治理共同裁决。',
    },
    {
      scenario: 'bank input 命中 payout_records 或 approval_requests 的出款场景',
      reviewers: ['finance_data_review', 'finance_audit'],
      systemBehavior: '即使证据充分，也不能绕过审批与人工付款确认边界。',
    },
    {
      scenario: 'abc_sync_funds 先命中，但缺少副本到 payment/payout/approval 的稳定桥',
      reviewers: ['data_governance'],
      systemBehavior: '只能停留在 replica 侧提示，不得把副本直接当银行主账。',
    },
    {
      scenario: '需要补统一业务编号、跨表桥接键或来源清洗规则',
      reviewers: ['data_governance'],
      systemBehavior: '问题归属数据治理，不通过财务手工备注硬补全系统契约。',
    },
    {
      scenario: '未来接入银行真相后涉及审批、工资、福利或 AI 执行边界',
      reviewers: ['finance_data_review', 'finance_audit'],
      systemBehavior: '只能作为只读对照输入，不得越权触发审批通过、工资 included 或 AI 自动执行。',
    },
  ],
  existingObjectGuidance: [
    {
      objectType: 'approval_requests',
      currentRole: '审批控制对象',
      currentTruthLevel: 'supporting_source',
      stableAnchors: ['approvalNo', 'relatedWorkOrderId', 'workOrderNo'],
      weakHints: ['amount', 'currentStatus', 'latestPayoutNo', 'latestPaymentNo', 'verificationCode'],
      missingAnchors: ['external payout reference', 'bankTransactionReference', 'bankReceiptReference'],
      firstPriorityToBackfill:
        '保持 approvalNo 为审批侧主锚，同时补 approvalNo / payoutNo 到银行出款流水号或回单号的只读桥。',
      whyNotBankTruth:
        '它只说明谁申请、谁审批、审批结论是什么，不说明真实银行收付。',
    },
    {
      objectType: 'payment_records',
      currentRole: '到账语义对象',
      currentTruthLevel: 'supporting_source',
      stableAnchors: ['paymentNo', 'workOrderId', 'workOrderNo'],
      weakHints: ['amount', 'paidAt', 'paymentMethod', 'payerName', 'remark'],
      missingAnchors: ['bankTransactionReference', 'statementLineId', 'bankReceiptReference'],
      firstPriorityToBackfill:
        '保持 paymentNo 为到账侧主锚，优先补 paymentNo / workOrderNo 到银行流水号、回单号、账单行号的只读映射。',
      whyNotBankTruth:
        '它只代表当前仓库内到账语义，不是银行真相源，也不是银行主账。',
    },
    {
      objectType: 'payout_records',
      currentRole: '付款登记对象',
      currentTruthLevel: 'not_truth_source',
      stableAnchors: ['payoutNo', 'approvalRequestId', 'approvalNo', 'workOrderNo'],
      weakHints: ['amount', 'paidAt', 'paymentMethod', 'payeeName'],
      missingAnchors: ['bank debit transaction reference', 'bankReceiptReference', 'statementLineId'],
      firstPriorityToBackfill:
        '保持 payoutNo 为付款登记主锚，优先补 payoutNo / approvalNo 到银行出款流水号或回单号的只读桥。',
      whyNotBankTruth:
        '它只是系统里的付款登记，不是资金真相源，也不应扩成新的银行写入壳。',
    },
    {
      objectType: 'abc_sync_funds',
      currentRole: '同步标准化副本',
      currentTruthLevel: 'replica_only',
      stableAnchors: ['sourceSystem+sourceTable+sourceId', 'rawTableName+rawRecordId'],
      weakHints: ['sourceOrderNo', 'relatedOrderNo', 'amountStandard', 'directionStandard', 'statusStandard'],
      missingAnchors: ['business primary mapping', 'bankTransactionReference', 'bankReceiptReference'],
      firstPriorityToBackfill:
        '先补副本到 paymentNo / payoutNo / approvalNo 的稳定桥，再谈银行真相接入。',
      whyNotBankTruth:
        '它只是同步副本，既不是银行主账，也不应被直接当作未来银行真相输入对象。',
    },
  ],
};
