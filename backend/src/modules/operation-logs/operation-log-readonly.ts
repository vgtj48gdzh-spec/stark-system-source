import { OperationLogAction } from '../../shared/enums/operation-log-action.enum';

// Only code-owned labels/codes cross the read boundary. Free-form audit payloads
// and future entity fields must not become public just because they are added.
const MODULE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  work_order: '工单', work_order_material: '工单材料', material_preparation: '备料',
  repair_shop: '修理', repair_shop_procurement: '修理采购',
  approval_request: '审批', payment_record: '收款记录', payout_record: '付款记录',
  finance_bank_sms: '银行短信', finance_bank_account: '银行账户',
  finance_reconciliation: '财务对账', finance_collection_confirmation: '收款复核',
  finance_wechat: '微信收款', inventory_transaction: '库存流水',
  warehouse: '仓库', supplier: '供应商', material: '材料',
  abc_sync: '业务同步', abc_integration: '业务接入', verification_forward: '核验转发',
});
const ACTION_CODES = new Set<string>(Object.values(OperationLogAction));
const ACTION_LABELS: Readonly<Record<string, string>> = Object.freeze({
  create_work_order: '创建工单', update_work_order: '修改工单',
  view_work_order_customer_contact: '查看工单联系信息',
  create_payment_record: '创建收款记录', payment_success: '收款成功',
  submit_approval: '提交审批', approve_approval: '批准审批', reject_approval: '驳回审批',
  create_approval_request_draft: '创建审批申请草稿',
  submit_approval_request_draft: '提交审批申请草稿',
  void_approval_request_draft: '作废审批申请草稿',
  create_payout_record: '创建付款记录',
  ingest_bank_sms: '接入银行短信',
  suggest_bank_sms_reconciliation: '生成银行短信对账建议',
  confirm_bank_sms_apply: '确认银行短信归属',
  ignore_bank_sms_reconciliation: '忽略银行短信对账候选',
  dispatch_verification_code: '发送审批验证码',
  import_manual_sms: '手工导入短信',
  create_bank_account_binding: '创建银行账户绑定',
  update_bank_account_binding: '修改银行账户绑定',
  backfill_bank_account_binding: '回填银行账户绑定',
  review_bank_account_binding: '复核银行账户绑定',
  request_mobile_inbox_sync: '请求短信收件箱同步',
  request_mobile_test_upload: '请求手机测试上传',
  create_wechat_merchant_registry: '创建微信商户登记',
  import_wechat_payment_receipt: '导入微信支付回执',
  create_wechat_settlement_batch: '创建微信结算批次',
  create_warehouse: '创建仓库', update_warehouse: '修改仓库',
  create_supplier: '创建供应商', update_supplier: '修改供应商',
  create_material: '创建材料', update_material: '修改材料',
  inventory_inbound: '库存入库', inventory_outbound: '库存出库',
  request_inventory_adjustment: '申请库存调整',
  apply_inventory_reversal: '库存冲销', apply_inventory_adjustment: '库存调整',
  'business_contribution.correction.create': '创建经营贡献更正',
  create_material_preparation: '创建备料单', bind_material_preparation: '关联备料单',
  create_work_order_material: '创建工单材料',
  update_work_order_material: '修改工单材料',
  delete_work_order_material: '删除工单材料',
  recalculate_work_order_material_cost: '重算工单材料成本',
  start_sync_job_run: '开始业务同步任务',
  complete_sync_job_run: '完成业务同步任务',
  fail_sync_job_run: '业务同步任务失败',
} satisfies Record<OperationLogAction, string>);
const positiveId = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;

export function projectOperationLogReadonly(value: unknown) {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const moduleCode = typeof row.module === 'string' && Object.prototype.hasOwnProperty.call(MODULE_LABELS, row.module)
    ? row.module : null;
  const actionCode = typeof row.action === 'string' && ACTION_CODES.has(row.action) ? row.action : null;
  const date = row.createdAt instanceof Date ? row.createdAt
    : typeof row.createdAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(row.createdAt)
      ? new Date(row.createdAt) : null;
  return {
    id: positiveId(row.id), module: moduleCode ? MODULE_LABELS[moduleCode] : '其他模块',
    moduleCode, targetId: positiveId(row.targetId),
    // A fallback may expose only an enum-allowlisted code, never stored free text.
    action: actionCode ? ACTION_LABELS[actionCode] ?? actionCode : '其他操作（详情受限）',
    actionCode, operatorId: positiveId(row.operatorId),
    actorType: row.actorType === 'human' || row.actorType === 'system' ? row.actorType : 'unknown',
    createdAt: date && Number.isFinite(date.getTime()) ? date.toISOString() : null,
    detailsRedacted: true as const,
  };
}
