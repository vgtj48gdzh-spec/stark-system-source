export function formatPayrollSummaryDomain(value?: string | null) {
  switch (value) {
    case 'abc_overall':
      return 'ABC整体';
    case 'public_vehicle':
      return '公车';
    case 'private_vehicle':
      return '私家车';
    case 'insurance_claim':
      return '保险理赔';
    default:
      return value || '-';
  }
}

export function formatPayrollDetailType(value?: string | null) {
  switch (value) {
    case 'performance_summary':
      return '绩效汇总';
    case 'reward_event':
      return '奖励事件';
    case 'business_stat_summary':
      return '经营统计汇总';
    default:
      return value || '-';
  }
}

export function formatPayrollRunStatus(value?: string | null) {
  switch (value) {
    case 'running':
      return '运行中';
    case 'completed':
      return '已完成';
    case 'failed':
      return '失败';
    default:
      return value || '-';
  }
}

export function formatPayrollInclusionResult(
  includedFlag?: boolean | null,
  pendingFlag?: boolean | null,
  ignoredFlag?: boolean | null,
) {
  if (ignoredFlag) {
    return '已忽略';
  }
  if (includedFlag) {
    return '已纳入';
  }
  if (pendingFlag) {
    return '待确认';
  }
  return '仅展示';
}

export function formatPayrollRuleStrength(value?: string | null) {
  switch (value) {
    case 'strong':
      return '强规则';
    case 'weak':
      return '弱规则';
    default:
      return value || '-';
  }
}

export function formatPayrollEvidenceStatus(value?: string | null) {
  switch (value) {
    case 'confirmed':
      return '已确认';
    case 'inferred':
      return '推断';
    case 'uncertain':
      return '待确认';
    default:
      return value || '-';
  }
}
