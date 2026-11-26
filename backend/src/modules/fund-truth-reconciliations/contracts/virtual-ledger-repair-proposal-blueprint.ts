import { BankTruthReviewRole } from './bank-truth-input-contract';

export type RepairFieldRequirement = 'required' | 'conditional' | 'optional';

export type RepairProposalSeverity = 'high_risk' | 'critical';

export type RepairProposalRole =
  | 'system'
  | 'admin'
  | 'ai'
  | BankTruthReviewRole;

export type RepairWorkflowOwner = RepairProposalRole | 'joint_review';

export type RepairProposalStatus =
  | 'draft'
  | 'submitted'
  | 'approved_direction'
  | 'returned_for_evidence'
  | 'blocked';

export type EligibleRepairDifferenceType =
  | 'receipt_projection_missing_with_strong_evidence'
  | 'payout_projection_missing_with_strong_evidence'
  | 'projection_amount_mismatch_with_single_scope_anchor'
  | 'duplicate_projection_with_same_strong_bank_anchor'
  | 'internal_transfer_scope_misprojection_with_complete_pair'
  | 'approved_month_carry_forward_gap';

export type BlockedRepairDifferenceType =
  | 'weak_hint_only_difference'
  | 'bank_evidence_missing_or_not_traceable'
  | 'anomaly_ticket_missing'
  | 'compare_context_missing'
  | 'scope_or_company_conflict_unresolved'
  | 'internal_transfer_pair_incomplete'
  | 'month_end_packet_missing_for_carry_forward'
  | 'touches_status_boundaries'
  | 'requires_direct_balance_write_or_schema_change'
  | 'ai_only_without_human_draft'
  | 'bypasses_anomaly_or_month_end';

export type RepairEvidenceKind =
  | 'bank_observation_anchor'
  | 'vendor_real_payload_digest'
  | 'bank_truth_staging_reference'
  | 'monthly_statement_line_reference'
  | 'payment_business_reference'
  | 'approval_control_reference'
  | 'payout_business_reference'
  | 'internal_transfer_pair_reference'
  | 'fund_truth_comparison_reference'
  | 'monthly_reconciliation_reference'
  | 'anomaly_ticket_reference'
  | 'month_end_packet_reference'
  | 'scope_mapping_version_reference'
  | 'audit_event_reference'
  | 'audit_digest_reference'
  | 'external_evidence_bundle_reference';

export interface RepairFieldDefinition {
  field: string;
  requirement: RepairFieldRequirement;
  purpose: string;
  note: string;
  presenceRule?: string;
}

export interface RepairObjectContract {
  objectCode:
    | 'ledgerRepairProposal'
    | 'repairEvidenceBundle'
    | 'repairApprovalChain'
    | 'repairAuditLink'
    | 'repairBlockingReasons'
    | 'repairSeverityPolicy'
    | 'repairEligibilityRules';
  purpose: string;
  minimumFields: RepairFieldDefinition[];
  note: string;
}

export interface RepairEligibilityRule {
  ruleCode: string;
  differenceType: EligibleRepairDifferenceType;
  severityFloor: RepairProposalSeverity;
  requiredAnchors: string[];
  requiredRelations: string[];
  requiredEvidenceKinds: RepairEvidenceKind[];
  forbiddenWhen: string[];
  blockingReasonCodes: string[];
  note: string;
}

export interface RepairBlockedDifferenceRule {
  ruleCode: string;
  differenceType: BlockedRepairDifferenceType;
  blockingReason: string;
  requiredRouting: string[];
  note: string;
}

export interface RepairEvidencePolicy {
  policyCode: string;
  appliesTo: Array<EligibleRepairDifferenceType | 'all'>;
  requiredEvidenceKinds: RepairEvidenceKind[];
  requiredEvidenceRules: string[];
  missingEvidenceLeadsTo: string[];
  note: string;
}

export interface RepairApprovalStep {
  step:
    | 'system_precheck'
    | 'draft_and_evidence_fill'
    | 'governance_resolution'
    | 'direction_approval'
    | 'recheck';
  owner: RepairWorkflowOwner;
  appliesTo: Array<EligibleRepairDifferenceType | 'all'>;
  input: string[];
  output: string[];
  systemMustNotDo: string[];
  note: string;
}

export interface RepairRelationPolicy {
  relationKey:
    | 'anomaly_ticket'
    | 'monthly_reconciliation'
    | 'month_end_packet'
    | 'approval_payment_payout'
    | 'bank_evidence'
    | 'fund_truth'
    | 'audit_chain';
  appliesTo: Array<EligibleRepairDifferenceType | 'all'>;
  requiredRefs: string[];
  forbiddenConclusions: string[];
  note: string;
}

export interface RepairSeverityPolicyDefinition {
  policyCode: string;
  appliesTo: EligibleRepairDifferenceType[];
  severity: RepairProposalSeverity;
  escalationTriggers: string[];
  mandatoryApprover: 'finance_audit';
  mandatoryAuditArtifacts: string[];
  systemMustNotDo: string[];
  note: string;
}

export interface RepairRoleBoundary {
  role: RepairProposalRole;
  allowedActions: string[];
  forbiddenActions: string[];
  note: string;
}

export interface VirtualLedgerRepairProposalBlueprint {
  blueprintCode: string;
  version: string;
  mode: 'read_only_blueprint';
  stage: 'F7.10';
  scope: string;
  continuityNotes: string[];
  upstreamBlueprints: string[];
  hardGuards: string[];
  nonGoals: string[];
  objectContracts: {
    ledgerRepairProposal: RepairObjectContract;
    repairEvidenceBundle: RepairObjectContract;
    repairApprovalChain: RepairObjectContract;
    repairAuditLink: RepairObjectContract;
    repairBlockingReasons: RepairObjectContract;
    repairSeverityPolicy: RepairObjectContract;
    repairEligibilityRules: RepairObjectContract;
  };
  eligibleDifferences: RepairEligibilityRule[];
  blockedDifferences: RepairBlockedDifferenceRule[];
  evidencePolicies: RepairEvidencePolicy[];
  approvalWorkflow: RepairApprovalStep[];
  relationPolicies: RepairRelationPolicy[];
  severityPolicies: RepairSeverityPolicyDefinition[];
  roleBoundaries: RepairRoleBoundary[];
  nextGaps: string[];
  reviewChecklist: string[];
}

const LEDGER_REPAIR_PROPOSAL_FIELDS: RepairFieldDefinition[] = [
  { field: 'proposalId', requirement: 'required', purpose: '稳定主键', note: '未来若落库，必须保持可审计的稳定编号' },
  { field: 'proposalCode', requirement: 'required', purpose: '可读编号', note: '用于人工审批、复核、导出与对账引用' },
  { field: 'proposalStatus', requirement: 'required', purpose: '提案状态', note: '只允许 draft / submitted / approved_direction / returned_for_evidence / blocked' },
  { field: 'differenceType', requirement: 'required', purpose: '差异类型', note: '必须命中允许生成 proposal 的差异类型之一' },
  { field: 'repairActionSuggestion', requirement: 'required', purpose: '建议动作', note: '只能描述 suggestion，不等于执行命令' },
  { field: 'companyScopeCode', requirement: 'required', purpose: '公司归属', note: '没有公司归属，不得生成 proposal' },
  { field: 'virtualLedgerScopeKey', requirement: 'required', purpose: '虚拟账本作用域', note: '必须落到单一 scope' },
  { field: 'businessBucketKey', requirement: 'conditional', purpose: '业务桶位', note: 'external_receipt / external_payout / internal_transfer / carry_forward', presenceRule: '涉及余额型分录时必填' },
  { field: 'targetMonthKey', requirement: 'required', purpose: '影响月份', note: '用于挂月度核对与 month-end packet' },
  { field: 'proposedDirection', requirement: 'required', purpose: '建议方向', note: '只能是 in / out / internal / carry' },
  { field: 'proposedDeltaAmount', requirement: 'required', purpose: '建议 delta 金额', note: '只能描述建议金额，不能直接改余额' },
  { field: 'reasonSummary', requirement: 'required', purpose: '业务原因摘要', note: '不能空白，不能只留 AI 结论' },
  { field: 'evidenceBundleRef', requirement: 'required', purpose: '证据包引用', note: '必须指向 repairEvidenceBundle' },
  { field: 'anomalyTicketRef', requirement: 'required', purpose: '异常单引用', note: 'proposal 不能跳过 anomaly' },
  { field: 'approvalChainRef', requirement: 'required', purpose: '审批链引用', note: 'proposal 不得脱离审批链存在' },
  { field: 'auditLinkRef', requirement: 'required', purpose: '审计链引用', note: 'proposal 必须可追溯到 audit chain' },
  { field: 'createdByRole', requirement: 'required', purpose: '正式起草角色', note: '必须是 finance_data_review，不能是 system / admin / ai' },
  { field: 'aiSuggestionRef', requirement: 'conditional', purpose: 'AI 建议引用', note: '若使用 AI 草稿，必须保留建议引用与人工采纳说明', presenceRule: '引用 AI 建议时必填' },
  { field: 'createdAt', requirement: 'required', purpose: '起草时间', note: '用于审批、复核与审计排序' },
];

const REPAIR_EVIDENCE_BUNDLE_FIELDS: RepairFieldDefinition[] = [
  { field: 'evidenceBundleId', requirement: 'required', purpose: '证据包编号', note: '稳定引用 repairEvidenceBundle' },
  { field: 'bankEvidenceRefs', requirement: 'required', purpose: '银行证据引用集合', note: '至少有 bank_sms / vendor_real / staging / monthly_statement 之一' },
  { field: 'businessSemanticRefs', requirement: 'required', purpose: '业务语义对象引用', note: '收款至少挂 payment，出款至少挂 approval 或 payout' },
  { field: 'compareRefs', requirement: 'required', purpose: '对照上下文引用', note: '至少挂 fund_truth 或 monthly_reconciliation 之一' },
  { field: 'anomalyTicketRef', requirement: 'required', purpose: '异常单引用', note: '缺异常单不得升级 proposal' },
  { field: 'scopeMappingRefs', requirement: 'conditional', purpose: '治理映射证据', note: '涉及公司、作用域或契约冲突时必须补充', presenceRule: '作用域或契约冲突时必填' },
  { field: 'auditDigestRefs', requirement: 'required', purpose: '审计摘要引用', note: 'proposal 至少挂 auditDigest' },
  { field: 'externalEvidenceBundleRefs', requirement: 'conditional', purpose: '系统外封存引用', note: 'critical proposal 必须挂', presenceRule: 'critical proposal 时必填' },
  { field: 'missingEvidenceChecklist', requirement: 'required', purpose: '缺失证据清单', note: '任何未补齐项都必须显式列出' },
  { field: 'evidenceCompleteness', requirement: 'required', purpose: '证据完备度结论', note: '只能表达 complete / partial / blocked 类含义，不得自动转执行' },
];

const REPAIR_APPROVAL_CHAIN_FIELDS: RepairFieldDefinition[] = [
  { field: 'approvalChainId', requirement: 'required', purpose: '审批链编号', note: '把起草、审批、复核串起来' },
  { field: 'precheckOutcome', requirement: 'required', purpose: 'system_precheck 输出', note: '记录 eligibility 与 blocking reasons' },
  { field: 'draftOwner', requirement: 'required', purpose: '起草责任人', note: '必须是 finance_data_review' },
  { field: 'draftSubmittedAt', requirement: 'required', purpose: '提交审批时间', note: '用于审计追溯' },
  { field: 'governanceReviewRequired', requirement: 'required', purpose: '是否需要治理介入', note: '作用域、契约、归属冲突时必须标记 true' },
  { field: 'governanceResolutionRef', requirement: 'conditional', purpose: '治理结论引用', note: '若治理介入，必须可追溯', presenceRule: 'governanceReviewRequired=true 时必填' },
  { field: 'approvalOwner', requirement: 'required', purpose: '审批责任人', note: '必须是 finance_audit' },
  { field: 'approvalDecision', requirement: 'required', purpose: '审批方向结论', note: '只能批准方向、退回补证或退回 anomaly，不得直接执行修复' },
  { field: 'recheckOwner', requirement: 'required', purpose: '复核责任人', note: '通常为 finance_data_review，涉治理冲突时可联合复核' },
  { field: 'recheckDecision', requirement: 'required', purpose: '复核结论', note: '只能确认补证充分或继续阻断' },
  { field: 'returnedReason', requirement: 'conditional', purpose: '退回原因', note: '退回补证或退回异常单时必填', presenceRule: 'approvalDecision 或 recheckDecision 为 return 时必填' },
];

const REPAIR_AUDIT_LINK_FIELDS: RepairFieldDefinition[] = [
  { field: 'auditLinkId', requirement: 'required', purpose: '审计链接编号', note: '稳定挂 proposal、异常单、对照和审计摘要' },
  { field: 'proposalRef', requirement: 'required', purpose: 'proposal 引用', note: '反向定位 repair proposal' },
  { field: 'auditEventRef', requirement: 'required', purpose: '应用层审计事件', note: 'proposal 起草、审批、复核都要留痕' },
  { field: 'auditDigestRef', requirement: 'required', purpose: '审计摘要引用', note: 'proposal 必须进入 digest' },
  { field: 'externalEvidenceBundleRef', requirement: 'conditional', purpose: '系统外封存引用', note: 'critical proposal 必填', presenceRule: 'critical proposal 时必填' },
  { field: 'anomalyTicketRef', requirement: 'required', purpose: '异常单引用', note: 'proposal 必须附着异常链' },
  { field: 'monthlyReconciliationRef', requirement: 'conditional', purpose: '月度核对引用', note: '来自 statement compare 的 proposal 必填', presenceRule: 'statement / month-end 相关 proposal 时必填' },
  { field: 'monthEndPacketRef', requirement: 'conditional', purpose: '月结包引用', note: 'carry_forward 差异时必填', presenceRule: 'approved_month_carry_forward_gap 时必填' },
  { field: 'approvalRequestRefs', requirement: 'conditional', purpose: '审批对象引用', note: '出款相关 proposal 必须能追到 approval', presenceRule: 'direction=out 时通常必填' },
  { field: 'paymentRecordRefs', requirement: 'conditional', purpose: '收款对象引用', note: '收款相关 proposal 必须能追到 payment', presenceRule: 'direction=in 时通常必填' },
  { field: 'payoutRecordRefs', requirement: 'conditional', purpose: '付款登记引用', note: '出款相关 proposal 可挂 payout', presenceRule: 'direction=out 且存在 payout 语义时必填' },
  { field: 'bankEvidenceRefs', requirement: 'required', purpose: '银行证据引用', note: 'proposal 不得脱离银行证据' },
  { field: 'fundTruthReconciliationRefs', requirement: 'conditional', purpose: 'fund truth 对照引用', note: '若来自 fund-truth compare，必须保留', presenceRule: '命中 fund_truth compare 时必填' },
];

const REPAIR_BLOCKING_REASONS_FIELDS: RepairFieldDefinition[] = [
  { field: 'blockingReasonCode', requirement: 'required', purpose: '阻断原因编码', note: '用于 system_precheck 与人工补证' },
  { field: 'blockingStage', requirement: 'required', purpose: '阻断发生阶段', note: 'precheck / draft / approval / recheck' },
  { field: 'triggerCondition', requirement: 'required', purpose: '触发条件', note: '要能解释为什么被阻断' },
  { field: 'ownerToResolve', requirement: 'required', purpose: '谁负责消除阻断', note: '只能是 system / finance_data_review / finance_audit / data_governance' },
  { field: 'requiredEvidenceOrAction', requirement: 'required', purpose: '消除阻断所需补充项', note: '不能只写模糊备注' },
  { field: 'note', requirement: 'required', purpose: '补充说明', note: '解释为什么此阻断不可绕过' },
];

const REPAIR_SEVERITY_POLICY_FIELDS: RepairFieldDefinition[] = [
  { field: 'policyCode', requirement: 'required', purpose: '分级策略编号', note: '用于固定 proposal 的最低风险级别' },
  { field: 'differenceType', requirement: 'required', purpose: '差异类型', note: '必须指向允许 proposal 的差异类型' },
  { field: 'severity', requirement: 'required', purpose: '风险分级', note: '只能是 high_risk 或 critical' },
  { field: 'escalationTriggers', requirement: 'required', purpose: '升级触发条件', note: '解释为什么要升 critical' },
  { field: 'mandatoryApprover', requirement: 'required', purpose: '强制审批角色', note: '固定为 finance_audit' },
  { field: 'mandatoryAuditArtifacts', requirement: 'required', purpose: '强制审计材料', note: '至少 auditEvent + auditDigest；critical 还要 external bundle' },
  { field: 'note', requirement: 'required', purpose: '说明', note: '不能下滑到 warning 或 normal' },
];

const REPAIR_ELIGIBILITY_RULES_FIELDS: RepairFieldDefinition[] = [
  { field: 'ruleCode', requirement: 'required', purpose: '资格规则编号', note: '稳定标识一条 eligibility rule' },
  { field: 'differenceType', requirement: 'required', purpose: '差异类型', note: '指向 proposal 允许或禁止的差异类型' },
  { field: 'eligible', requirement: 'required', purpose: '是否可生成 proposal', note: '只允许 true / false 的资格判断' },
  { field: 'requiredAnchors', requirement: 'required', purpose: '必需锚点', note: '没有强锚点不得 proposal' },
  { field: 'requiredRelations', requirement: 'required', purpose: '必需关系对象', note: '至少 anomaly + compare + 方向对应对象' },
  { field: 'requiredEvidenceKinds', requirement: 'required', purpose: '必需证据种类', note: '缺证据必须阻断' },
  { field: 'forbiddenWhen', requirement: 'required', purpose: '禁止条件', note: '命中禁止条件则直接 blocked' },
  { field: 'blockingReasonCodes', requirement: 'required', purpose: '对应阻断编码', note: '用于 system_precheck 输出 repairBlockingReasons' },
  { field: 'note', requirement: 'required', purpose: '补充说明', note: '解释为什么允许或禁止' },
];

const OBJECT_CONTRACTS: VirtualLedgerRepairProposalBlueprint['objectContracts'] = {
  ledgerRepairProposal: {
    objectCode: 'ledgerRepairProposal',
    purpose: '描述一条虚拟金额修复建议，只表达 suggestion、风险、证据、审批与审计挂链，不表达执行结果。',
    minimumFields: LEDGER_REPAIR_PROPOSAL_FIELDS,
    note: 'proposal 只能由 finance_data_review 正式起草，不能由 system / admin / ai 直接创建为正式对象。',
  },
  repairEvidenceBundle: {
    objectCode: 'repairEvidenceBundle',
    purpose: '把银行证据、业务语义证据、compare 证据、异常链与审计链打成一个可追溯证据包。',
    minimumFields: REPAIR_EVIDENCE_BUNDLE_FIELDS,
    note: '证据包是 proposal 的最低门槛；缺银行证据、缺 compare、缺 anomaly、缺审计摘要都必须阻断。',
  },
  repairApprovalChain: {
    objectCode: 'repairApprovalChain',
    purpose: '固定 proposal 的 system_precheck、起草、治理介入、审批方向和复核路径。',
    minimumFields: REPAIR_APPROVAL_CHAIN_FIELDS,
    note: 'finance_data_review 只能起草与补证，finance_audit 只能批方向，任何角色都不能把审批等同于执行修复。',
  },
  repairAuditLink: {
    objectCode: 'repairAuditLink',
    purpose: '把 proposal 回挂到 anomaly、monthly reconciliation、month-end packet、approval/payment/payout、bank evidence 与 audit chain。',
    minimumFields: REPAIR_AUDIT_LINK_FIELDS,
    note: '没有 auditEvent / auditDigest / anomalyTicketRef 的 proposal 不成立；critical proposal 还必须进入 externalEvidenceBundle。',
  },
  repairBlockingReasons: {
    objectCode: 'repairBlockingReasons',
    purpose: '显式记录为什么这条差异不能生成 proposal，或为什么 proposal 仍然处于 blocked。',
    minimumFields: REPAIR_BLOCKING_REASONS_FIELDS,
    note: 'blocking reason 不能被静默吞掉，必须有负责解除的人和所需补充动作。',
  },
  repairSeverityPolicy: {
    objectCode: 'repairSeverityPolicy',
    purpose: '固定 proposal 只允许 high_risk / critical 两档，并写清升级条件与强制审计材料。',
    minimumFields: REPAIR_SEVERITY_POLICY_FIELDS,
    note: 'repair proposal 不存在 normal / warning 档，一旦生成 proposal 就最低 high_risk。',
  },
  repairEligibilityRules: {
    objectCode: 'repairEligibilityRules',
    purpose: '固定允许 proposal 的差异类型、禁止条件、必需关系、必需锚点与对应 blocking reason。',
    minimumFields: REPAIR_ELIGIBILITY_RULES_FIELDS,
    note: 'eligibility rule 是 system_precheck 的规则基础，但不能绕过人工起草、审批与复核。',
  },
};

const ELIGIBLE_DIFFERENCES: RepairEligibilityRule[] = [
  {
    ruleCode: 'receipt_projection_missing',
    differenceType: 'receipt_projection_missing_with_strong_evidence',
    severityFloor: 'high_risk',
    requiredAnchors: ['direction=in', '单一银行强锚点', '单一 paymentNo', '单一 companyScopeCode + virtualLedgerScopeKey'],
    requiredRelations: ['payment_records', 'fund_truth_reconciliations 或 monthly_reconciliation', 'anomaly_ticket'],
    requiredEvidenceKinds: ['bank_observation_anchor', 'payment_business_reference', 'fund_truth_comparison_reference', 'anomaly_ticket_reference', 'audit_digest_reference'],
    forbiddenWhen: ['只有 amount / occurredAt / memo 等弱线索', '作用域归属未确认', '缺 anomaly_ticket'],
    blockingReasonCodes: ['weak_hint_only_difference', 'scope_or_company_conflict_unresolved', 'anomaly_ticket_missing'],
    note: '允许建议补一条收款 projection 候选，但不得自动落余额。',
  },
  {
    ruleCode: 'payout_projection_missing',
    differenceType: 'payout_projection_missing_with_strong_evidence',
    severityFloor: 'high_risk',
    requiredAnchors: ['direction=out', '单一银行强锚点', '单一 approvalNo 或 payoutNo', '单一 companyScopeCode + virtualLedgerScopeKey'],
    requiredRelations: ['approval_requests 或 payout_records', 'fund_truth_reconciliations 或 monthly_reconciliation', 'anomaly_ticket'],
    requiredEvidenceKinds: ['bank_observation_anchor', 'approval_control_reference', 'payout_business_reference', 'anomaly_ticket_reference', 'audit_digest_reference'],
    forbiddenWhen: ['缺审批控制证据且缺 payout 语义对象', '作用域归属未确认', '缺 compare 上下文'],
    blockingReasonCodes: ['compare_context_missing', 'scope_or_company_conflict_unresolved', 'bank_evidence_missing_or_not_traceable'],
    note: '允许建议补一条出款 projection 候选，但不得把审批通过直接写成真实出款余额。',
  },
  {
    ruleCode: 'projection_amount_mismatch',
    differenceType: 'projection_amount_mismatch_with_single_scope_anchor',
    severityFloor: 'high_risk',
    requiredAnchors: ['同一银行强锚点', '同一业务锚点', '同一方向', '同一 companyScopeCode + virtualLedgerScopeKey'],
    requiredRelations: ['approval/payment/payout 方向对应对象', 'fund_truth_reconciliations 或 monthly_reconciliation', 'anomaly_ticket'],
    requiredEvidenceKinds: ['bank_observation_anchor', 'fund_truth_comparison_reference', 'monthly_reconciliation_reference', 'anomaly_ticket_reference', 'audit_digest_reference'],
    forbiddenWhen: ['存在多公司或多作用域冲突', 'delta 金额不明确', 'proposal 需要顺带改 confirmed / included 分层'],
    blockingReasonCodes: ['scope_or_company_conflict_unresolved', 'touches_status_boundaries', 'compare_context_missing'],
    note: '允许建议明确金额 delta，但 proposal 仍然只是建议，不是修复执行。',
  },
  {
    ruleCode: 'duplicate_projection',
    differenceType: 'duplicate_projection_with_same_strong_bank_anchor',
    severityFloor: 'critical',
    requiredAnchors: ['同一银行强锚点命中多个余额型分录', '重复命中都可追到单一 anomaly_ticket'],
    requiredRelations: ['fund_truth_reconciliations 或 monthly_reconciliation', 'anomaly_ticket', 'audit_chain'],
    requiredEvidenceKinds: ['bank_observation_anchor', 'fund_truth_comparison_reference', 'anomaly_ticket_reference', 'audit_event_reference', 'audit_digest_reference', 'external_evidence_bundle_reference'],
    forbiddenWhen: ['重复只是弱相似、没有强锚点', '还没确定哪条是重复投影'],
    blockingReasonCodes: ['weak_hint_only_difference', 'bank_evidence_missing_or_not_traceable'],
    note: '任何建议冲回、中和、去重已计入余额的 proposal 都必须 critical。',
  },
  {
    ruleCode: 'internal_transfer_scope_misprojection',
    differenceType: 'internal_transfer_scope_misprojection_with_complete_pair',
    severityFloor: 'high_risk',
    requiredAnchors: ['internalTransferGroupKey 完整', '来源与目标 companyScopeCode + virtualLedgerScopeKey 都已确认'],
    requiredRelations: ['internal transfer pair', 'anomaly_ticket', 'audit_chain'],
    requiredEvidenceKinds: ['internal_transfer_pair_reference', 'anomaly_ticket_reference', 'audit_event_reference', 'audit_digest_reference'],
    forbiddenWhen: ['内部转账配对不完整', '跨公司归属冲突未收口'],
    blockingReasonCodes: ['internal_transfer_pair_incomplete', 'scope_or_company_conflict_unresolved'],
    note: '同公司至少 high_risk；一旦跨公司或跨月结冻结边界，必须升级 critical。',
  },
  {
    ruleCode: 'approved_month_carry_forward_gap',
    differenceType: 'approved_month_carry_forward_gap',
    severityFloor: 'critical',
    requiredAnchors: ['上月人工通过的 month-end packet', '本月 opening_carry_forward 候选', '单一 companyScopeCode + virtualLedgerScopeKey'],
    requiredRelations: ['month_end_packet', 'monthly_reconciliation', 'anomaly_ticket', 'audit_chain'],
    requiredEvidenceKinds: ['month_end_packet_reference', 'monthly_reconciliation_reference', 'anomaly_ticket_reference', 'audit_event_reference', 'audit_digest_reference', 'external_evidence_bundle_reference'],
    forbiddenWhen: ['缺上月 month-end packet', '试图自动生成 opening_carry_forward'],
    blockingReasonCodes: ['month_end_packet_missing_for_carry_forward', 'bypasses_anomaly_or_month_end'],
    note: '结转差异只能形成 critical proposal，并进入 month-end 审查材料，不能自动结转。',
  },
];

const BLOCKED_DIFFERENCES: RepairBlockedDifferenceRule[] = [
  {
    ruleCode: 'blocked_weak_hint_only',
    differenceType: 'weak_hint_only_difference',
    blockingReason: '只有金额、时间、备注、对手方等弱线索，没有银行强锚点。',
    requiredRouting: ['保留在 anomaly_ticket', '由 finance_data_review 人工核对'],
    note: '弱规则不能直接升级成 repair proposal。',
  },
  {
    ruleCode: 'blocked_bank_evidence_missing',
    differenceType: 'bank_evidence_missing_or_not_traceable',
    blockingReason: '缺 bank_sms / vendor real / staging / monthly_statement 任何一种可追溯银行证据。',
    requiredRouting: ['保留在 anomaly_ticket', '先补银行证据摘要'],
    note: '没有可追溯银行证据，不存在 repair proposal。',
  },
  {
    ruleCode: 'blocked_anomaly_missing',
    differenceType: 'anomaly_ticket_missing',
    blockingReason: '没有 anomaly_ticket 上下文。',
    requiredRouting: ['先起异常单', '再进入 proposal 资格预检'],
    note: 'proposal 不得跳过 anomaly 链。',
  },
  {
    ruleCode: 'blocked_compare_missing',
    differenceType: 'compare_context_missing',
    blockingReason: '既没有 fund_truth compare，也没有 monthly reconciliation compare。',
    requiredRouting: ['留在 compare 准备层', '由 finance_data_review 或 data_governance 先补上下文'],
    note: 'proposal 必须建立在只读 compare 上下文之上。',
  },
  {
    ruleCode: 'blocked_scope_conflict',
    differenceType: 'scope_or_company_conflict_unresolved',
    blockingReason: '同一证据落入多个公司或多个虚拟账本作用域，归属未收口。',
    requiredRouting: ['交给 data_governance 处理映射 / 契约 / 作用域冲突'],
    note: '作用域未收口时，不得生成 proposal。',
  },
  {
    ruleCode: 'blocked_internal_transfer_pair_missing',
    differenceType: 'internal_transfer_pair_incomplete',
    blockingReason: 'internalTransferGroupKey 缺边或配对不完整。',
    requiredRouting: ['留在差异与异常单', '不得退化成外部收支'],
    note: '内部转账缺边时只能停留在 anomaly。',
  },
  {
    ruleCode: 'blocked_month_end_packet_missing',
    differenceType: 'month_end_packet_missing_for_carry_forward',
    blockingReason: 'carry_forward 差异没有上月人工通过的 month-end packet。',
    requiredRouting: ['留在 month-end 准备层', '由 finance_audit 决定是否补材料'],
    note: '没有 month-end packet，不得讨论 carry_forward repair proposal。',
  },
  {
    ruleCode: 'blocked_status_layers',
    differenceType: 'touches_status_boundaries',
    blockingReason: 'proposal 试图顺带修改 confirmed/inferred/uncertain 或 included/pending/excluded。',
    requiredRouting: ['绝对阻断', '退回 blueprint 讨论'],
    note: '36号不允许借 proposal 触碰状态分层。',
  },
  {
    ruleCode: 'blocked_direct_write_or_schema',
    differenceType: 'requires_direct_balance_write_or_schema_change',
    blockingReason: 'proposal 需要直接改余额、改 schema 或扩第三颗资金写入对象才能成立。',
    requiredRouting: ['绝对阻断', '退回 blueprint 讨论'],
    note: 'proposal 不能变成执行壳，更不能带出 schema 变更。',
  },
  {
    ruleCode: 'blocked_ai_only',
    differenceType: 'ai_only_without_human_draft',
    blockingReason: '只有 AI 建议，没有 finance_data_review 正式起草与补证。',
    requiredRouting: ['绝对阻断', '要求人工起草'],
    note: 'AI 只能 suggestion_only 或 operator_assist。',
  },
  {
    ruleCode: 'blocked_bypass_anomaly_month_end',
    differenceType: 'bypasses_anomaly_or_month_end',
    blockingReason: '试图绕过 anomaly 或 month-end packet 直接形成 proposal。',
    requiredRouting: ['绝对阻断', '回到 anomaly 或 month-end 评审链'],
    note: 'proposal 只能附着在异常单或月度核对链上。',
  },
];

const EVIDENCE_POLICIES: RepairEvidencePolicy[] = [
  {
    policyCode: 'all_proposals_require_bank_business_compare_anomaly_audit',
    appliesTo: ['all'],
    requiredEvidenceKinds: ['bank_observation_anchor', 'anomaly_ticket_reference', 'audit_digest_reference'],
    requiredEvidenceRules: ['所有 proposal 至少挂一个银行强锚点证据', '所有 proposal 至少挂 anomalyTicketRef', '所有 proposal 至少挂 auditDigestRef', '所有 proposal 至少挂 fund_truth compare 或 monthly_reconciliation compare 之一'],
    missingEvidenceLeadsTo: ['bank_evidence_missing_or_not_traceable', 'anomaly_ticket_missing', 'compare_context_missing'],
    note: 'proposal 不得脱离银行、compare、anomaly、audit 四条基础链。',
  },
  {
    policyCode: 'directional_business_semantics',
    appliesTo: ['receipt_projection_missing_with_strong_evidence', 'payout_projection_missing_with_strong_evidence', 'projection_amount_mismatch_with_single_scope_anchor'],
    requiredEvidenceKinds: ['payment_business_reference', 'approval_control_reference', 'payout_business_reference'],
    requiredEvidenceRules: ['direction=in 的 proposal 至少挂 payment_business_reference', 'direction=out 的 proposal 至少挂 approval_control_reference 或 payout_business_reference', '不能只挂 bank evidence 就绕开业务语义对象'],
    missingEvidenceLeadsTo: ['compare_context_missing', 'bank_evidence_missing_or_not_traceable'],
    note: '收支 proposal 必须保留业务语义对象，不能只凭银行证据直接下结论。',
  },
  {
    policyCode: 'critical_proposals_require_external_bundle',
    appliesTo: ['duplicate_projection_with_same_strong_bank_anchor', 'approved_month_carry_forward_gap'],
    requiredEvidenceKinds: ['audit_event_reference', 'audit_digest_reference', 'external_evidence_bundle_reference'],
    requiredEvidenceRules: ['critical proposal 必须同时挂 auditEvent + auditDigest + externalEvidenceBundle', '没有 externalEvidenceBundle 的 critical proposal 只能 blocked'],
    missingEvidenceLeadsTo: ['bank_evidence_missing_or_not_traceable'],
    note: 'critical proposal 不能只停留在主系统内摘要。',
  },
  {
    policyCode: 'governance_conflict_requires_mapping_refs',
    appliesTo: ['projection_amount_mismatch_with_single_scope_anchor', 'internal_transfer_scope_misprojection_with_complete_pair'],
    requiredEvidenceKinds: ['scope_mapping_version_reference'],
    requiredEvidenceRules: ['若 proposal 命中过 companyScope / virtualLedgerScope 冲突，必须补映射版本或契约版本'],
    missingEvidenceLeadsTo: ['scope_or_company_conflict_unresolved'],
    note: '治理冲突没有收口前，proposal 不能通过 precheck。',
  },
];

const APPROVAL_WORKFLOW: RepairApprovalStep[] = [
  {
    step: 'system_precheck',
    owner: 'system',
    appliesTo: ['all'],
    input: ['differenceType', '银行证据摘要', 'compare 上下文', 'anomalyTicketRef'],
    output: ['eligibility 结论', 'repairBlockingReasons', 'severity floor', 'deterministic evidence refs'],
    systemMustNotDo: ['不得生成正式 ledgerRepairProposal', '不得清空 blocking reason', '不得直接改余额'],
    note: 'system 只做规则预检，不进入正式起草。',
  },
  {
    step: 'draft_and_evidence_fill',
    owner: 'finance_data_review',
    appliesTo: ['all'],
    input: ['precheck 输出', '补证材料', '业务原因'],
    output: ['ledgerRepairProposal draft', 'repairEvidenceBundle', 'repairApprovalChain 初稿'],
    systemMustNotDo: ['不得自批通过', '不得直接改余额', '不得顺带改状态分层'],
    note: 'finance_data_review 只能起草与补证。',
  },
  {
    step: 'governance_resolution',
    owner: 'data_governance',
    appliesTo: ['projection_amount_mismatch_with_single_scope_anchor', 'internal_transfer_scope_misprojection_with_complete_pair'],
    input: ['scopeMappingRefs', '契约冲突说明'],
    output: ['governanceResolutionRef'],
    systemMustNotDo: ['不得替代 finance_audit 审批', '不得把弱规则写成正式资金结论'],
    note: '只在映射、契约、作用域冲突时介入。',
  },
  {
    step: 'direction_approval',
    owner: 'finance_audit',
    appliesTo: ['all'],
    input: ['proposal draft', 'evidence bundle', 'blocking reasons 清单'],
    output: ['approved_direction 或 returned_for_evidence 或退回 anomaly'],
    systemMustNotDo: ['不得直接执行修复', '不得跳过 anomaly 或 month-end 边界'],
    note: 'finance_audit 只批方向和风险，不批执行。',
  },
  {
    step: 'recheck',
    owner: 'joint_review',
    appliesTo: ['duplicate_projection_with_same_strong_bank_anchor', 'internal_transfer_scope_misprojection_with_complete_pair', 'approved_month_carry_forward_gap'],
    input: ['approval direction', '补证结果', 'governanceResolutionRef(如有)'],
    output: ['recheckDecision', '是否保留 blocked'],
    systemMustNotDo: ['不得把复核写成执行修复', '不得绕过 finance_data_review / data_governance 的边界'],
    note: '普通场景可由 finance_data_review 复核；跨公司、重复投影、carry_forward 差异建议联合复核。',
  },
];

const RELATION_POLICIES: RepairRelationPolicy[] = [
  {
    relationKey: 'anomaly_ticket',
    appliesTo: ['all'],
    requiredRefs: ['anomalyTicketRef', 'varianceCode', '当前异常状态'],
    forbiddenConclusions: ['不得没有异常单就直接 proposal', '不得把 proposal 等同于异常已关闭'],
    note: 'proposal 必须附着 anomaly 链，而不是替代 anomaly。',
  },
  {
    relationKey: 'monthly_reconciliation',
    appliesTo: ['receipt_projection_missing_with_strong_evidence', 'payout_projection_missing_with_strong_evidence', 'projection_amount_mismatch_with_single_scope_anchor', 'duplicate_projection_with_same_strong_bank_anchor', 'approved_month_carry_forward_gap'],
    requiredRefs: ['monthlyReconciliationRef 或 monthKey compare 引用'],
    forbiddenConclusions: ['不得把月度核对差异自动关平', '不得把 proposal 自动推进 month-end 正式结论'],
    note: '月度核对是 proposal 的 compare 来源之一，不是自动执行层。',
  },
  {
    relationKey: 'month_end_packet',
    appliesTo: ['approved_month_carry_forward_gap'],
    requiredRefs: ['monthEndPacketRef', '上月人工通过结论', '本月 carry_forward 候选'],
    forbiddenConclusions: ['不得自动生成 opening_carry_forward', '不得跳过 finance_audit 直接形成结转结论'],
    note: 'carry_forward 差异只能挂 month-end packet，不得脱离月结材料。',
  },
  {
    relationKey: 'approval_payment_payout',
    appliesTo: ['receipt_projection_missing_with_strong_evidence', 'payout_projection_missing_with_strong_evidence', 'projection_amount_mismatch_with_single_scope_anchor'],
    requiredRefs: ['payment_records / approval_requests / payout_records 的方向对应引用'],
    forbiddenConclusions: ['不得把 approval/payment/payout 写成银行真相', '不得把 approval/payment/payout 写成执行修复入口'],
    note: '它们只提供业务语义与控制链证据。',
  },
  {
    relationKey: 'bank_evidence',
    appliesTo: ['all'],
    requiredRefs: ['bank_sms / vendor_real / bank_truth_staging / monthly_statement 的至少一种引用'],
    forbiddenConclusions: ['不得无银行证据 proposal', '不得把银行证据直接解释为余额已修复'],
    note: 'bank evidence 只负责说明看见了什么，不负责自动修账。',
  },
  {
    relationKey: 'fund_truth',
    appliesTo: ['receipt_projection_missing_with_strong_evidence', 'payout_projection_missing_with_strong_evidence', 'projection_amount_mismatch_with_single_scope_anchor', 'duplicate_projection_with_same_strong_bank_anchor'],
    requiredRefs: ['fundTruthReconciliationRef 或 compare 摘要'],
    forbiddenConclusions: ['不得把 fund_truth compare 自动闭环成修复结果', '不得把 fund_truth 升级成新的写对象'],
    note: 'fund_truth 继续只做 compare 与映射准备。',
  },
  {
    relationKey: 'audit_chain',
    appliesTo: ['all'],
    requiredRefs: ['auditEventRef', 'auditDigestRef', 'critical 时 externalEvidenceBundleRef'],
    forbiddenConclusions: ['不得无审计链 proposal', '不得把审计链存在等同于修复已执行'],
    note: 'proposal 只进入审计链，不由审计链反向驱动执行。',
  },
];

const SEVERITY_POLICIES: RepairSeverityPolicyDefinition[] = [
  {
    policyCode: 'receipt_missing_projection_high_risk',
    appliesTo: ['receipt_projection_missing_with_strong_evidence'],
    severity: 'high_risk',
    escalationTriggers: ['若发现跨公司归属冲突则升级 critical', '若审计摘要缺失则升级 critical'],
    mandatoryApprover: 'finance_audit',
    mandatoryAuditArtifacts: ['auditEventRef', 'auditDigestRef'],
    systemMustNotDo: ['不得降到 warning 或 normal', '不得无审批直接通过'],
    note: '收款 projection 缺失 proposal 的最低级别是 high_risk。',
  },
  {
    policyCode: 'payout_missing_projection_high_risk',
    appliesTo: ['payout_projection_missing_with_strong_evidence'],
    severity: 'high_risk',
    escalationTriggers: ['若同时缺 approval/payout 业务语义则 blocked', '若跨公司则升级 critical'],
    mandatoryApprover: 'finance_audit',
    mandatoryAuditArtifacts: ['auditEventRef', 'auditDigestRef'],
    systemMustNotDo: ['不得把审批通过直接写成执行修复'],
    note: '出款 projection 缺失 proposal 至少 high_risk。',
  },
  {
    policyCode: 'single_scope_delta_high_risk',
    appliesTo: ['projection_amount_mismatch_with_single_scope_anchor'],
    severity: 'high_risk',
    escalationTriggers: ['若 scope 冲突未收口则 blocked', '若跨月结冻结边界则升级 critical'],
    mandatoryApprover: 'finance_audit',
    mandatoryAuditArtifacts: ['auditEventRef', 'auditDigestRef'],
    systemMustNotDo: ['不得顺带改 confirmed / included 等状态分层'],
    note: '明确 delta 的单一作用域 proposal 至少 high_risk。',
  },
  {
    policyCode: 'duplicate_projection_critical',
    appliesTo: ['duplicate_projection_with_same_strong_bank_anchor'],
    severity: 'critical',
    escalationTriggers: ['命中重复 projection', '建议冲回或中和已计入余额的分录'],
    mandatoryApprover: 'finance_audit',
    mandatoryAuditArtifacts: ['auditEventRef', 'auditDigestRef', 'externalEvidenceBundleRef'],
    systemMustNotDo: ['不得只凭弱相似就判断重复'],
    note: '重复 projection 属于 critical，不得下滑。',
  },
  {
    policyCode: 'internal_transfer_pair_repair',
    appliesTo: ['internal_transfer_scope_misprojection_with_complete_pair'],
    severity: 'high_risk',
    escalationTriggers: ['跨公司时升级 critical', '跨月结冻结边界时升级 critical'],
    mandatoryApprover: 'finance_audit',
    mandatoryAuditArtifacts: ['auditEventRef', 'auditDigestRef'],
    systemMustNotDo: ['不得把内部转账回退成外部收支'],
    note: '内部转账 proposal 同公司至少 high_risk，跨公司必须 critical。',
  },
  {
    policyCode: 'carry_forward_gap_critical',
    appliesTo: ['approved_month_carry_forward_gap'],
    severity: 'critical',
    escalationTriggers: ['命中 opening_carry_forward 差异', '涉及 month-end packet', '涉及上月已通过结转结论'],
    mandatoryApprover: 'finance_audit',
    mandatoryAuditArtifacts: ['auditEventRef', 'auditDigestRef', 'externalEvidenceBundleRef'],
    systemMustNotDo: ['不得自动生成 opening_carry_forward'],
    note: 'carry_forward gap 永远 critical。',
  },
];

const ROLE_BOUNDARIES: RepairRoleBoundary[] = [
  {
    role: 'system',
    allowedActions: ['计算 eligibility', '输出 repairBlockingReasons', '汇总 deterministic evidence refs', '计算 severity floor'],
    forbiddenActions: ['不得创建正式 ledgerRepairProposal', '不得清空 blocking reason', '不得直接改余额', '不得跳过 anomaly 或 month-end'],
    note: 'system 只负责资格预检和摘要聚合。',
  },
  {
    role: 'finance_data_review',
    allowedActions: ['起草 proposal', '补业务原因', '补证', '初核与复核'],
    forbiddenActions: ['不得直接改余额', '不得自己审批通过', '不得顺带改 confirmed / inferred / uncertain', '不得顺带改 included / pending / excluded'],
    note: 'finance_data_review 只能起草 / 补证 / 初核，不是执行者。',
  },
  {
    role: 'finance_audit',
    allowedActions: ['审批处理方向', '要求补证', '决定是否进入 month-end 审查材料', '确认 high_risk / critical 不下滑'],
    forbiddenActions: ['不得直接修余额', '不得把审批等同执行', '不得绕过 anomaly'],
    note: 'finance_audit 负责风险方向，不负责直接修账。',
  },
  {
    role: 'data_governance',
    allowedActions: ['处理映射冲突', '处理契约冲突', '处理 companyScope / virtualLedgerScope 作用域冲突'],
    forbiddenActions: ['不得替代 finance_audit 审批财务方向', '不得把弱规则写成正式结论', '不得把治理结论直接写成余额修复'],
    note: 'data_governance 只处理映射 / 契约 / 作用域冲突。',
  },
  {
    role: 'admin',
    allowedActions: ['查看 proposal 链路', '查看与导出审计材料', '督办补证或复核'],
    forbiddenActions: ['不得绕过 proposal 直接改余额', '不得跳过审批链', '不得直接清除 blocking reason'],
    note: 'admin 不是修复豁免角色。',
  },
  {
    role: 'ai',
    allowedActions: ['生成差异摘要', '生成缺失证据清单', '生成 suggestion_only 草稿文案', '提示 blocking reason'],
    forbiddenActions: ['不得创建正式 ledgerRepairProposal', '不得成为审批人', '不得成为复核人', '不得成为执行者', '不得消除 blocking reason'],
    note: 'AI 只能停留在 suggestion_only 或 operator_assist。',
  },
];

const NEXT_GAPS = [
  '本轮只定义 blueprint，还没有 proposal 落地对象与前端 UI。',
  'duplicate projection 的未来执行壳还未定义，本轮只允许 suggestion。',
  'internalTransferGroupKey、companyScopeCode、virtualLedgerScopeKey 的跨模块统一命名仍需继续收口。',
  'critical proposal 需要的 externalEvidenceBundle 目前只定义挂链规则，尚未接真实存储。',
  'proposal 与 future execution command 的分界仍需下一轮单独审查，避免 suggestion 层越权为 execution 层。',
];

const REVIEW_CHECKLIST = [
  '确认 repair proposal 继续只是建议，不是执行命令。',
  '确认允许 proposal 的 6 类差异没有越界到弱规则、缺证据、缺异常单场景。',
  '确认 ledgerRepairProposal / repairEvidenceBundle / repairApprovalChain / repairAuditLink / repairBlockingReasons / repairSeverityPolicy / repairEligibilityRules 七个对象最小字段完整。',
  '确认所有 proposal 继续挂在 anomaly / monthly_reconciliation / audit_chain / approval / payment / payout / bank-sms / fund-truth 之上。',
  '确认 high_risk / critical 分级不下滑，尤其 duplicate projection、跨公司 internal transfer、carry_forward gap 继续保持 critical。',
  '确认 finance_data_review / finance_audit / data_governance / admin / AI 没有串岗。',
  '确认本轮仍未越过自动修余额、状态分层变更、schema 变更、第三颗资金写入对象这些禁区。',
];

export const VIRTUAL_LEDGER_REPAIR_PROPOSAL_BLUEPRINT: VirtualLedgerRepairProposalBlueprint = {
  blueprintCode: 'fund_truth.virtual_ledger_repair_proposal_blueprint',
  version: '2026-04-17.f7.10-virtual-ledger-repair-proposal-blueprint',
  mode: 'read_only_blueprint',
  stage: 'F7.10',
  scope:
    '定义虚拟金额修复建议命令的允许差异类型、阻断原因、证据包、审批链、复核链、审计链与 AI 边界，只输出 proposal blueprint，不进入执行实现。',
  continuityNotes: [
    'approval_request_command、payment_record_command、fund_truth_reconciliation、bank-truth-input-contract、bank-truth-staging-blueprint、厂家真实接口只读适配层、多公司账户归属蓝图、多公司虚拟账本蓝图、月度银行流水导入核对蓝图、数据库审计链与不可抵赖留痕蓝图都已进入可封版状态。',
    '35号已确认三层审计链边界成立、high_risk / critical 分级够硬、AI 仍只停在建议层，因此 36号只允许进入 blueprint，不进入实现。',
    '本轮 repair proposal 继续附着在 anomaly / monthly_reconciliation / audit_chain / approval / payment / payout / bank-sms / fund-truth 之上，不反向改写它们的行为。',
  ],
  upstreamBlueprints: [
    'fund_truth.bank_truth_input_contract@2026-04-16.f6-read-only-blueprint',
    'fund_truth.bank_truth_staging_blueprint@2026-04-16.f7-read-only-staging-blueprint',
    'fund_truth.multi_company_virtual_ledger_blueprint@2026-04-17.f7.7-multi-company-virtual-ledger-blueprint',
    'fund_truth.monthly_bank_statement_reconciliation_blueprint@2026-04-17.f7.8-monthly-bank-statement-reconciliation-blueprint',
    'fund_truth.database_audit_and_nonrepudiation_blueprint@2026-04-17.f7.9-database-audit-and-nonrepudiation-blueprint',
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
    '不做虚拟余额自动修复',
    '不做自动对账闭环',
    '不扩第三颗资金写入对象',
    'AI 只能建议，不得成为执行者',
    'repair proposal 只是建议对象，不是执行命令，不是资金主账，不是新的写入口',
  ],
  nonGoals: [
    '本轮不新增 proposal 落库表、不新增 schema、不新增写入 API',
    '本轮不自动修余额、不自动关异常单、不自动生成 opening_carry_forward',
    '本轮不改 approval_requests / payment_records / payout_records / fund_truth_reconciliations 的行为',
    '本轮不把 bank_sms 或厂家真实接口升级成直接记账权',
    '本轮不做 month-end 自动闭环',
    '本轮不让 admin 绕过 proposal 直接改余额',
    '本轮不让 AI 起草正式 proposal 或参与审批/复核',
  ],
  objectContracts: OBJECT_CONTRACTS,
  eligibleDifferences: ELIGIBLE_DIFFERENCES,
  blockedDifferences: BLOCKED_DIFFERENCES,
  evidencePolicies: EVIDENCE_POLICIES,
  approvalWorkflow: APPROVAL_WORKFLOW,
  relationPolicies: RELATION_POLICIES,
  severityPolicies: SEVERITY_POLICIES,
  roleBoundaries: ROLE_BOUNDARIES,
  nextGaps: NEXT_GAPS,
  reviewChecklist: REVIEW_CHECKLIST,
};
