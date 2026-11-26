export function formatPlatform(value?: string | null) {
  switch (value) {
    case 'douyin':
      return '抖音';
    case 'wechat':
      return '微信';
    case 'xiaohongshu':
      return '小红书';
    case 'custom':
      return '自定义';
    default:
      return value || '-';
  }
}

export function formatContentType(value?: string | null) {
  switch (value) {
    case 'video':
      return '视频';
    case 'post':
      return '图文';
    case 'live':
      return '直播';
    case 'message':
      return '消息';
    default:
      return value || '-';
  }
}

export function formatContentPlanningCategory(value?: string | null) {
  switch (value) {
    case 'a_wash_card_promo':
      return 'A端洗车卡宣传';
    case 'a_maintenance_promo':
      return 'A端维修/保养宣传';
    case 'c_benefit_bundle':
      return 'C端权益/礼包宣传';
    case 'points_card_explainer':
      return '积分/购物卡说明';
    case 'employee_benefit_notice':
      return '员工福利说明';
    case 'campaign_notice':
      return '活动通知';
    case 'case_showcase':
      return '案例展示';
    case 'faq_answer':
      return 'FAQ答疑';
    default:
      return value || '-';
  }
}

export function formatTargetCustomerType(value?: string | null) {
  switch (value) {
    case 'new_customer':
      return '新客户';
    case 'returning_customer':
      return '复购客户';
    case 'employee':
      return '员工';
    case 'merchant_staff':
      return '商户员工';
    case 'faq_visitor':
      return '咨询访客';
    default:
      return value || '-';
  }
}

export function formatBusinessDomain(value?: string | null) {
  switch (value) {
    case 'abc_overall':
      return 'ABC综合';
    case 'employee_benefit':
      return '员工福利';
    case 'knowledge_support':
      return '知识支持';
    case 'a_wash_card_sale':
      return 'A端洗车卡';
    case 'after_sales':
      return '售后服务';
    default:
      return value || '-';
  }
}

export function formatExpectedConversionGoal(value?: string | null) {
  switch (value) {
    case 'consultation':
      return '引导咨询';
    case 'purchase':
      return '促进购买';
    case 'benefit_claim':
      return '确认福利到账';
    case 'reply':
      return '引导回复';
    case 'attendance':
      return '引导到店';
    default:
      return value || '-';
  }
}

export function formatInteractionType(value?: string | null) {
  switch (value) {
    case 'view':
      return '浏览';
    case 'like':
      return '点赞';
    case 'comment':
      return '评论';
    case 'share':
      return '分享';
    case 'message':
      return '私信';
    case 'follow':
      return '关注';
    case 'click':
      return '点击';
    default:
      return value || '-';
  }
}

export function formatSubjectType(value?: string | null) {
  switch (value) {
    case 'customer':
      return '客户';
    case 'employee':
      return '员工';
    default:
      return value || '-';
  }
}

export function formatEvidenceStatus(value?: string | null) {
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

export function formatAttributionStatus(value?: string | null) {
  switch (value) {
    case 'confirmed':
      return '已确认';
    case 'inferred':
      return '推断';
    case 'unknown':
      return '未知';
    default:
      return value || '-';
  }
}

export function formatRecommendationStatus(value?: string | null) {
  switch (value) {
    case 'draft':
      return '草稿';
    case 'active':
      return '生效中';
    case 'archived':
      return '已归档';
    default:
      return value || '-';
  }
}

export function formatLeadCandidateType(value?: string | null) {
  switch (value) {
    case 'customer':
      return '客户候选';
    case 'employee':
      return '员工候选';
    case 'merchant':
      return '商户候选';
    case 'business':
      return '业务候选';
    case 'unknown':
      return '待确认';
    default:
      return value || '-';
  }
}

export function formatLeadCandidateStatus(value?: string | null) {
  switch (value) {
    case 'pending':
      return '待处理';
    case 'processed':
      return '已处理';
    case 'reviewed':
      return '已复核';
    default:
      return value || '-';
  }
}

export function formatProfileStatus(value?: string | null) {
  switch (value) {
    case 'active':
      return '启用';
    case 'inactive':
      return '停用';
    default:
      return value || '-';
  }
}

export function formatFollowupRecommendationType(value?: string | null) {
  switch (value) {
    case 'followup_suggestion':
      return '跟进建议';
    default:
      return value || '-';
  }
}

export function formatBoolean(value?: boolean | null) {
  if (value === true) {
    return '是';
  }
  if (value === false) {
    return '否';
  }
  return '-';
}

export function formatConfidenceScore(value?: number | string | null) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numberValue)) {
    return String(value);
  }
  return `${(numberValue * 100).toFixed(0)}%`;
}

export function formatImportType(value?: string | null) {
  switch (value) {
    case 'content':
      return '平台内容';
    case 'interaction':
      return '平台互动';
    case 'lead':
      return '平台线索';
    default:
      return value || '-';
  }
}

export function formatImportSourceFormat(value?: string | null) {
  switch (value) {
    case 'csv':
      return 'CSV';
    case 'json':
      return 'JSON';
    case 'xlsx':
      return 'Excel';
    default:
      return value || '-';
  }
}

export function formatImportStatus(value?: string | null) {
  switch (value) {
    case 'processing':
      return '处理中';
    case 'completed':
      return '已完成';
    case 'partial':
      return '部分失败';
    case 'failed':
      return '失败';
    case 'success':
      return '成功';
    default:
      return value || '-';
  }
}

export function formatPlatformLeadStatus(value?: string | null) {
  switch (value) {
    case 'confirmed':
      return '已确认';
    case 'inferred':
      return '推断';
    case 'unknown':
      return '待确认';
    default:
      return value || '-';
  }
}

export function formatConnectorType(value?: string | null) {
  switch (value) {
    case 'file_import':
      return '文件导入';
    case 'api_adapter':
      return '平台适配器';
    default:
      return value || '-';
  }
}

export function formatConnectorStatus(value?: string | null) {
  switch (value) {
    case 'active':
      return '启用';
    case 'inactive':
      return '停用';
    case 'draft':
      return '草稿';
    default:
      return value || '-';
  }
}

export function formatRecommendationType(value?: string | null) {
  switch (value) {
    case 'content_recommendation':
      return '内容推荐';
    case 'followup_recommendation':
      return '跟进推荐';
    case 'script_recommendation':
      return '话术推荐';
    case 'benefit_reminder_recommendation':
      return '福利提醒推荐';
    case 'customer_interest_recommendation':
      return '客户兴趣推荐';
    case 'followup_suggestion':
      return '跟进建议';
    default:
      return value || '-';
  }
}

export function formatRuleStrength(value?: string | null) {
  switch (value) {
    case 'strong':
      return '强规则';
    case 'weak':
      return '弱规则';
    default:
      return value || '-';
  }
}

export function formatScriptTemplateGroup(value?: string | null) {
  switch (value) {
    case 'price':
      return '价格型';
    case 'experience':
      return '体验型';
    case 'benefit':
      return '福利型';
    case 'saving':
      return '省钱型';
    case 'service':
      return '服务型';
    default:
      return value || '-';
  }
}

export function formatScriptExperimentStatus(value?: string | null) {
  switch (value) {
    case 'draft':
      return '草稿';
    case 'running':
      return '进行中';
    case 'completed':
      return '已完成';
    case 'paused':
      return '已暂停';
    default:
      return value || '-';
  }
}

export function formatScriptExperimentType(value?: string | null) {
  switch (value) {
    case 'manual_followup':
      return '手工跟进实验';
    case 'benefit_notice':
      return '福利提醒实验';
    case 'content_followup':
      return '内容跟进实验';
    default:
      return value || '-';
  }
}

export function formatFeedbackStatus(value?: string | null) {
  switch (value) {
    case 'recorded':
      return '已记录';
    case 'ignored':
      return '已忽略';
    case 'reviewed':
      return '已复核';
    default:
      return value || '-';
  }
}

export function formatExecutionScenario(value?: string | null) {
  switch (value) {
    case 'a_wash_card_promo':
      return 'A端洗车卡宣传';
    case 'employee_benefit_notice':
      return '员工福利说明';
    default:
      return value || '-';
  }
}

export function formatExecutionTaskStatus(value?: string | null) {
  switch (value) {
    case 'draft':
      return '草稿';
    case 'confirmed':
      return '已确认';
    case 'running':
      return '执行中';
    case 'completed':
      return '已完成';
    case 'closed':
      return '已关闭';
    default:
      return value || '-';
  }
}

export function formatExecutionTaskItemStatus(value?: string | null) {
  switch (value) {
    case 'pending_confirmation':
      return '待确认';
    case 'confirmed':
      return '已确认';
    case 'executed':
      return '已执行';
    case 'skipped':
      return '已跳过';
    default:
      return value || '-';
  }
}

export function formatExecutionResultStatus(value?: string | null) {
  switch (value) {
    case 'recorded':
      return '已记录';
    case 'reviewed':
      return '已复核';
    case 'ignored':
      return '已忽略';
    default:
      return value || '-';
  }
}
