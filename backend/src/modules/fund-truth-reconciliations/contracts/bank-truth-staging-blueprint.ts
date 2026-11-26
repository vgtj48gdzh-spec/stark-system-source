import { BankTruthReviewRole } from './bank-truth-input-contract';

export type BankTruthStagingStatus =
  | 'ingested'
  | 'normalized'
  | 'duplicate_candidate'
  | 'unmatched'
  | 'weak_match_manual_review'
  | 'exact_match'
  | 'high_confidence_match'
  | 'conflicting_match'
  | 'approved_for_projection'
  | 'rejected_for_projection';

export type BankTruthProjectionKind =
  | 'staging_overview'
  | 'manual_review_queue'
  | 'read_only_comparison'
  | 'duplicate_conflict_cluster'
  | 'coverage_gap_signal';

export type BankTruthAdaptationTarget =
  | 'approval_requests'
  | 'payment_records'
  | 'payout_records'
  | 'abc_sync_funds'
  | 'work_orders';

export interface BankTruthStagingFieldDefinition {
  field: string;
  requirement: 'required' | 'conditional' | 'optional';
  valueType: string;
  purpose: string;
  note: string;
  presenceRule?: string;
}

export interface BankTruthStagingStatusDefinition {
  status: BankTruthStagingStatus;
  reviewers: BankTruthReviewRole[];
  entryRule: string;
  exitRule: string;
  allowedProjectionKinds: BankTruthProjectionKind[];
  mainObjectWriteAllowed: false;
  note: string;
}

export interface BankTruthStagingTransition {
  from: BankTruthStagingStatus;
  to: BankTruthStagingStatus;
  actor: 'system' | 'finance_data_review' | 'finance_audit' | 'data_governance' | 'joint_review';
  trigger: string;
}

export interface BankTruthManualReviewBoundary {
  scenario: string;
  statuses: BankTruthStagingStatus[];
  requiredRoles: BankTruthReviewRole[];
  systemMayDo: string[];
  systemMustNotDo: string[];
}

export interface BankTruthStagingAdaptationBoundary {
  target: BankTruthAdaptationTarget;
  currentRole: string;
  adaptationMode: 'read_only_compare' | 'bridge_only' | 'replica_compare';
  readableJoinKeys: string[];
  supportingHints: string[];
  projectionFields: string[];
  forbiddenActions: string[];
  note: string;
}

export interface BankTruthProjectionRule {
  projectionKind: BankTruthProjectionKind;
  allowedStatuses: BankTruthStagingStatus[];
  outputFields: string[];
  forbiddenDirectBusinessFields: string[];
  note: string;
}

export interface BankTruthFreezeRule {
  status: 'duplicate_candidate' | 'conflicting_match';
  stopReason: string;
  systemMustDo: string[];
  systemMustNotDo: string[];
  releaseCondition: string;
}

export interface BankTruthNextPhaseEntryCondition {
  code: string;
  description: string;
  threshold: string;
  unmetEffect: string;
}

export interface BankTruthStagingBlueprint {
  blueprintCode: string;
  version: string;
  mode: 'read_only_blueprint';
  stage: 'F7';
  scope: string;
  upstreamContracts: string[];
  hardGuards: string[];
  nonGoals: string[];
  fieldLayers: {
    eventIdentityFields: BankTruthStagingFieldDefinition[];
    bankTruthFields: BankTruthStagingFieldDefinition[];
    rawPayloadFields: BankTruthStagingFieldDefinition[];
    anchorCandidateFields: BankTruthStagingFieldDefinition[];
    manualReviewFields: BankTruthStagingFieldDefinition[];
    projectionOutputFields: BankTruthStagingFieldDefinition[];
  };
  statusDefinitions: BankTruthStagingStatusDefinition[];
  transitions: BankTruthStagingTransition[];
  manualReviewBoundaries: BankTruthManualReviewBoundary[];
  adaptationBoundaries: BankTruthStagingAdaptationBoundary[];
  projectionRules: BankTruthProjectionRule[];
  freezeRules: BankTruthFreezeRule[];
  nextPhaseEntryConditions: BankTruthNextPhaseEntryCondition[];
  reviewChecklist: string[];
}

const FORBIDDEN_DIRECT_BUSINESS_FIELDS = [
  'approval_requests.currentStatus',
  'approval_requests.finalApproverId',
  'approval_requests.verificationCode',
  'payment_records.amount',
  'payment_records.paymentStatus',
  'payment_records.paidAt',
  'payment_records.payerName',
  'payment_records.remark',
  'payout_records.amount',
  'payout_records.paymentMethod',
  'payout_records.paidAt',
  'payout_records.payeeName',
  'abc_sync_funds.mappingConfirmed',
  'abc_sync_funds.mappingNotes',
  'abc_sync_funds.normalizedPayload',
  'work_orders.amountReceived',
  'work_orders.status',
  'payroll_trials.*',
  'execution_tasks.*',
];

const EVENT_IDENTITY_FIELDS: BankTruthStagingFieldDefinition[] = [
  { field: 'stagingRecordId', requirement: 'required', valueType: 'string', purpose: 'staging 自身记录号', note: '内部主键，不等于银行流水或业务主键' },
  { field: 'ingestionEventId', requirement: 'required', valueType: 'string', purpose: '接入侧单事件唯一号', note: '沿用 F6 输入契约' },
  { field: 'sourceChannel', requirement: 'required', valueType: 'string', purpose: '来源渠道', note: '所有去重都必须带渠道作用域' },
  { field: 'sourceMessageKey', requirement: 'conditional', valueType: 'string', purpose: '消息型来源的唯一消息键', note: '只在消息型输入存在稳定 message id 时要求提供', presenceRule: '消息型输入时提供' },
  { field: 'importBatchId', requirement: 'optional', valueType: 'string', purpose: '批量导入批次号', note: '只做 batch 追溯，不声明业务归属' },
  { field: 'ingestedAt', requirement: 'required', valueType: 'datetime', purpose: '进入 staging 的时间', note: '不等于银行发生时间' },
];

const BANK_TRUTH_FIELDS: BankTruthStagingFieldDefinition[] = [
  { field: 'direction', requirement: 'required', valueType: "'in' | 'out'", purpose: '收支方向', note: '决定只读适配优先流向' },
  { field: 'amount', requirement: 'required', valueType: 'string(decimal)', purpose: '银行金额事实', note: '默认只做线索，不单独升格为强锚点' },
  { field: 'currency', requirement: 'conditional', valueType: 'string', purpose: '币种', note: '未来非 CNY 时必须显式携带', presenceRule: '来源可能出现多币种时提供' },
  { field: 'occurredAt', requirement: 'required', valueType: 'datetime', purpose: '银行发生时间', note: '默认只做排序、窗口和人工核对' },
  { field: 'bankTransactionReference', requirement: 'conditional', valueType: 'string', purpose: '银行流水号', note: '最优先的银行强锚点之一', presenceRule: '推荐与回单号/账单行号三选一至少出现一个' },
  { field: 'bankReceiptReference', requirement: 'conditional', valueType: 'string', purpose: '银行回单号', note: '缺账户作用域时只能降级为 duplicate/manual', presenceRule: '使用它判重或挂接时必须同时给账户作用域' },
  { field: 'statementLineId', requirement: 'conditional', valueType: 'string', purpose: '账单行号', note: '只能在账户/批次作用域内使用', presenceRule: '若它是唯一银行证据，则必须给账户作用域或批次' },
  { field: 'accountAlias', requirement: 'conditional', valueType: 'string', purpose: '账户别名', note: '只承担账户作用域，不承担业务主绑定', presenceRule: '使用回单号/账单行号时与 accountNoMasked 至少一项存在' },
  { field: 'accountNoMasked', requirement: 'conditional', valueType: 'string', purpose: '脱敏账号', note: '只允许脱敏值；只用于账户作用域和人工核对', presenceRule: '使用回单号/账单行号时与 accountAlias 至少一项存在' },
  { field: 'counterpartyName', requirement: 'optional', valueType: 'string', purpose: '对手方名称', note: '只作人工核对线索' },
  { field: 'counterpartyAccountMasked', requirement: 'optional', valueType: 'string', purpose: '对手方脱敏账号', note: '只能缩小范围，不承担一对一归属' },
];

const RAW_PAYLOAD_FIELDS: BankTruthStagingFieldDefinition[] = [
  { field: 'rawSourceKind', requirement: 'required', valueType: 'string', purpose: '原始载荷类型', note: '例如 csv_line、api_event、pdf_receipt' },
  { field: 'rawSourceDigest', requirement: 'required', valueType: 'string', purpose: '原始载荷摘要', note: '只用于技术去重和回放，不替代银行流水号' },
  { field: 'rawPayloadSnapshot', requirement: 'required', valueType: 'object', purpose: '原始载荷快照', note: '只用于审计与追溯' },
  { field: 'normalizationVersion', requirement: 'required', valueType: 'string', purpose: '归一化版本', note: '用于追踪规则变化' },
  { field: 'rawPayloadLocator', requirement: 'optional', valueType: 'string', purpose: '原始文件/消息定位信息', note: '只用于追溯原证据' },
];

const ANCHOR_CANDIDATE_FIELDS: BankTruthStagingFieldDefinition[] = [
  { field: 'businessAnchorCandidates', requirement: 'required', valueType: "Array<{ kind: 'payment_no' | 'payout_no' | 'approval_no' | 'work_order_no' | 'abc_sync_source_object_key'; value: string; source: string; confidence: 'strong' | 'medium' | 'weak'; }>", purpose: '显式列出所有业务候选锚点', note: '候选不是写回授权' },
  { field: 'matchedTargetType', requirement: 'optional', valueType: "'approval_requests' | 'payment_records' | 'payout_records' | 'abc_sync_funds' | 'work_orders'", purpose: '当前最佳候选对象类型', note: '只是 read-only compare target' },
  { field: 'matchedTargetId', requirement: 'optional', valueType: 'number', purpose: '当前最佳候选对象主键', note: '仅用于只读投影' },
  { field: 'matchedTargetNo', requirement: 'optional', valueType: 'string', purpose: '当前最佳候选对象编号', note: '例如 paymentNo / payoutNo / approvalNo / workOrderNo' },
  { field: 'missingAnchorSummary', requirement: 'required', valueType: 'string[]', purpose: '剩余锚点缺口摘要', note: '为 unmatched / weak / conflict 提供下一步动作入口' },
];

const MANUAL_REVIEW_FIELDS: BankTruthStagingFieldDefinition[] = [
  { field: 'stagingStatus', requirement: 'required', valueType: 'BankTruthStagingStatus', purpose: '当前 staging 状态', note: '只驱动 review/projection，不驱动主对象写入' },
  { field: 'reviewQueueOwner', requirement: 'conditional', valueType: 'BankTruthReviewRole', purpose: '当前主责人工角色', note: '进入人工阶段后必须可追踪', presenceRule: '进入人工阶段时提供' },
  { field: 'reviewDecision', requirement: 'conditional', valueType: "'approve_projection' | 'reject_projection' | 'need_more_evidence' | 'escalate'", purpose: '人工复核结论', note: '只影响只读投影，不触发业务写入', presenceRule: '进入 approved/rejected 时提供' },
  { field: 'reviewReasonCode', requirement: 'conditional', valueType: 'string', purpose: '人工原因码', note: '便于审计复盘', presenceRule: '存在人工决策时提供' },
  { field: 'reviewedByUserId', requirement: 'conditional', valueType: 'number', purpose: '人工复核人', note: '保留人工入口和痕迹', presenceRule: '存在人工决策时提供' },
  { field: 'reviewedAt', requirement: 'conditional', valueType: 'datetime', purpose: '人工复核时间', note: '保留人工入口和痕迹', presenceRule: '存在人工决策时提供' },
  { field: 'reviewEvidenceNote', requirement: 'optional', valueType: 'string', purpose: '人工证据补充', note: '解释为何允许或拒绝只读投影' },
];

const PROJECTION_OUTPUT_FIELDS: BankTruthStagingFieldDefinition[] = [
  { field: 'projectionStatus', requirement: 'required', valueType: "'not_projected' | 'eligible_read_only' | 'rejected_read_only'", purpose: '只读投影放行结果', note: '不映射 confirmed / inferred / uncertain' },
  { field: 'projectionKinds', requirement: 'required', valueType: 'BankTruthProjectionKind[]', purpose: '允许发往哪些只读视图', note: '绝不包含业务主对象写入动作' },
  { field: 'comparisonSummary', requirement: 'required', valueType: 'string', purpose: '页面/对照层摘要', note: '只能让人看见，不能让系统改写' },
  { field: 'safeProjectionPayload', requirement: 'required', valueType: 'object', purpose: '最小安全载荷', note: '只含状态、候选目标、证据摘要、缺口摘要、人工结论摘要' },
  { field: 'projectionAuditRef', requirement: 'required', valueType: 'string', purpose: '投影追溯号', note: '便于页面追溯回 staging 和人工记录' },
];

export const BANK_TRUTH_STAGING_BLUEPRINT: BankTruthStagingBlueprint = {
  blueprintCode: 'fund_truth.bank_truth_staging_blueprint',
  version: '2026-04-16.f7-read-only-staging-blueprint',
  mode: 'read_only_blueprint',
  stage: 'F7',
  scope: '定义未来银行真相输入进入系统时的 staging 对象蓝图、状态机、人工复核边界，以及与现有对象的只读适配层边界。',
  upstreamContracts: ['fund_truth.bank_truth_input_contract@2026-04-16.f6-read-only-blueprint'],
  hardGuards: [
    '不破坏 S1-03 三条稳定链',
    '不自动推进正式工资',
    '不跳过人工确认层',
    '不改工资公式',
    '不改 confirmed / inferred / uncertain',
    '不改 included / pending / excluded',
    '不把车牌号当主绑定键；如需客户侧辅助线索，仍沿用手机号主键链路',
    '不重新引入 JSON_OVERLAPS',
    '不回退 currentUser 透传',
    '不改数据库 schema',
    '不做任何写入逻辑',
    '不接 AI focus',
    '不扩 payout_records 命令壳',
    '不把 verificationCode 升级成资金门禁',
    '不把 payment_records 误写成银行真相源',
    '不把 abc_sync_funds 误写成银行主账',
    '当前没有任何对象应被标成 primary_candidate',
    'approved_for_projection 只表示允许生成只读投影，不表示允许写回任何主对象',
  ],
  nonGoals: [
    '本轮不做银行流水落库实现',
    '本轮不做虚拟账户金额变更',
    '本轮不做自动对账闭环',
    '本轮不做 payout_records 命令壳扩展',
    '本轮不把 staging 直接当银行主账',
    '本轮不新增资金第三写入对象',
  ],
  fieldLayers: {
    eventIdentityFields: EVENT_IDENTITY_FIELDS,
    bankTruthFields: BANK_TRUTH_FIELDS,
    rawPayloadFields: RAW_PAYLOAD_FIELDS,
    anchorCandidateFields: ANCHOR_CANDIDATE_FIELDS,
    manualReviewFields: MANUAL_REVIEW_FIELDS,
    projectionOutputFields: PROJECTION_OUTPUT_FIELDS,
  },
  statusDefinitions: [
    { status: 'ingested', reviewers: [], entryRule: '原始银行输入刚进入 staging', exitRule: '归一化完成后进入 normalized', allowedProjectionKinds: ['staging_overview'], mainObjectWriteAllowed: false, note: '只允许展示接入成功，不允许生成业务结论' },
    { status: 'normalized', reviewers: [], entryRule: '字段已归一化并生成技术锚点', exitRule: '根据锚点与冲突规则流转到后续状态', allowedProjectionKinds: ['staging_overview'], mainObjectWriteAllowed: false, note: 'normalized 只是可比较，不代表已匹配' },
    { status: 'duplicate_candidate', reviewers: ['finance_data_review', 'data_governance'], entryRule: '缺少完整强锚点，仅出现高度相似的同源输入', exitRule: '人工拆分、补证据或确认冲突后流转', allowedProjectionKinds: ['staging_overview', 'manual_review_queue', 'duplicate_conflict_cluster'], mainObjectWriteAllowed: false, note: '必须停在 staging，不允许静默合并或删除候选记录' },
    { status: 'unmatched', reviewers: ['finance_data_review', 'data_governance'], entryRule: '没有找到足够的业务锚点或银行强锚点', exitRule: '补齐锚点后进入 weak/exact/high_confidence，否则停留或 reject', allowedProjectionKinds: ['staging_overview', 'manual_review_queue', 'coverage_gap_signal'], mainObjectWriteAllowed: false, note: '只能输出缺口，不得为了闭环虚构业务目标' },
    { status: 'weak_match_manual_review', reviewers: ['finance_data_review'], entryRule: '已有候选目标，但仍依赖弱线索或 bridge anchor', exitRule: '人工补证据后进入 exact/high_confidence/conflict/reject', allowedProjectionKinds: ['staging_overview', 'manual_review_queue', 'read_only_comparison'], mainObjectWriteAllowed: false, note: '可展示 compare 卡，但仍不得写回主对象' },
    { status: 'exact_match', reviewers: ['finance_data_review'], entryRule: '银行强锚点与业务稳定锚点唯一命中且无冲突', exitRule: '人工确认后进入 approved_for_projection 或遇到新冲突回到 conflict', allowedProjectionKinds: ['staging_overview', 'manual_review_queue', 'read_only_comparison'], mainObjectWriteAllowed: false, note: 'exact_match 仍只是只读对照候选，不等于主对象已被银行确认' },
    { status: 'high_confidence_match', reviewers: ['finance_data_review'], entryRule: '稳定业务锚点存在，且银行证据与弱线索组合支持单一候选', exitRule: '人工确认后进入 approved_for_projection，证据不足则退回 weak/conflict/reject', allowedProjectionKinds: ['staging_overview', 'manual_review_queue', 'read_only_comparison'], mainObjectWriteAllowed: false, note: '只能作为人工优先队列，不允许自动上升为正式结论' },
    { status: 'conflicting_match', reviewers: ['finance_audit', 'data_governance'], entryRule: '强锚点或强候选彼此冲突', exitRule: '经联合裁决后回到 exact/high_confidence 或 reject', allowedProjectionKinds: ['staging_overview', 'manual_review_queue', 'duplicate_conflict_cluster'], mainObjectWriteAllowed: false, note: '冲突态只能冻结，不允许系统自行重写现有 payment/payout/approval' },
    { status: 'approved_for_projection', reviewers: ['finance_data_review'], entryRule: 'exact/high_confidence 经过人工确认并定义放行范围', exitRule: '若后续发现新冲突，可退回 conflict 或 reject', allowedProjectionKinds: ['staging_overview', 'read_only_comparison'], mainObjectWriteAllowed: false, note: 'approved_for_projection 只放行只读 compare/projection，不放行业务写入' },
    { status: 'rejected_for_projection', reviewers: ['finance_data_review', 'finance_audit', 'data_governance'], entryRule: '证据不足、冲突未解或越权风险存在', exitRule: '只有补入新证据并重新发起人工复核时，才允许回到 weak_match_manual_review', allowedProjectionKinds: ['staging_overview', 'coverage_gap_signal'], mainObjectWriteAllowed: false, note: 'reject 也必须保留审计痕迹，不能删除原始 staging 记录' },
  ],
  transitions: [
    { from: 'ingested', to: 'normalized', actor: 'system', trigger: '系统完成最小字段归一化与原始载荷摘要生成' },
    { from: 'normalized', to: 'duplicate_candidate', actor: 'system', trigger: '缺少完整强锚点，仅出现高度相似的同源输入' },
    { from: 'normalized', to: 'unmatched', actor: 'system', trigger: '没有找到可用候选目标或稳定桥接锚点' },
    { from: 'normalized', to: 'weak_match_manual_review', actor: 'system', trigger: '仅命中 workOrder / replica 桥或仅有弱线索候选' },
    { from: 'normalized', to: 'exact_match', actor: 'system', trigger: '银行强锚点与业务稳定锚点唯一命中且无冲突' },
    { from: 'normalized', to: 'high_confidence_match', actor: 'system', trigger: '稳定业务锚点存在，但银行证据仍低于 exact 标准' },
    { from: 'normalized', to: 'conflicting_match', actor: 'system', trigger: '强锚点、金额方向或业务稳定锚点之间发生冲突' },
    { from: 'duplicate_candidate', to: 'weak_match_manual_review', actor: 'finance_data_review', trigger: '确认候选需要逐条拆分复核' },
    { from: 'duplicate_candidate', to: 'conflicting_match', actor: 'joint_review', trigger: '发现强锚点实际互相冲突' },
    { from: 'duplicate_candidate', to: 'rejected_for_projection', actor: 'finance_data_review', trigger: '人工判定证据不足且当前不应进入对照层' },
    { from: 'unmatched', to: 'weak_match_manual_review', actor: 'finance_data_review', trigger: '人工补入候选锚点或确认可比对目标' },
    { from: 'weak_match_manual_review', to: 'exact_match', actor: 'finance_data_review', trigger: '人工补齐银行证据并确认唯一候选' },
    { from: 'weak_match_manual_review', to: 'high_confidence_match', actor: 'finance_data_review', trigger: '人工确认首选候选，但银行证据仍未达到 exact' },
    { from: 'weak_match_manual_review', to: 'conflicting_match', actor: 'finance_data_review', trigger: '人工复核过程中发现多个候选都具备强证据' },
    { from: 'exact_match', to: 'approved_for_projection', actor: 'finance_data_review', trigger: '明确放行只读投影' },
    { from: 'high_confidence_match', to: 'approved_for_projection', actor: 'finance_data_review', trigger: '明确接受 high confidence 仅用于只读对照' },
    { from: 'exact_match', to: 'conflicting_match', actor: 'finance_audit', trigger: '后续出现新的强锚点冲突或审计反证' },
    { from: 'high_confidence_match', to: 'rejected_for_projection', actor: 'finance_data_review', trigger: '人工认为证据仍不足以支持页面对照' },
    { from: 'conflicting_match', to: 'rejected_for_projection', actor: 'joint_review', trigger: '联合裁定当前样本只能停留审计层' },
    { from: 'conflicting_match', to: 'exact_match', actor: 'joint_review', trigger: '联合裁定后仅剩单一可用目标且证据完整' },
    { from: 'approved_for_projection', to: 'conflicting_match', actor: 'finance_audit', trigger: '投影后新增证据表明当前 compare 结论存在冲突' },
    { from: 'rejected_for_projection', to: 'weak_match_manual_review', actor: 'finance_data_review', trigger: '补充新证据并重新发起人工复核' },
  ],
  manualReviewBoundaries: [
    { scenario: 'duplicate_candidate / unmatched 需要判断是否补锚、拆分或继续保留缺口', statuses: ['duplicate_candidate', 'unmatched'], requiredRoles: ['finance_data_review', 'data_governance'], systemMayDo: ['展示候选事件簇、缺失锚点和原始载荷摘要', '把样本推到 manual_review_queue 或 coverage_gap_signal'], systemMustNotDo: ['不得自动合并重复候选', '不得自动创建或改写 payment/payout/approval/work_order 对象'] },
    { scenario: 'weak/exact/high_confidence 的收款侧样本，需要决定是否放行只读 compare', statuses: ['weak_match_manual_review', 'exact_match', 'high_confidence_match'], requiredRoles: ['finance_data_review'], systemMayDo: ['展示候选目标、证据摘要、缺口摘要和建议放行范围', '生成 read_only_comparison 候选卡片'], systemMustNotDo: ['不得把 exact/high_confidence 自动推进成 payment_records 写入', '不得改变工资、included/pending/excluded 或 confirmed/inferred/uncertain'] },
    { scenario: '出款链路命中 payout_records / approval_requests，或任何 conflicting_match', statuses: ['weak_match_manual_review', 'exact_match', 'high_confidence_match', 'conflicting_match'], requiredRoles: ['finance_audit'], systemMayDo: ['把当前证据作为审计对照输入展示', '要求与 finance_data_review 或 data_governance 联合裁定'], systemMustNotDo: ['不得绕过审批边界直接认定 approval_requests 已完成真实出款', '不得把 payout_records 登记语义误读为银行主账'] },
    { scenario: '跨表桥接、锚点定义、replica 对齐规则需要调整', statuses: ['duplicate_candidate', 'unmatched', 'conflicting_match'], requiredRoles: ['data_governance'], systemMayDo: ['输出缺少的统一业务编号、桥接键和作用域说明', '把 replica_only / supporting_source 的边界固定在只读层'], systemMustNotDo: ['不得用人工备注硬补系统契约', '不得把 abc_sync_funds 或 payment_records 升格成银行真相源'] },
    { scenario: 'approved_for_projection / rejected_for_projection 的最终决定', statuses: ['approved_for_projection', 'rejected_for_projection'], requiredRoles: ['finance_data_review'], systemMayDo: ['生成或撤回只读投影', '保留审核人、审核时间、原因码和追溯号'], systemMustNotDo: ['不得把 projection 结果写回主对象字段', '不得把 reject 记录删除或覆盖成通过'] },
  ],
  adaptationBoundaries: [
    { target: 'approval_requests', currentRole: '审批控制对象，属于 supporting_source，不是银行真相源', adaptationMode: 'read_only_compare', readableJoinKeys: ['approvalNo', 'relatedWorkOrderId', 'workOrderNo'], supportingHints: ['amount', 'currentStatus', 'latestPayoutNo', 'latestPaymentNo', 'verificationCode'], projectionFields: ['matchedTargetType', 'matchedTargetId', 'matchedTargetNo', 'comparisonSummary', 'missingAnchorSummary', 'reviewDecision'], forbiddenActions: ['不得改 approval_requests.currentStatus', '不得改 approval_requests.finalApproverId', '不得把 verificationCode 升级成银行资金门禁', '不得把 staging 结果当成审批通过或付款已完成的自动依据'], note: '只负责读审批控制上下文 + 做只读对照，不越过审批/人工付款确认边界' },
    { target: 'payment_records', currentRole: '到账语义对象，属于 supporting_source，不是银行真相源', adaptationMode: 'read_only_compare', readableJoinKeys: ['paymentNo', 'workOrderId', 'workOrderNo'], supportingHints: ['amount', 'paidAt', 'paymentMethod', 'payerName', 'remark'], projectionFields: ['matchedTargetType', 'matchedTargetId', 'matchedTargetNo', 'comparisonSummary', 'safeProjectionPayload', 'projectionAuditRef'], forbiddenActions: ['不得改 payment_records.amount / paymentStatus / paidAt / payerName / remark', '不得把 staging 放行结果解释成到账语义已被银行自动确认', '不得反向触发 work_orders.amountReceived 更新'], note: '只增加只读 compare 视角，不能让 payment_records 升格为银行真相源' },
    { target: 'payout_records', currentRole: '付款登记对象，属于 not_truth_source，不是银行主账', adaptationMode: 'read_only_compare', readableJoinKeys: ['payoutNo', 'approvalRequestId', 'approvalNo', 'workOrderNo'], supportingHints: ['amount', 'paidAt', 'paymentMethod', 'payeeName'], projectionFields: ['matchedTargetType', 'matchedTargetId', 'matchedTargetNo', 'comparisonSummary', 'reviewDecision', 'projectionAuditRef'], forbiddenActions: ['不得扩 payout_records 命令壳', '不得改 payout_records.amount / paymentMethod / paidAt / payeeName', '不得把 payout_records 登记态写成银行主账事实'], note: '出款方向可以做只读 compare，但任何放行都只服务人工核对' },
    { target: 'abc_sync_funds', currentRole: '标准化同步副本，属于 replica_only，不是银行主账', adaptationMode: 'replica_compare', readableJoinKeys: ['sourceSystem+sourceTable+sourceId', 'rawTableName+rawRecordId'], supportingHints: ['sourceOrderNo', 'relatedOrderNo', 'amountStandard', 'directionStandard', 'statusStandard'], projectionFields: ['matchedTargetType', 'matchedTargetId', 'comparisonSummary', 'missingAnchorSummary', 'projectionAuditRef'], forbiddenActions: ['不得把 abc_sync_funds 当成银行主账', '不得改 abc_sync_funds.mappingConfirmed / mappingNotes / normalizedPayload', '不得让 replica 命中结果直接写回 payment/payout/approval'], note: '只承担副本侧核对价值；若没有先补齐副本到业务对象的稳定桥，就不能继续投影到资金主干' },
    { target: 'work_orders', currentRole: '业务主干桥接对象，不是资金真相对象本体', adaptationMode: 'bridge_only', readableJoinKeys: ['workOrderId', 'workOrderNo'], supportingHints: ['amountDue', 'customerMobile', 'status', 'remark'], projectionFields: ['matchedTargetType', 'matchedTargetId', 'matchedTargetNo', 'comparisonSummary', 'missingAnchorSummary'], forbiddenActions: ['不得改 work_orders.amountReceived / status', '不得把 work_orders 当成真实到账或真实出款对象', '不得把车牌号升格为 work_orders 的主绑定键；若需要客户身份辅助，只能沿用手机号主键链路'], note: '命中 workOrderNo 只能说明回到了业务上下文，不能直接认定 payment/payout' },
  ],
  projectionRules: [
    { projectionKind: 'staging_overview', allowedStatuses: ['ingested', 'normalized', 'duplicate_candidate', 'unmatched', 'weak_match_manual_review', 'exact_match', 'high_confidence_match', 'conflicting_match', 'approved_for_projection', 'rejected_for_projection'], outputFields: ['stagingRecordId', 'stagingStatus', 'direction', 'amount', 'occurredAt', 'matchedTargetType', 'matchedTargetNo', 'missingAnchorSummary', 'projectionStatus'], forbiddenDirectBusinessFields: FORBIDDEN_DIRECT_BUSINESS_FIELDS, note: '任何状态都可以上概览页，但概览页只读' },
    { projectionKind: 'manual_review_queue', allowedStatuses: ['duplicate_candidate', 'unmatched', 'weak_match_manual_review', 'exact_match', 'high_confidence_match', 'conflicting_match'], outputFields: ['stagingRecordId', 'stagingStatus', 'reviewQueueOwner', 'businessAnchorCandidates', 'missingAnchorSummary', 'comparisonSummary'], forbiddenDirectBusinessFields: FORBIDDEN_DIRECT_BUSINESS_FIELDS, note: '队列只负责分派与说明，不负责业务落账' },
    { projectionKind: 'read_only_comparison', allowedStatuses: ['weak_match_manual_review', 'exact_match', 'high_confidence_match', 'approved_for_projection'], outputFields: ['matchedTargetType', 'matchedTargetId', 'matchedTargetNo', 'comparisonSummary', 'safeProjectionPayload', 'projectionAuditRef'], forbiddenDirectBusinessFields: FORBIDDEN_DIRECT_BUSINESS_FIELDS, note: '只读对照卡可以展示候选目标和证据摘要，但绝不能把 compare 结果直推到主对象' },
    { projectionKind: 'duplicate_conflict_cluster', allowedStatuses: ['duplicate_candidate', 'conflicting_match'], outputFields: ['stagingRecordId', 'stagingStatus', 'businessAnchorCandidates', 'missingAnchorSummary', 'comparisonSummary'], forbiddenDirectBusinessFields: FORBIDDEN_DIRECT_BUSINESS_FIELDS, note: '聚类卡只帮助人工裁决，不允许系统自动合并或覆盖' },
    { projectionKind: 'coverage_gap_signal', allowedStatuses: ['unmatched', 'rejected_for_projection'], outputFields: ['stagingRecordId', 'stagingStatus', 'missingAnchorSummary', 'comparisonSummary', 'reviewDecision'], forbiddenDirectBusinessFields: FORBIDDEN_DIRECT_BUSINESS_FIELDS, note: '缺口信号用于治理与补锚，不用于凑闭环' },
  ],
  freezeRules: [
    { status: 'duplicate_candidate', stopReason: '疑似同一银行事件但缺少足够银行强锚点或账户作用域，不能安全合并', systemMustDo: ['保留每条 staging 记录与原始载荷', '显示相似依据、差异字段和缺失锚点', '推送到 finance_data_review / data_governance 的人工队列'], systemMustNotDo: ['不得静默合并', '不得删除任一候选', '不得把候选自动写入 payment/payout/approval/abc_sync_funds/work_orders'], releaseCondition: '只有在人工明确拆分、补充账户作用域或补齐银行强锚点后，才允许离开 duplicate_candidate' },
    { status: 'conflicting_match', stopReason: '强锚点或强候选互相冲突，系统无法安全决定唯一目标', systemMustDo: ['冻结自动排序结果', '并列展示所有冲突锚点、候选对象与差异', '升级到 finance_audit + data_governance 联合裁决'], systemMustNotDo: ['不得自行选边站', '不得自动修正已有业务主对象', '不得把 conflict 降级成 exact_match 或 approved_for_projection'], releaseCondition: '只有审计与治理共同确认冲突已解，且保留完整人工痕迹时，才允许回到 exact/high_confidence 或 reject' },
  ],
  nextPhaseEntryConditions: [
    { code: 'bank_anchor_coverage', description: '银行侧可稳定提供强证据锚点', threshold: '建议连续两轮样本中，绝大多数记录同时具备 sourceChannel + ingestionEventId，且至少具备 bankTransactionReference / bankReceiptReference / statementLineId 之一', unmetEffect: '做不到时，F8 前只能继续停留在 staging 概览与人工复核层' },
    { code: 'business_anchor_coverage', description: '显式业务锚点补齐到可审计水平', threshold: '建议未来准备放行的样本中，大多数能显式给出 paymentNo / payoutNo / approvalNo / workOrderNo 之一，且来源说明可追溯', unmetEffect: '若业务锚点仍主要靠金额时间猜测，则不能进入下一阶段' },
    { code: 'manual_review_sop', description: 'duplicate/conflict/approval-outflow 的人工复核 SOP 已被确认', threshold: 'finance_data_review、finance_audit、data_governance 三类角色的处理边界、升级路径和拒绝规则有书面确认', unmetEffect: '若 SOP 未确认，approved_for_projection 也只能停留在建议态' },
    { code: 'replica_boundary_fixed', description: 'replica_only / supporting_source / not_truth_source 的对象边界仍被明确锁定', threshold: 'approval_requests 继续是 supporting_source，payment_records 继续是 supporting_source，payout_records 继续是 not_truth_source，abc_sync_funds 继续是 replica_only', unmetEffect: '若对象角色被提前升格，就会污染银行真相输入设计' },
    { code: 'read_only_dry_run', description: '完成至少一轮只读 dry-run', threshold: 'dry-run 必须证明 approved_for_projection 仍不触发主对象写入、不触发工资变化、不触发 AI 执行', unmetEffect: '若 dry-run 证明不了边界安全，就不能进入任何半自动闭环阶段' },
  ],
  reviewChecklist: [
    '确认 approved_for_projection 仍只等于只读投影放行，不等于主对象写入放行',
    '确认 duplicate_candidate / conflicting_match 继续停在 staging，不做静默合并、不做自动修正',
    '确认 approval_requests / payment_records / payout_records / abc_sync_funds / work_orders 的对象角色没有被升格',
    '确认 verificationCode 继续只是审批提示，不是资金门禁',
    '确认没有新增 schema、没有新增写入、没有扩 payout_records 命令壳、没有接 AI focus',
    '确认 staging 结果不会改动工资、confirmed/inferred/uncertain 或 included/pending/excluded',
  ],
};
