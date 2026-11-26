const performanceDomainLabelMap: Record<string, string> = {
  work_orders: '工单域',
  orders: '订单域',
  funds: '资金域',
  cards: '卡域',
};

const performanceEventTypeLabelMap: Record<string, string> = {
  stark_work_order_completed: '工单完成',
  stark_work_order_material_cost: '工单材料成本',
  abc_order_event: 'ABC 订单事件',
  abc_card_recharge_event: 'ABC 卡充值事件',
  abc_card_ledger_event: 'ABC 卡流水事件',
  abc_fund_event: 'ABC 资金事件',
  abc_fund_freeze: 'ABC 资金冻结事件',
};

const bindingTypeLabelMap: Record<string, string> = {
  user: '用户',
  merchant: '商户',
  mobile: '手机号',
};

export function formatPerformanceDomain(value?: string | null) {
  return normalizeWithMap(performanceDomainLabelMap, value);
}

export function formatPerformanceEventType(value?: string | null) {
  if (!value) {
    return '-';
  }

  if (performanceEventTypeLabelMap[value]) {
    return performanceEventTypeLabelMap[value];
  }

  if (value.startsWith('abc_fund_')) {
    return `ABC 资金事件（${value.replace('abc_fund_', '')}）`;
  }

  return value;
}

export function formatBindingType(value?: string | null) {
  return normalizeWithMap(bindingTypeLabelMap, value);
}

export function formatConfirmedFlag(value?: boolean | null) {
  if (value === true) return '已确认';
  if (value === false) return '待确认';
  return '-';
}

export function formatStatusFlag(value?: number | boolean | null) {
  if (value === true || value === 1) return '启用';
  if (value === false || value === 0) return '停用';
  return '-';
}

export function formatHandlingAction(value?: string | null) {
  if (value === 'rebind') return '重新绑定';
  if (value === 'confirm') return '手工确认';
  if (value === 'ignore') return '标记忽略';
  return value || '-';
}

function normalizeWithMap(map: Record<string, string>, value?: string | null) {
  if (!value) {
    return '-';
  }

  return map[value] ?? value;
}
