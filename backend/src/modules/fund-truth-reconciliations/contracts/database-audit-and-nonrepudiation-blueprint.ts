import { BankTruthReviewRole } from './bank-truth-input-contract';

export type AuditChainLayer =
  | 'application_business_audit'
  | 'database_sensitive_audit'
  | 'external_nonrepudiation_evidence';

export type AuditSeverity = 'normal' | 'warning' | 'high_risk' | 'critical';

export type AuditFieldRequirement = 'required' | 'conditional' | 'optional';

export type AuditActorRole =
  | 'system'
  | 'service_account'
  | 'admin'
  | 'finance'
  | BankTruthReviewRole
  | 'ai';

export type AuditIntegrationTarget =
  | 'approval_requests'
  | 'payment_records'
  | 'payout_records'
  | 'bank_sms'
  | 'fund_truth'
  | 'multi_company_virtual_ledger'
  | 'monthly_statement_reconciliation';

export type DbSensitiveActionKind =
  | 'sensitive_table_update'
  | 'sensitive_table_delete'
  | 'ddl'
  | 'privileged_login'
  | 'non_app_account_table_change'
  | 'bulk_modify';

export type ExternalStorageTarget =
  | 'independent_audit_storage'
  | 'independent_object_storage'
  | 'independent_audit_database'
  | 'offline_archive';

export interface AuditFieldDefinition {
  field: string;
  requirement: AuditFieldRequirement;
  purpose: string;
  note: string;
  presenceRule?: string;
}

export interface AuditLayerDefinition {
  layer: AuditChainLayer;
  purpose: string;
  minimumArtifacts: string[];
  mustLinkTo: string[];
  systemMustNotDo: string[];
  note: string;
}

export interface AuditObjectContract {
  objectCode:
    | 'auditEvent'
    | 'auditDigest'
    | 'externalEvidenceBundle'
    | 'dbSensitiveAction'
    | 'ledgerRepairProposalLink'
    | 'monthEndApprovalAuditLink'
    | 'anomalyTicketAuditLink';
  purpose: string;
  linkedLayers: AuditChainLayer[];
  minimumFields: AuditFieldDefinition[];
  note: string;
}

export interface DbSensitiveCoveragePolicy {
  actionKind: DbSensitiveActionKind;
  coveredTargets: string[];
  detectionSignals: string[];
  severityFloor: AuditSeverity;
  requiredLinks: string[];
  systemMustNotDo: string[];
  note: string;
}

export interface ExternalNonRepudiationPolicy {
  ruleKey: string;
  appliesToSeverities: AuditSeverity[];
  auditSummaryDefinition: string;
  digestRequirements: string[];
  exportCycle: string;
  independentStorageTargets: ExternalStorageTarget[];
  nonRepudiationRequirements: string[];
  exportFailureSeverity: 'high_risk' | 'critical';
  note: string;
}

export interface AuditSeverityDefinition {
  severity: AuditSeverity;
  description: string;
  typicalTriggers: string[];
  minimumResponse: string[];
  externalizationSla: string;
}

export interface MandatoryHighRiskTrigger {
  action: string;
  minimumSeverity: 'high_risk' | 'critical';
  requiredLinks: string[];
  note: string;
}

export interface AuditRelationPolicy {
  relationKey:
    | 'anomaly_ticket'
    | 'ledger_repair_proposal'
    | 'month_end_approval'
    | 'virtual_ledger';
  purpose: string;
  requiredObjects: string[];
  requiredEvidence: string[];
  forbiddenConclusions: string[];
  note: string;
}

export interface AuditRoleBoundary {
  role: AuditActorRole;
  allowedActions: string[];
  forbiddenActions: string[];
  note: string;
}

export interface AuditIntegrationBoundary {
  target: AuditIntegrationTarget;
  currentRole: string;
  auditCoverage: string[];
  forbiddenBehaviorChanges: string[];
  note: string;
}

export interface DatabaseAuditAndNonRepudiationBlueprint {
  blueprintCode: string;
  version: string;
  mode: 'read_only_blueprint';
  stage: 'F7.9';
  scope: string;
  continuityNotes: string[];
  upstreamBlueprints: string[];
  hardGuards: string[];
  nonGoals: string[];
  layerDefinitions: AuditLayerDefinition[];
  objectContracts: {
    auditEvent: AuditObjectContract;
    auditDigest: AuditObjectContract;
    externalEvidenceBundle: AuditObjectContract;
    dbSensitiveAction: AuditObjectContract;
    ledgerRepairProposalLink: AuditObjectContract;
    monthEndApprovalAuditLink: AuditObjectContract;
    anomalyTicketAuditLink: AuditObjectContract;
  };
  databaseCoverage: DbSensitiveCoveragePolicy[];
  externalNonRepudiationPolicies: ExternalNonRepudiationPolicy[];
  severityDefinitions: AuditSeverityDefinition[];
  highRiskTriggers: MandatoryHighRiskTrigger[];
  relationPolicies: AuditRelationPolicy[];
  roleBoundaries: AuditRoleBoundary[];
  integrationBoundaries: AuditIntegrationBoundary[];
  nextGaps: string[];
  reviewChecklist: string[];
}

const AUDIT_EVENT_FIELDS: AuditFieldDefinition[] = [
  { field: 'auditEventId', requirement: 'required', purpose: '记录审计事件编号', note: '作为应用层业务留痕的稳定主键' },
  { field: 'auditChainId', requirement: 'required', purpose: '记录所属审计链编号', note: '用于把应用层、数据库层与系统外摘要链串起来' },
  { field: 'layer', requirement: 'required', purpose: '记录当前审计层级', note: '应用层事件必须明确标记为 application_business_audit' },
  { field: 'severity', requirement: 'required', purpose: '记录事件风险分级', note: '用于决定是否进入同日导出与专项封存' },
  { field: 'actor', requirement: 'required', purpose: '记录谁发起动作', note: '至少保留 actorId、actorRole、actorType、currentUserRef 与 sessionFingerprint' },
  { field: 'action', requirement: 'required', purpose: '记录动作名称', note: '例如 create_proposal、close_anomaly、approve_month_end' },
  { field: 'objectType', requirement: 'required', purpose: '记录作用对象类型', note: '例如 approval_requests、payment_records、ledger_repair_proposal' },
  { field: 'objectId', requirement: 'required', purpose: '记录对象编号', note: '不能只写自由文本备注' },
  { field: 'before', requirement: 'conditional', purpose: '记录动作前快照或差异摘要', note: '纯只读动作可为空', presenceRule: '敏感状态修正、关闭、审批、建议升级时提供' },
  { field: 'after', requirement: 'conditional', purpose: '记录动作后快照或差异摘要', note: '纯只读动作可为空', presenceRule: '敏感状态修正、关闭、审批、建议升级时提供' },
  { field: 'reason', requirement: 'required', purpose: '记录原因', note: '不能空着' },
  { field: 'relatedApprovalRef', requirement: 'conditional', purpose: '关联审批引用', note: '命中审批/付款/收款关键状态修正时提供', presenceRule: '高风险动作时提供' },
  { field: 'relatedExceptionTicketRef', requirement: 'conditional', purpose: '关联异常单引用', note: '命中异常链动作时提供', presenceRule: '异常处理时提供' },
  { field: 'relatedRepairTicketRef', requirement: 'conditional', purpose: '关联修复建议或修复单引用', note: '命中余额调整建议时提供', presenceRule: '修复建议时提供' },
  { field: 'aiParticipation', requirement: 'required', purpose: '记录 AI 是否参与建议', note: 'AI 只能停在建议层' },
  { field: 'evidenceRefs', requirement: 'required', purpose: '引用摘要、回单、截图、导出包等证据', note: '至少要能回到 digest 或外部证据包' },
  { field: 'happenedAt', requirement: 'required', purpose: '记录事件发生时间', note: '用于和数据库动作、digest、导出时间对齐' },
];

const AUDIT_DIGEST_FIELDS: AuditFieldDefinition[] = [
  { field: 'auditDigestId', requirement: 'required', purpose: '摘要编号', note: '系统外导出与追溯的稳定引用' },
  { field: 'windowStart', requirement: 'required', purpose: '摘要窗口起点', note: '定义摘要覆盖区间' },
  { field: 'windowEnd', requirement: 'required', purpose: '摘要窗口终点', note: '定义摘要覆盖区间' },
  { field: 'digestAlgorithm', requirement: 'required', purpose: '摘要算法', note: '必须固定写进摘要' },
  { field: 'digestValue', requirement: 'required', purpose: '当前摘要值', note: '不可抵赖链核心' },
  { field: 'previousDigestValue', requirement: 'conditional', purpose: '上一个摘要值', note: '用于形成链式追溯', presenceRule: '非第一包摘要时提供' },
  { field: 'includedAuditEventRefs', requirement: 'required', purpose: '包含哪些应用层事件', note: '至少保留引用清单或分组摘要' },
  { field: 'includedDbSensitiveActionRefs', requirement: 'required', purpose: '包含哪些数据库敏感动作', note: '保证应用层和数据库层不脱链' },
  { field: 'exportStatus', requirement: 'required', purpose: '记录导出状态', note: '导出失败本身也要留下高风险痕迹' },
  { field: 'exportedAt', requirement: 'conditional', purpose: '记录摘要导出时间', note: '用于校验按日或同日导出 SLA', presenceRule: '发生导出尝试或导出状态变更时提供' },
];

const EXTERNAL_EVIDENCE_BUNDLE_FIELDS: AuditFieldDefinition[] = [
  { field: 'bundleId', requirement: 'required', purpose: '导出包编号', note: '系统外不可抵赖留痕的独立对象号' },
  { field: 'bundleSequence', requirement: 'required', purpose: '导出包序号', note: '要求单调递增，防止静默覆盖' },
  { field: 'auditDigestRefs', requirement: 'required', purpose: '包含哪些摘要', note: '允许多个摘要封包' },
  { field: 'bundleDigest', requirement: 'required', purpose: '包级摘要值', note: '对整个导出包做二次 digest' },
  { field: 'exportCycle', requirement: 'required', purpose: '记录导出周期', note: '区分日常导出和高风险即时导出' },
  { field: 'independentStorageTarget', requirement: 'required', purpose: '记录独立存储目标', note: '必须独立于主应用数据库和主宿主机' },
  { field: 'storageLocator', requirement: 'required', purpose: '记录外部定位信息', note: '便于系统外复核' },
  { field: 'retentionMode', requirement: 'required', purpose: '记录保存模式', note: '至少声明 immutable 或 tamper-evident 要求' },
  { field: 'tamperEvidentRequirements', requirement: 'required', purpose: '记录防篡改要求', note: '例如摘要链、只追加、外部校验' },
  { field: 'exportOperator', requirement: 'required', purpose: '记录谁发起或确认导出', note: 'AI 不能成为唯一导出责任人' },
  { field: 'exportedAt', requirement: 'required', purpose: '记录导出时间', note: '便于校验导出 SLA' },
];

const DB_SENSITIVE_ACTION_FIELDS: AuditFieldDefinition[] = [
  { field: 'dbActionId', requirement: 'required', purpose: '记录数据库敏感动作编号', note: '作为数据库层敏感动作摘要的稳定主键' },
  { field: 'databaseAccount', requirement: 'required', purpose: '记录执行动作的数据库账户', note: '必须区分应用账户、高权限账户、非应用账户' },
  { field: 'actorSource', requirement: 'required', purpose: '记录动作来源', note: '例如 application、maintenance_session、direct_db' },
  { field: 'actionKind', requirement: 'required', purpose: '记录动作类别', note: '覆盖 update/delete/DDL/login/bulk 等关键场景' },
  { field: 'targetType', requirement: 'required', purpose: '记录目标类型', note: '至少区分 table、schema、index、view 或 trigger' },
  { field: 'targetName', requirement: 'required', purpose: '记录目标名称', note: '至少明确到表名或 schema 名' },
  { field: 'statementDigest', requirement: 'required', purpose: '记录 SQL 语句摘要', note: '本轮不落全文，但必须有摘要' },
  { field: 'whereDigest', requirement: 'conditional', purpose: '记录过滤条件摘要', note: '说明影响范围', presenceRule: 'update/delete/bulk_modify 时提供' },
  { field: 'affectedRowEstimate', requirement: 'conditional', purpose: '记录影响行数估算', note: '用于识别批量修改与越权风险', presenceRule: 'update/delete/bulk_modify 时提供' },
  { field: 'approvalRef', requirement: 'conditional', purpose: '关联审批或维护窗口引用', note: '高风险动作必须能说明为什么允许执行', presenceRule: '高权限、批量、DDL 或关键状态修正时提供' },
  { field: 'sessionFingerprint', requirement: 'required', purpose: '记录数据库会话指纹', note: '用于跨日志链路追溯' },
  { field: 'detectedAt', requirement: 'required', purpose: '记录检测时间', note: '便于和应用层事件对齐' },
  { field: 'severity', requirement: 'required', purpose: '记录数据库动作风险分级', note: '必须进入 digest 链' },
];

const LEDGER_REPAIR_PROPOSAL_LINK_FIELDS: AuditFieldDefinition[] = [
  { field: 'proposalRef', requirement: 'required', purpose: '未来余额调整建议编号', note: '本轮只定义蓝图，不代表已落地对象' },
  { field: 'auditEventRef', requirement: 'required', purpose: '关联应用层高风险审计事件', note: '任何修复建议至少进入 high_risk' },
  { field: 'virtualLedgerScopeRef', requirement: 'required', purpose: '关联虚拟账本作用域', note: '只解释影响范围，不自动改余额' },
  { field: 'relatedApprovalRef', requirement: 'conditional', purpose: '关联审批链', note: '进入审查或复核阶段时提供', presenceRule: '进入审批或复核阶段时提供' },
  { field: 'relatedAnomalyTicketRef', requirement: 'conditional', purpose: '关联异常单', note: '从异常链派生时必须提供', presenceRule: '从 anomaly 派生时提供' },
  { field: 'reason', requirement: 'required', purpose: '记录修复建议原因', note: '不能只靠金额差自动生成修复结论' },
  { field: 'evidenceRefs', requirement: 'required', purpose: '记录证据引用', note: '至少指向 digest、异常单、对账差异或外部证据包' },
  { field: 'aiParticipation', requirement: 'required', purpose: '记录 AI 是否参与建议', note: 'AI 只能参与建议，不得替代人工审批' },
];

const MONTH_END_APPROVAL_AUDIT_LINK_FIELDS: AuditFieldDefinition[] = [
  { field: 'monthKey', requirement: 'required', purpose: '关联月份', note: '例如 2026-04' },
  { field: 'monthEndPacketRef', requirement: 'required', purpose: '关联月结候选包或冻结包', note: '月结判断必须先有包体，再有审计链' },
  { field: 'auditEventRef', requirement: 'required', purpose: '关联应用层高风险审计事件', note: '月结通过至少 high_risk' },
  { field: 'approvalRef', requirement: 'conditional', purpose: '关联审批引用', note: '月结通过或 freeze release 时必须可追溯到批准人', presenceRule: 'month_end_pass 或 freeze_release 时提供' },
  { field: 'reviewRef', requirement: 'conditional', purpose: '关联复核引用', note: '有复核动作时必须提供', presenceRule: '有复核动作时提供' },
  { field: 'freezeRefs', requirement: 'required', purpose: '关联冻结项或未决差异', note: '说明月结时有哪些留存项' },
  { field: 'evidenceRefs', requirement: 'required', purpose: '关联证据引用', note: '至少指向 digest、异常单、月度核对摘要或外部证据包' },
];

const ANOMALY_TICKET_AUDIT_LINK_FIELDS: AuditFieldDefinition[] = [
  { field: 'anomalyTicketRef', requirement: 'required', purpose: '异常单编号', note: '稳定回挂异常处理链' },
  { field: 'varianceCode', requirement: 'required', purpose: '差异类型', note: '说明为什么进入异常链' },
  { field: 'auditEventRef', requirement: 'required', purpose: '关联应用层审计事件', note: '关闭、重开、冻结、释放都必须留下应用层事件' },
  { field: 'approvalRef', requirement: 'conditional', purpose: '关联审批引用', note: '异常单关闭或放行时必须可追溯审批', presenceRule: 'close 或 allow_read_only 时提供' },
  { field: 'reviewRef', requirement: 'conditional', purpose: '关联复核引用', note: '高风险异常关闭必须保留复核链', presenceRule: '有复核动作时提供' },
  { field: 'linkedObjectRefs', requirement: 'required', purpose: '关联审批/付款/收款/账本/月结对象', note: '说明异常影响范围' },
  { field: 'closeReason', requirement: 'conditional', purpose: '记录关闭原因', note: '不能空着关闭', presenceRule: 'anomaly close 时提供' },
  { field: 'evidenceRefs', requirement: 'required', purpose: '记录证据引用', note: '至少指向差异摘要、外部证据或数据库动作摘要' },
];

export const DATABASE_AUDIT_AND_NONREPUDIATION_BLUEPRINT: DatabaseAuditAndNonRepudiationBlueprint = {
  blueprintCode: 'fund_truth.database_audit_and_nonrepudiation_blueprint',
  version: '2026-04-17.f7.9-database-audit-and-nonrepudiation-blueprint',
  mode: 'read_only_blueprint',
  stage: 'F7.9',
  scope:
    '定义数据库审计链与不可抵赖留痕的三层职责、风险分级、对象合同，以及与审批/付款/收款/银行证据/真相对照/虚拟账本/月度核对对象的只读接入边界。',
  continuityNotes: [
    'approval_request_command、payment_record_command、fund_truth_reconciliation、bank-truth-input-contract、bank-truth-staging-blueprint、厂家真实接口只读适配层、多公司账户归属蓝图、多公司虚拟账本蓝图、月度银行流水导入核对蓝图都已封版，本轮只补审计链与不可抵赖蓝图。',
    '本轮继续保持银行输入边界、账户归属边界、真相边界、虚拟账本边界、月度核对边界不变。',
    '本轮先解决谁改了什么、是否有审批、是否有证据链、管理员直改数据库如何被系统外发现的问题，不进入自动修余额或自动对账闭环。',
  ],
  upstreamBlueprints: [
    'fund_truth.bank_truth_input_contract@2026-04-16.f6-read-only-blueprint',
    'fund_truth.bank_truth_staging_blueprint@2026-04-16.f7-read-only-staging-blueprint',
    'fund_truth.multi_company_bank_account_scope_blueprint@2026-04-17.f7.6-multi-company-account-scope-blueprint',
    'fund_truth.multi_company_virtual_ledger_blueprint@2026-04-17.f7.7-multi-company-virtual-ledger-blueprint',
    'fund_truth.monthly_bank_statement_reconciliation_blueprint@2026-04-17.f7.8-monthly-bank-statement-reconciliation-blueprint',
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
    '不做 row-level 审计真实落地',
    '不做自动修余额',
    '不做自动对账闭环',
    '不扩第三颗资金写入对象',
    '管理员身份不会自动豁免审批、异常、月结与外部摘要封存要求',
    'AI 不会成为最终审批人、异常关闭人、数据库操作者或系统外导出签发人',
  ],
  nonGoals: [
    '本轮不落地 row-level 数据库审计',
    '本轮不做数据库触发器方案落地',
    '本轮不接真实外部日志服务',
    '本轮不接真实邮件、对象存储或 WORM',
    '本轮不新增资金主链写入对象',
    '本轮不修改 approval_requests / payment_records / payout_records / fund_truth / 虚拟账本 / 月度核对行为',
    '本轮不让审计链反向驱动自动改账或自动月结',
  ],
  layerDefinitions: [
    {
      layer: 'application_business_audit',
      purpose: '回答谁在什么业务上下文里做了什么判断、操作、建议、审批或关闭动作。',
      minimumArtifacts: ['auditEvent', 'reason', 'relatedApprovalRef', 'relatedExceptionTicketRef', 'relatedRepairTicketRef', 'aiParticipation', 'evidenceRefs'],
      mustLinkTo: ['dbSensitiveAction', 'auditDigest', 'externalEvidenceBundle'],
      systemMustNotDo: ['不得只记一句备注就宣称形成完整审计链', '不得缺失 actor、action、objectType/objectId、reason', '不得把 AI 写成最终审批人'],
      note: '应用层负责解释业务动作，但不能替代数据库层或系统外摘要封存。',
    },
    {
      layer: 'database_sensitive_audit',
      purpose: '回答谁用什么数据库身份、在什么时间、对哪些敏感对象做了 update/delete/DDL/批量操作。',
      minimumArtifacts: ['dbSensitiveAction', 'databaseAccount', 'statementDigest', 'sessionFingerprint', 'severity'],
      mustLinkTo: ['auditEvent', 'auditDigest', 'externalEvidenceBundle'],
      systemMustNotDo: ['不得把 direct_db 行为伪装成正常应用写入', '不得忽略高权限登录、非应用账户改表、批量修改', '不得声称本轮已经实现完整 row-level before/after 追溯'],
      note: '数据库层回答“底层改了什么”，但本轮只定义覆盖与摘要，不落地行级审计。',
    },
    {
      layer: 'external_nonrepudiation_evidence',
      purpose: '把应用层和数据库层摘要导出到独立目标，形成可外审复核的 digest 链。',
      minimumArtifacts: ['auditDigest', 'externalEvidenceBundle', 'digest chain', 'independentStorageTarget'],
      mustLinkTo: ['auditEvent', 'dbSensitiveAction'],
      systemMustNotDo: ['不得把主应用数据库当成唯一保存位置', '不得导出失败却继续宣称高风险事件已封存', '不得允许摘要链断裂后静默继续'],
      note: '系统外层负责不可抵赖，但本轮只定义蓝图，不接真实外部服务。',
    },
  ],
  objectContracts: {
    auditEvent: {
      objectCode: 'auditEvent',
      purpose: '定义应用层业务留痕事件。',
      linkedLayers: ['application_business_audit', 'database_sensitive_audit', 'external_nonrepudiation_evidence'],
      minimumFields: AUDIT_EVENT_FIELDS,
      note: '任何高风险动作都必须先能落成 auditEvent，再进入 digest 与外部封存。',
    },
    auditDigest: {
      objectCode: 'auditDigest',
      purpose: '定义一段时间窗内的审计摘要。',
      linkedLayers: ['external_nonrepudiation_evidence'],
      minimumFields: AUDIT_DIGEST_FIELDS,
      note: 'digest 负责把应用层与数据库层连成可导出的摘要链。',
    },
    externalEvidenceBundle: {
      objectCode: 'externalEvidenceBundle',
      purpose: '定义导出到系统外的摘要包。',
      linkedLayers: ['external_nonrepudiation_evidence'],
      minimumFields: EXTERNAL_EVIDENCE_BUNDLE_FIELDS,
      note: 'bundle 负责把 digest 导出到独立目标，并保留 tamper-evident 要求。',
    },
    dbSensitiveAction: {
      objectCode: 'dbSensitiveAction',
      purpose: '定义数据库层敏感动作摘要。',
      linkedLayers: ['database_sensitive_audit', 'external_nonrepudiation_evidence'],
      minimumFields: DB_SENSITIVE_ACTION_FIELDS,
      note: '本轮不落地 row-level，但必须先把数据库敏感动作对象结构固定下来。',
    },
    ledgerRepairProposalLink: {
      objectCode: 'ledgerRepairProposalLink',
      purpose: '定义未来余额相关调整建议与审计链的挂接对象。',
      linkedLayers: ['application_business_audit', 'external_nonrepudiation_evidence'],
      minimumFields: LEDGER_REPAIR_PROPOSAL_LINK_FIELDS,
      note: 'proposal link 只说明建议，不自动等于修复已执行。',
    },
    monthEndApprovalAuditLink: {
      objectCode: 'monthEndApprovalAuditLink',
      purpose: '定义月结候选、审批、复核与审计链的挂接对象。',
      linkedLayers: ['application_business_audit', 'external_nonrepudiation_evidence'],
      minimumFields: MONTH_END_APPROVAL_AUDIT_LINK_FIELDS,
      note: 'month-end link 只说明高风险月结判断已被审计覆盖，不自动结转。',
    },
    anomalyTicketAuditLink: {
      objectCode: 'anomalyTicketAuditLink',
      purpose: '定义异常单处理链与审计链的挂接对象。',
      linkedLayers: ['application_business_audit', 'external_nonrepudiation_evidence'],
      minimumFields: ANOMALY_TICKET_AUDIT_LINK_FIELDS,
      note: '异常单关闭或重开都必须回到审计链。',
    },
  },
  databaseCoverage: [
    {
      actionKind: 'sensitive_table_update',
      coveredTargets: ['approval_requests', 'payment_records', 'payout_records', 'future ledger_repair_proposal', 'future anomaly_ticket', 'future month_end packet', 'future multi_company_virtual_ledger table', 'future monthly_statement_reconciliation table'],
      detectionSignals: ['databaseAccount', 'statementDigest', 'whereDigest', 'affectedRowEstimate', 'sessionFingerprint'],
      severityFloor: 'warning',
      requiredLinks: ['approvalRef(when critical state touched)', 'auditEvent', 'auditDigest'],
      systemMustNotDo: ['不得忽略关键状态修正', '不得把 direct_db update 漏到普通日志外'],
      note: '触达审批/付款/收款关键状态修正时，update 至少升为 high_risk。',
    },
    {
      actionKind: 'sensitive_table_delete',
      coveredTargets: ['approval_requests', 'payment_records', 'payout_records', 'future anomaly_ticket', 'future month_end packet', 'future multi_company_virtual_ledger table'],
      detectionSignals: ['databaseAccount', 'statementDigest', 'whereDigest', 'affectedRowEstimate', 'sessionFingerprint'],
      severityFloor: 'high_risk',
      requiredLinks: ['approvalRef', 'auditDigest', 'externalEvidenceBundle'],
      systemMustNotDo: ['不得没有维护窗口就删除敏感表数据', '不得 delete 后不形成外部摘要'],
      note: '敏感表 delete 无审批或无维护窗口时应升级 critical。',
    },
    {
      actionKind: 'ddl',
      coveredTargets: ['schema', 'table', 'index', 'trigger', 'view'],
      detectionSignals: ['databaseAccount', 'statementDigest', 'sessionFingerprint', 'detectedAt'],
      severityFloor: 'critical',
      requiredLinks: ['approvalRef', 'auditDigest', 'externalEvidenceBundle'],
      systemMustNotDo: ['不得把 DDL 当成普通运维事件', '不得无外部封存'],
      note: 'DDL 直接 critical。',
    },
    {
      actionKind: 'privileged_login',
      coveredTargets: ['admin account', 'dba account', 'maintenance account'],
      detectionSignals: ['databaseAccount', 'actorSource', 'sessionFingerprint', 'detectedAt'],
      severityFloor: 'high_risk',
      requiredLinks: ['auditDigest'],
      systemMustNotDo: ['不得因为登录未改表就完全不记录', '不得忽略越权来源'],
      note: '高权限登录是后续 direct_db 风险的前置信号。',
    },
    {
      actionKind: 'non_app_account_table_change',
      coveredTargets: ['approval_requests', 'payment_records', 'payout_records', 'future month_end packet', 'future anomaly_ticket', 'future multi_company_virtual_ledger table'],
      detectionSignals: ['databaseAccount', 'actorSource', 'statementDigest', 'sessionFingerprint', 'affectedRowEstimate'],
      severityFloor: 'high_risk',
      requiredLinks: ['approvalRef', 'auditDigest', 'externalEvidenceBundle'],
      systemMustNotDo: ['不得把非应用账户改表写成普通应用操作', '不得绕过维护窗口说明'],
      note: '非应用账户改表若触达关键对象或无审批，必须升 critical。',
    },
    {
      actionKind: 'bulk_modify',
      coveredTargets: ['approval_requests', 'payment_records', 'payout_records', 'future anomaly_ticket', 'future month_end packet', 'future multi_company_virtual_ledger table', 'future monthly_statement_reconciliation table'],
      detectionSignals: ['statementDigest', 'whereDigest', 'affectedRowEstimate', 'sessionFingerprint'],
      severityFloor: 'high_risk',
      requiredLinks: ['approvalRef', 'auditEvent', 'auditDigest', 'externalEvidenceBundle'],
      systemMustNotDo: ['不得批量修改后没有影响范围摘要', '不得无审批直接批量改关键对象'],
      note: '批量修改是高风险默认场景。',
    },
  ],
  externalNonRepudiationPolicies: [
    {
      ruleKey: 'daily_digest_export',
      appliesToSeverities: ['normal', 'warning'],
      auditSummaryDefinition: '按自然日汇总 auditEvent 与 dbSensitiveAction 的编号、对象引用、分级、证据引用、导出状态。',
      digestRequirements: ['记录 digestAlgorithm', '记录 digestValue', '记录 previousDigestValue', '记录 includedAuditEventRefs', '记录 includedDbSensitiveActionRefs'],
      exportCycle: 'normal / warning 至少按日导出，最迟不晚于 T+1 工作时段首个小时完成。',
      independentStorageTargets: ['independent_audit_storage', 'independent_object_storage', 'independent_audit_database'],
      nonRepudiationRequirements: ['主应用数据库不是唯一保存位置', '导出包要保留序号和链式 previousDigestValue', '导出失败也要被记录'],
      exportFailureSeverity: 'high_risk',
      note: '日常导出保证基础审计链不丢失。',
    },
    {
      ruleKey: 'same_day_high_risk_export',
      appliesToSeverities: ['high_risk', 'critical'],
      auditSummaryDefinition: '对 high_risk / critical 事件做同日摘要与专项导出包。',
      digestRequirements: ['同日形成 digest', '同日进入 externalEvidenceBundle', '记录关联 approval/exception/repair/month_end 引用'],
      exportCycle: 'high_risk / critical 至少同日导出；critical 需要额外进入阶段性封存包。',
      independentStorageTargets: ['independent_object_storage', 'offline_archive', 'independent_audit_storage'],
      nonRepudiationRequirements: ['高风险事件不能只留在主库', '导出包必须能独立复核事件编号和摘要链', 'critical 事件若导出失败则升级为持续 critical 缺口'],
      exportFailureSeverity: 'critical',
      note: '高风险与关键事件不能等到下一个自然日再封存。',
    },
    {
      ruleKey: 'digest_chain_integrity',
      appliesToSeverities: ['normal', 'warning', 'high_risk', 'critical'],
      auditSummaryDefinition: '对所有导出包维护 previousDigestValue -> digestValue 的链式关系。',
      digestRequirements: ['bundleSequence 单调递增', 'digestAlgorithm 固定写入包内', 'bundleDigest 覆盖整个外部导出包'],
      exportCycle: '每个导出包都要接入链式完整性校验。',
      independentStorageTargets: ['independent_audit_storage', 'independent_object_storage', 'offline_archive'],
      nonRepudiationRequirements: ['摘要链断裂必须可见', '链参数变更必须形成高风险审计事件', '不可静默覆盖已有 bundleSequence'],
      exportFailureSeverity: 'critical',
      note: 'digest chain 是本轮定义“不可抵赖”的最小骨架。',
    },
  ],
  severityDefinitions: [
    { severity: 'normal', description: '常规只读查看与低风险元数据动作。', typicalTriggers: ['查看详情', '只读对照', '查看导出结果'], minimumResponse: ['记录 auditEvent', '纳入日常 digest'], externalizationSla: '按日导出即可。' },
    { severity: 'warning', description: '已触达敏感对象或敏感流程，但尚未进入关键状态修正或高权限越权风险。', typicalTriggers: ['补 reason', '补 evidenceRefs', '对敏感对象做只读高敏查看', '普通 update 但未触达关键状态'], minimumResponse: ['记录 auditEvent', '必要时补 dbSensitiveAction', '纳入日常 digest'], externalizationSla: '按日导出，导出失败至少升级为 high_risk。' },
    { severity: 'high_risk', description: '已触达资金关键状态、异常关闭、月结通过、余额相关调整建议、批量修改或高权限数据库行为。', typicalTriggers: ['余额相关调整建议', '异常单关闭', '月结通过', '高权限登录并改表', '审批/付款/收款链关键状态修正', '批量修改'], minimumResponse: ['记录完整 auditEvent', '记录 dbSensitiveAction(如有)', '同日形成 auditDigest', '同日导出 externalEvidenceBundle'], externalizationSla: '至少同日导出。' },
    { severity: 'critical', description: '已触达 DDL、敏感表 delete、绕过审批、篡改留痕、外部摘要链断裂或高权限越权改账。', typicalTriggers: ['DDL', '敏感表 delete 无审批', '外部摘要导出失败且存在高风险事件', '管理员绕过应用直改关键对象', '禁用或篡改摘要链'], minimumResponse: ['立即记录 auditEvent / dbSensitiveAction', '立即生成专项 digest', '立即外部封存', '阻断“已形成完整证据链”的错误宣称'], externalizationSla: '同日且优先级最高，失败即保持 critical 缺口。' },
  ],
  highRiskTriggers: [
    { action: 'ledger_balance_adjustment_proposal', minimumSeverity: 'high_risk', requiredLinks: ['ledgerRepairProposalLink', 'relatedApprovalRef', 'evidenceRefs', 'aiParticipation'], note: '余额相关调整建议即使只是 proposal，也必须 high_risk。' },
    { action: 'anomaly_ticket_close', minimumSeverity: 'high_risk', requiredLinks: ['anomalyTicketAuditLink', 'approvalRef', 'closeReason', 'evidenceRefs'], note: '异常单关闭必须可追到谁关、为什么关、依据是什么。' },
    { action: 'month_end_pass', minimumSeverity: 'high_risk', requiredLinks: ['monthEndApprovalAuditLink', 'approvalRef', 'freezeRefs', 'evidenceRefs'], note: '月结通过至少 high_risk。' },
    { action: 'privileged_db_change', minimumSeverity: 'high_risk', requiredLinks: ['dbSensitiveAction', 'auditDigest', 'externalEvidenceBundle'], note: '高权限数据库改动至少 high_risk；DDL 或越权可升 critical。' },
    { action: 'approval_payment_payout_key_state_correction', minimumSeverity: 'high_risk', requiredLinks: ['auditEvent', 'relatedApprovalRef', 'evidenceRefs', 'auditDigest'], note: '审批/付款/收款链关键状态修正至少 high_risk。' },
  ],
  relationPolicies: [
    {
      relationKey: 'anomaly_ticket',
      purpose: '把差异、异常单、处理方向、关闭动作挂到审计链上。',
      requiredObjects: ['anomalyTicketAuditLink', 'auditEvent', 'auditDigest'],
      requiredEvidence: ['varianceCode', 'closeReason(when closed)', 'linkedObjectRefs', 'evidenceRefs'],
      forbiddenConclusions: ['不得把异常单关闭等同于自动改余额', '不得跳过 approval / review 直接宣称问题已消失'],
      note: '异常单处理链只解释过程，不自动修账。',
    },
    {
      relationKey: 'ledger_repair_proposal',
      purpose: '把未来余额修复建议与审批、异常、虚拟账本范围、AI 建议挂到审计链上。',
      requiredObjects: ['ledgerRepairProposalLink', 'auditEvent', 'auditDigest'],
      requiredEvidence: ['virtualLedgerScopeRef', 'reason', 'evidenceRefs', 'aiParticipation'],
      forbiddenConclusions: ['不得把 proposal 等同于修复已执行', '不得在无审批时宣称建议可直接落地'],
      note: 'proposal 只是一条高风险建议，不是执行结果。',
    },
    {
      relationKey: 'month_end_approval',
      purpose: '把月结候选、冻结项、审批、复核与审计链串起来。',
      requiredObjects: ['monthEndApprovalAuditLink', 'auditEvent', 'auditDigest'],
      requiredEvidence: ['monthEndPacketRef', 'approvalRef', 'freezeRefs', 'evidenceRefs'],
      forbiddenConclusions: ['不得把月结通过等同于自动生成 opening carry forward', '不得绕过人工月结'],
      note: '月结通过是高风险判断，不是自动结转权限。',
    },
    {
      relationKey: 'virtual_ledger',
      purpose: '规定虚拟账本只是被审计覆盖的对象，不是被审计链反向驱动的自动改账入口。',
      requiredObjects: ['auditEvent', 'ledgerRepairProposalLink or monthEndApprovalAuditLink'],
      requiredEvidence: ['virtualLedgerScopeRef', 'evidenceRefs'],
      forbiddenConclusions: ['不得把 auditEvent 解释成余额已经改变', '不得因为存在审计链就跳过账本人工边界'],
      note: '审计覆盖账本动作，不反向改变账本规则。',
    },
  ],
  roleBoundaries: [
    { role: 'admin', allowedActions: ['查看审计链', '查看数据库敏感动作摘要', '维护系统配置', '触发受控导出流程'], forbiddenActions: ['不得因为管理员身份跳过审批、异常、月结高风险留痕', '不得删除或重写外部摘要链', '不得把 direct_db 改表解释成普通应用行为'], note: '管理员不是审计豁免角色。' },
    { role: 'finance', allowedActions: ['补业务原因', '补 evidenceRefs', '参与只读对照', '发起异常说明'], forbiddenActions: ['不得单独关闭高风险异常', '不得直接改数据库关键状态', '不得越权批准月结通过或余额修复'], note: 'finance 负责业务原因，不负责最终高风险批准。' },
    { role: 'finance_data_review', allowedActions: ['补业务原因', '补证据说明', '参与异常初核', '参与月结候选初核'], forbiddenActions: ['不得单独放行关键状态修正', '不得把弱规则写成正式结论', '不得越权关闭高风险异常'], note: 'finance_data_review 负责初核，不替代审计批准。' },
    { role: 'finance_audit', allowedActions: ['审批异常处理方向', '审批月结候选', '复核高风险建议', '审阅高权限数据库动作摘要'], forbiddenActions: ['不得把审批动作等同于自动改账', '不得跳过外部摘要封存', '不得把 AI 建议当成审批结论'], note: 'finance_audit 负责高风险审批，但不直接改余额。' },
    { role: 'data_governance', allowedActions: ['处理映射冲突', '处理账户归属与契约问题', '补治理原因码'], forbiddenActions: ['不得把弱规则写成资金正式结论', '不得代替财务审计批准高风险关闭', '不得绕开审批链修正业务关键状态'], note: 'data_governance 负责治理解释，不负责财务批准。' },
    { role: 'ai', allowedActions: ['生成建议摘要', '生成差异解释草稿', '生成 evidence 提示'], forbiddenActions: ['不得成为最终审批人', '不得成为异常关闭人', '不得成为数据库操作者', '不得成为系统外导出签发人'], note: 'AI 只停留在建议层。' },
    { role: 'system', allowedActions: ['生成 digest', '生成 bundle 元数据', '汇总审计摘要', '发出导出失败告警'], forbiddenActions: ['不得伪造人工 reason', '不得绕过审批链关闭异常', '不得把导出失败静默吞掉'], note: 'system 负责自动汇总，不负责替人做决定。' },
    { role: 'service_account', allowedActions: ['执行受控应用写入', '触发受控汇总任务'], forbiddenActions: ['不得被伪装成 human actor', '不得绕过应用层审计直接写关键对象'], note: 'service_account 需要和 direct_db 行为明确区分。' },
  ],
  integrationBoundaries: [
    { target: 'approval_requests', currentRole: '审批控制链对象，未来只是审计链接入对象之一', auditCoverage: ['审批创建与流转留痕', '审批关键状态修正留痕', '与 anomaly / repair / month_end 的引用挂接', '数据库敏感 update/delete 覆盖'], forbiddenBehaviorChanges: ['不改审批状态机', '不增加自动改账入口', '不把审批通过写成真实资金真相'], note: 'approval_requests 本轮只被覆盖，不被改行为。' },
    { target: 'payment_records', currentRole: '到账语义对象，未来只是审计链接入对象之一', auditCoverage: ['到账关键状态修正留痕', '与 anomaly / month_end / repair 的引用挂接', '数据库敏感 update/delete 覆盖'], forbiddenBehaviorChanges: ['不改到账逻辑', '不把 payment_records 升级成银行真相源', '不自动推进工资'], note: 'payment_records 继续保持现有到账语义边界。' },
    { target: 'payout_records', currentRole: '付款登记对象，未来只是审计链接入对象之一', auditCoverage: ['出款关键状态修正留痕', '与 approval / anomaly / repair 的引用挂接', '数据库敏感 update/delete 覆盖'], forbiddenBehaviorChanges: ['不扩写入命令壳', '不把 payout_records 升级成资金主账', '不自动对账闭环'], note: 'payout_records 继续保持登记语义边界。' },
    { target: 'bank_sms', currentRole: '银行证据输入边界，未来只是审计证据接入对象之一', auditCoverage: ['证据摘要', '导出定位信息', '与 auditDigest / externalEvidenceBundle 的挂接'], forbiddenBehaviorChanges: ['不把 bank-sms 升级成主账', '不让其直接驱动 payment/payout/approval 写入', '不接 AI focus'], note: 'bank_sms 负责证据输入，不负责改账。' },
    { target: 'fund_truth', currentRole: '只读对照与映射准备层，未来只是审计接入对象之一', auditCoverage: ['对照结论摘要', '差异引用', '与 anomaly / month_end / digest 的挂接'], forbiddenBehaviorChanges: ['不做自动对账闭环', '不让 fund_truth 反向控制主链写入', '不升级成资金主账'], note: 'fund_truth 继续是 compare 层。' },
    { target: 'multi_company_virtual_ledger', currentRole: '多公司虚拟账本蓝图对象，未来只是被审计覆盖的账本对象', auditCoverage: ['余额相关调整建议挂接', '异常与月结审计挂接', '未来数据库敏感动作覆盖'], forbiddenBehaviorChanges: ['不改余额形成规则', '不自动修余额', '不因为存在审计链就放开人工边界'], note: '审计链覆盖账本动作，不改账本规则。' },
    { target: 'monthly_statement_reconciliation', currentRole: '月度核对蓝图对象，未来只是被审计覆盖的核对对象', auditCoverage: ['导入摘要', '差异与异常单挂接', '月结候选与冻结包挂接', '未来数据库敏感动作覆盖'], forbiddenBehaviorChanges: ['不改月度核对行为', '不自动月结', '不自动生成 opening carry forward'], note: '月度核对继续只做只读 compare / anomaly / candidate。' },
  ],
  nextGaps: [
    '本轮没有真实 row-level 审计，因此管理员直改具体哪一行、前后值是什么，仍无法被系统完整证明。',
    '本轮没有真实独立对象存储 / WORM / 外部日志服务，因此系统外不可抵赖仍停留在蓝图层。',
    '高权限登录、非应用账户改表、批量修改的真实采集链路仍需后续落地。',
    '余额相关调整建议、异常单关闭、月结通过的审批门槛与导出 SLA 还需要单独 SOP。',
    'approval/payment/payout 的关键状态修正还没有统一的高风险审计总览视图。',
    'AI 建议被部分采纳、人工二次修改后的细粒度归责仍需后续收口。',
  ],
  reviewChecklist: [
    '确认三层审计链继续是 application + database + external 三层，不互相替代。',
    '确认 auditEvent 至少包含 actor / action / objectType / objectId / before / after / reason / related links / aiParticipation。',
    '确认数据库层继续覆盖 sensitive update/delete、DDL、高权限登录、非应用账户改表、批量修改。',
    '确认系统外留痕继续固定 digest、hash chain、导出周期、独立存储目标和 tamper-evident 要求。',
    '确认 normal / warning / high_risk / critical 四级完整存在。',
    '确认余额相关调整建议、异常单关闭、月结通过、高权限数据库改动、审批付款收款关键状态修正全部至少 high_risk。',
    '确认 admin / finance / finance_audit / data_governance / AI 没有串岗。',
    '确认 approval_requests / payment_records / payout_records / bank_sms / fund_truth / multi_company_virtual_ledger / monthly_statement_reconciliation 继续只是接入对象。',
    '确认本轮仍未越过 row-level、触发器、真实外部留痕服务、schema 变更和写入逻辑禁区。',
    '确认 currentUser 透传边界不回退，AI 仍不接入最终责任位。',
  ],
};
