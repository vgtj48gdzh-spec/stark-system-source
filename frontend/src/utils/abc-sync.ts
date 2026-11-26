const statusLabelMap: Record<string, string> = {
  completed: '已完成',
  pending_payment: '待付款',
  processing: '处理中',
  paid: '已付款',
  cancelled: '已取消',
  recorded: '已记录',
  active: '已启用',
  inactive: '已停用',
  failed: '失败',
  pending: '待确认',
  returned: '已退回',
  shipped: '已发货',
  unknown: '未确认',
};

const businessTypeLabelMap: Record<string, string> = {
  service_order: '服务订单',
  repair_order: '维修工单',
  supermarket_order: '商超订单',
  top_up_order: '充值订单',
};

const fundTypeLabelMap: Record<string, string> = {
  freeze: '冻结',
  top_up: '充值',
  payment: '支付',
  recharge: '充值',
};

const directionLabelMap: Record<string, string> = {
  hold: '冻结中',
  income: '收入',
  expense: '支出',
  inbound: '流入',
  outbound: '流出',
  in: '流入',
  out: '流出',
  release: '释放',
  unknown: '未确认',
};

const targetDomainLabelMap: Record<string, string> = {
  orders: '订单域',
  funds: '资金域',
  cards: '卡域',
  inventory: '库存域',
  order_status: '订单状态',
  fund_status: '资金状态',
  fund_type: '资金类型',
  card_status: '卡状态',
  card_ledger_type: '卡流水类型',
  material_status: '材料状态',
  supplier_status: '供应商状态',
  warehouse_status: '库房状态',
  inventory_status: '库存状态',
  inventory_ledger_type: '库存流水类型',
};

const confidenceLabelMap: Record<string, string> = {
  documented: '文档确认',
  inferred: '推断',
};

const runStatusLabelMap: Record<string, string> = {
  running: '运行中',
  success: '成功',
  failed: '失败',
};

const amountUnitLabelMap: Record<string, string> = {
  yuan: '元',
  fen: '分',
  fen_decimal: '分',
  yuan_integer: '元',
  count: '个',
  unknown: '未确认',
};

const sourceTableLabelMap: Record<string, string> = {
  order: '服务订单表',
  repair_order: '维修工单表',
  supermarket_order: '商超订单表',
  top_up_order: '充值订单表',
  transaction: '资金流水表',
  shopping_card: '购物卡模板表',
  user_shopping_card: '用户购物卡表',
  user_shopping_card_money: '购物卡账本表',
  user_shopping_card_recharge: '购物卡充值表',
  merchant_material: '材料主数据表',
  merchant_supplier: '供应商主数据表',
  merchant_warehouse: '入库来源表',
  merchant_warehouse_out: '出库流水表',
};

const exceptionTypeLabelMap: Record<string, string> = {
  mapping_confirmed_false: '映射未确认',
  missing_status_mapping: '未命中状态映射',
  missing_amount_rule: '未命中金额规则',
  mapping_notes_present: '存在待确认说明',
};

const cardObjectTypeLabelMap: Record<string, string> = {
  card_template: '卡模板',
  user_card_account: '用户持卡账户',
};

const cardLedgerTypeLabelMap: Record<string, string> = {
  recharge: '充值记录',
  points_recovery: '积分回收',
  package_bonus: '套餐赠送',
  privilege_bonus: '权益赠送',
  appointment_bonus: '预约赠送',
  unknown: '未确认',
};

const inventoryLedgerTypeLabelMap: Record<string, string> = {
  stock_in: '入库',
  work_order_outbound: '工单出库',
  internal_use: '内部领用',
  goods_sale: '商品销售',
  other_outbound: '其他出库',
  unknown: '未确认',
};

const recordTypeLabelMap: Record<string, string> = {
  cards: '卡主数据',
  card_ledger: '卡流水',
  materials: '材料主数据',
  suppliers: '供应商主数据',
  warehouses: '库房来源快照',
  inventory_ledger: '库存流水',
};

export function formatAbcStatus(value?: string | null) {
  return normalizeWithMap(statusLabelMap, value);
}

export function formatAbcBusinessType(value?: string | null) {
  return normalizeWithMap(businessTypeLabelMap, value);
}

export function formatAbcFundType(value?: string | null) {
  return normalizeWithMap(fundTypeLabelMap, value);
}

export function formatAbcDirection(value?: string | null) {
  return normalizeWithMap(directionLabelMap, value);
}

export function formatAbcTargetDomain(value?: string | null) {
  return normalizeWithMap(targetDomainLabelMap, value);
}

export function formatAbcConfidence(value?: string | null) {
  return normalizeWithMap(confidenceLabelMap, value);
}

export function formatAbcRunStatus(value?: string | null) {
  return normalizeWithMap(runStatusLabelMap, value);
}

export function formatAbcAmountUnit(value?: string | null) {
  return normalizeWithMap(amountUnitLabelMap, value);
}

export function formatAbcSourceTable(value?: string | null) {
  return normalizeWithMap(sourceTableLabelMap, value);
}

export function formatAbcExceptionType(value?: string | null) {
  return normalizeWithMap(exceptionTypeLabelMap, value);
}

export function formatAbcCardObjectType(value?: string | null) {
  return normalizeWithMap(cardObjectTypeLabelMap, value);
}

export function formatAbcCardLedgerType(value?: string | null) {
  return normalizeWithMap(cardLedgerTypeLabelMap, value);
}

export function formatAbcInventoryLedgerType(value?: string | null) {
  return normalizeWithMap(inventoryLedgerTypeLabelMap, value);
}

export function formatAbcRecordType(value?: string | null) {
  return normalizeWithMap(recordTypeLabelMap, value);
}

function normalizeWithMap(map: Record<string, string>, value?: string | null) {
  if (!value) {
    return '-';
  }

  return map[value] ?? value;
}
