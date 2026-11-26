export function formatBusinessStatTag(value?: string | null) {
  switch (value) {
    case 'abc_overall':
      return 'ABC整体';
    case 'a_wash_card_sale':
      return 'A端洗车卡销售';
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

export function formatSummaryAnomalyClassification(value?: string | null) {
  switch (value) {
    case 'suspected_test_data':
      return '疑似测试数据';
    case 'special_business_case':
      return '特殊业务';
    case 'needs_review':
      return '待复核';
    default:
      return value || '-';
  }
}

export function formatSummaryBusinessCategory(value?: string | null) {
  switch (value) {
    case 'a_sales':
      return 'A端销售';
    case 'a_plus_c_linked_sale':
      return 'A+C联动销售';
    case 'b_shopping_card':
      return 'B端购物卡';
    case 'employee_welfare_card':
      return '员工福利购物卡';
    case 'c_points_redemption':
      return 'C端积分兑换';
    case 'special_business_case':
      return '特殊业务';
    case 'needs_review':
      return '待复核';
    default:
      return value || '-';
  }
}

export function formatPaymentStatus(value?: string | null) {
  switch (value) {
    case 'paid_cash':
      return '已支付-现金';
    case 'paid_points':
      return '已支付-积分';
    case 'unpaid':
      return '未支付';
    case 'test_data':
      return '测试数据';
    case 'internal_admin':
      return '内部/管理员';
    case 'unknown':
      return '支付状态待核';
    default:
      return value || '-';
  }
}

export function formatSourceClassification(value?: string | null) {
  switch (value) {
    case 'a_card_sale':
      return 'A端办卡销售';
    case 'points_redemption':
      return '积分兑换';
    case 'manual_activity':
      return '手工/活动';
    case 'test_data':
      return '测试数据';
    case 'internal_admin':
      return '内部/管理员';
    case 'other':
      return '其他';
    default:
      return value || '-';
  }
}

export function formatReconciliationStatus(value?: string | null) {
  switch (value) {
    case 'matched_sheet':
      return '台账已匹配';
    case 'sheet_missing':
      return '台账缺失';
    case 'bank_verified':
      return '收款已验证';
    case 'manual_verified':
      return '人工/积分证据';
    case 'needs_review':
      return '待复核';
    default:
      return value || '-';
  }
}

export function formatBCardSourceType(value?: string | null) {
  switch (value) {
    case 'issued_by_ac_bundle':
      return 'A+C联动发放';
    case 'issued_by_points_redemption':
      return '积分兑换发放';
    case 'issued_by_employee_welfare':
      return '员工福利发放';
    case 'issued_by_manual_activity':
      return '手工/活动发放';
    case 'issued_by_test':
      return '测试/内部发放';
    case 'issued_by_other':
      return '其他发放';
    case 'from_c_profit':
      return 'C端权益/积分来源';
    case 'from_a_subsidy':
      return 'A端补贴联动';
    case 'employee_welfare':
      return '员工福利';
    case 'other_activity':
      return '其他活动';
    default:
      return value || '未识别B端卡来源';
  }
}

export function formatWelfareSourceType(value?: string | null) {
  switch (value) {
    case 'formal_employee_benefit':
      return '正式福利主链';
    case 'legacy_welfare_candidate':
      return '历史福利候选';
    default:
      return value || '-';
  }
}

export function formatPayrollDecision(value?: string | null) {
  switch (value) {
    case 'included_whitelist':
      return '可入工资试算';
    case 'pending_confirmation':
      return '待人工确认';
    case 'reference_only':
      return '仅参考展示';
    default:
      return value || '-';
  }
}

export function formatPayrollBlockReason(value?: string | null) {
  switch (value) {
    case 'missing_employee_binding':
      return '缺员工绑定';
    case 'missing_confirmation_status':
      return '缺确认状态';
    case 'insufficient_evidence':
      return '证据不足';
    case 'weak_rule':
      return '弱规则';
    case 'not_in_whitelist':
      return '不在白名单';
    case 'unknown_merchant_attribution':
      return '商户归属不明';
    case 'reference_only':
      return '仅参考来源';
    case 'ignored':
      return '已忽略';
    default:
      return value || '-';
  }
}

export function formatCustomerBindingStatus(value?: string | null) {
  switch (value) {
    case 'auto_matched':
      return '手机号自动候选';
    case 'manual_pending':
      return '待人工绑定';
    case 'manually_bound':
      return '已人工绑定';
    case 'conflict':
      return '绑定冲突';
    default:
      return value || '-';
  }
}

export function formatPerformanceBlockReason(value?: string | null) {
  switch (value) {
    case 'missing_customer_mobile':
      return '缺客户手机号';
    case 'missing_customer_binding':
      return '缺客户绑定';
    case 'ambiguous_customer_match':
      return '客户匹配冲突';
    case 'missing_employee_binding':
      return '缺员工绑定';
    case 'awaiting_manual_review':
      return '待人工复核';
    case 'other':
      return '其他阻塞';
    default:
      return value || '-';
  }
}

export function formatBusinessStatDomain(value?: string | null) {
  switch (value) {
    case 'stark_work_order':
      return '斯塔克工单';
    case 'stark_material':
      return '斯塔克材料';
    case 'stark_fund':
      return '斯塔克资金';
    case 'abc_order':
      return 'ABC订单';
    case 'abc_fund':
      return 'ABC资金';
    case 'abc_card':
      return 'ABC卡域';
    default:
      return value || '-';
  }
}

export function formatRewardEventType(value?: string | null) {
  switch (value) {
    case 'a_order_completed':
      return 'A端订单完成';
    case 'combo_success':
      return '组合成交';
    case 'card_issue':
      return '发卡成功';
    case 'public_vehicle_completed':
      return '公车完成';
    case 'private_vehicle_repurchase':
      return '私家车复购';
    case 'insurance_conversion':
      return '保险转化';
    default:
      return value || '-';
  }
}

export function formatRewardSummaryDomain(value?: string | null) {
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

export function formatPendingItemType(value?: string | null) {
  switch (value) {
    case 'tag':
      return '统计标签';
    case 'reward':
      return '奖励事件';
    default:
      return value || '-';
  }
}
